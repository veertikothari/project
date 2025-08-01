import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Upload, Clock, FileText, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type CEPRequirement = {
  year: string;
  hours_required: number;
  deadline: string | null;
};

type Submission = {
  submission_id: string;
  hours: number;
  file_url: string;
  submitted_at: string;
};

const StudentCEP = () => {
  const { user } = useAuth();
  const [requirement, setRequirement] = useState<CEPRequirement | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [completedHours, setCompletedHours] = useState(0);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    hours: 0,
    file: null as File | null,
  });

  useEffect(() => {
    if (user?.year && user?.user_id) {
      console.log('User:', { user_id: user.user_id, year: user.year, yearType: typeof user.year });
      fetchRequirement();
      fetchSubmissions();
    } else {
      console.warn('No user or user.year/user_id defined:', user);
      alert('User information is missing. Please ensure user data is provided.');
    }
  }, [user]);

  const fetchRequirement = async () => {
    if (!user?.year) {
      console.warn('No user.year defined');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('cep_requirements')
        .select('*')
        .eq('year', String(user.year)); // Ensure year is a string

      if (error) {
        console.error('Error fetching requirement:', error);
        alert(`Failed to fetch requirements: ${error.message || 'Unknown error'}`);
        return;
      }

      if (data && data.length > 0) {
        setRequirement(data[0]);
      } else {
        console.warn('No requirement found for year:', user.year);
        setRequirement(null);
      }
    } catch (error) {
      console.error('Unexpected error fetching requirement:', error);
      alert('An unexpected error occurred while fetching requirements.');
    }
  };

  const fetchSubmissions = async () => {
    if (!user?.user_id) {
      console.warn('No user.user_id defined');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('cep_submissions')
        .select('*')
        .eq('user_id', user.user_id) // Use user_id from context
        .order('submitted_at', { ascending: false });

      if (error) {
        console.error('Error fetching submissions:', error);
        alert(`Failed to fetch submissions: ${error.message || 'Unknown error'}`);
        return;
      }

      if (data) {
        setSubmissions(data);
        const totalHours = data.reduce((sum, sub) => sum + (sub.hours || 0), 0);
        setCompletedHours(totalHours);
      }
    } catch (error) {
      console.error('Unexpected error fetching submissions:', error);
      alert('An unexpected error occurred while fetching submissions.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.user_id || !formData.file) {
      alert('Please ensure user ID is provided and a file is selected.');
      return;
    }

    setIsLoading(true);

    try {
      // Upload file to Supabase storage
      const fileExt = formData.file.name.split('.').pop();
      const fileName = `${user.user_id}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('cep-files')
        .upload(fileName, formData.file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`File upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('cep-files')
        .getPublicUrl(fileName);

      // Save submission to database
      const { error: insertError } = await supabase
        .from('cep_submissions')
        .insert({
          user_id: user.user_id, // Use user_id from context
          hours: formData.hours,
          file_url: publicUrl,
        });

      if (insertError) {
        console.error('Insert error details:', insertError);
        throw new Error(`Insert failed: ${insertError.message}`);
      }

      console.log('Submission successful for user_id:', user.user_id);

      // Reset form and refresh data
      setFormData({ hours: 0, file: null });
      setShowUploadForm(false);
      await fetchSubmissions();
    } catch (error: any) {
      console.error('Error submitting:', error);
      alert(`Error submitting: ${error.message || 'Please try again.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const progressPercentage = requirement
    ? Math.min((completedHours / requirement.hours_required) * 100, 100)
    : 0;

  if (!requirement) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-800 mb-2">No Requirements Set</h3>
          <p className="text-gray-600">Your faculty hasn't set CEP requirements for your year yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Cultural Engagement Program</h1>
        <p className="text-gray-600">Complete your social service hours</p>
      </div>

      {/* Requirements Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl p-6 border border-teal-200"
      >
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Requirements</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-sm text-gray-600">Minimum Hours Required</div>
            <div className="text-2xl font-bold text-teal-600">{requirement.hours_required}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Deadline</div>
            <div className="text-lg font-semibold text-gray-800">
              {requirement.deadline ? new Date(requirement.deadline).toLocaleDateString() : 'Not set'}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Progress Tracking */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-lg p-6 border border-gray-200"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Your Progress</h2>
          <div
            className={`text-lg font-bold ${
              completedHours >= requirement.hours_required ? 'text-green-600' : 'text-orange-600'
            }`}
          >
            {completedHours} / {requirement.hours_required} hours
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Completion Progress</span>
            <span className="text-sm font-medium">{Math.round(progressPercentage)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className={`h-3 rounded-full transition-all duration-300 ${
                completedHours >= requirement.hours_required
                  ? 'bg-green-500'
                  : 'bg-gradient-to-r from-teal-500 to-cyan-500'
              }`}
            />
          </div>
        </div>

        {completedHours >= requirement.hours_required && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <div className="text-green-600 font-semibold">🎉 Congratulations!</div>
            <div className="text-green-700">You have completed your social service hours requirement!</div>
          </div>
        )}
      </motion.div>

      {/* Upload Button */}
      <div className="flex justify-center">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowUploadForm(true)}
          className="bg-teal-600 text-white px-6 py-3 rounded-lg flex items-center space-x-2 hover:bg-teal-700 transition-colors shadow-lg"
        >
          <Plus className="w-5 h-5" />
          <span>Add New Submission</span>
        </motion.button>
      </div>

      {/* Upload Form */}
      {showUploadForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-6 border border-gray-200"
        >
          <h2 className="text-xl font-semibold mb-4">Upload Social Service Activity</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Hours Completed</label>
              <input
                type="number"
                value={formData.hours || ''}
                onChange={(e) => setFormData({ ...formData, hours: parseInt(e.target.value) || 0 })}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                min="1"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Certificate/Proof Upload
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-teal-400 transition-colors">
                <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setFormData({ ...formData, file: e.target.files?.[0] || null })}
                  className="hidden"
                  id="file-upload"
                  required
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer text-teal-600 hover:text-teal-700"
                >
                  {formData.file ? formData.file.name : 'Click to upload certificate or proof'}
                </label>
                <p className="text-sm text-gray-500 mt-1">PDF, JPG, PNG up to 10MB</p>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={isLoading}
                className="bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Submitting...' : 'Submit Activity'}
              </button>
              <button
                type="button"
                onClick={() => setShowUploadForm(false)}
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Previous Submissions */}
      {submissions.length > 0 && (
        <div className="space-y-4 w-full max-h-full">
          <h2 className="text-xl font-semibold text-gray-800">Your Submissions</h2>
          {submissions.map((submission) => (
            <motion.div
              key={submission.submission_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-lg p-6 border border-gray-200"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-lg font-semibold text-gray-800">{submission.hours} Hours</div>
                  <div className="text-sm text-gray-600">
                    Submitted: {new Date(submission.submitted_at).toLocaleDateString()}
                  </div>
                </div>
                {submission.file_url && (
                  <a
                    href={submission.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-teal-100 text-teal-600 px-3 py-1 rounded text-sm hover:bg-teal-200 transition-colors flex items-center space-x-1"
                  >
                    <FileText className="w-4 h-4" />
                    <span>View File</span>
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentCEP;