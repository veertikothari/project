import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Upload, Clock, FileText, Plus, Edit, Trash2, Calendar, MapPin, Users, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type CEPRequirement = {
  year: string;
  hours_required: number;
  deadline: string | null;
};

type Submission = {
  submission_id: string;
  title: string;
  activity_date: string;
  hours: number;
  file_url: string;
  submitted_at: string;
  approved?: boolean | null;
};

type Activity = {
  event_id: string
  title: string
  description: string
  date: string
  time: string
  venue: string
  type: string
  //category: string
  created_by: string;
  class: string;
  department: string;
  enrolled_students?: number;
  attendance_status?: 'Present' | 'Absent' | null;
  is_enrolled?: boolean;
  feedback_given?: boolean;   
  maxPoints?: number; 
};

const StudentCEP = () => {
  const { user } = useAuth();
  const [requirement, setRequirement] = useState<CEPRequirement | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [completedHours, setCompletedHours] = useState(0);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingSubmission, setEditingSubmission] = useState<Submission | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    activity_date: '',
    hours: 0,
    file: null as File | null,
  });

  useEffect(() => {
    if (user?.user_id && user?.department) {
      fetchRequirement();
      fetchSubmissions();
      fetchActivities();
    } else {
      alert('User information is missing. Please ensure user data is provided.');
    }
  }, [user]);

  const fetchRequirement = async () => {
    if (!user?.year) return;
    try {
      const { data, error } = await supabase
        .from('cep_requirements')
        .select('*')
        .eq('year', String(user.year));
      if (error) throw error;
      if (data && data.length > 0) {
        setRequirement(data[0]);
      } else {
        setRequirement(null);
      }
    } catch (error: any) {
      alert(`Failed to fetch requirements: ${error.message || 'Unknown error'}`);
    }
  };

  const fetchSubmissions = async () => {
    if (!user?.user_id) return;
    try {
      const { data, error } = await supabase
        .from('cep_submissions')
        .select('*')
        .eq('user_id', user.user_id)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      if (data) {
        setSubmissions(data);
        const totalHours = data.reduce(
          (sum, sub) => sub.approved === true ? sum + (sub.hours || 0) : sum, 0);
          setCompletedHours(totalHours);
      }
    } catch (error: any) {
      alert(`Failed to fetch submissions: ${error.message || 'Unknown error'}`);
    }
  };

  const fetchActivities = async () => {
    if (!user?.department || !user?.year || !user?.user_id) return;
    try {
      // Fetch CEP activities that match the student's department and year/class
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select(`
          event_id,
          title,
          description,
          date,
          time,
          venue,
          location,
          class,
          department,
          maxPoints
        `)
        .eq('category', 'CEP')
        .eq('department', user.department)
        .order('date', { ascending: false });

      if (eventsError) {
        console.error('Error fetching activities:', eventsError);
        return;
      }

      // Get enrollment status, attendance status, and enrollment counts for each activity
      const activitiesWithStatus = await Promise.all(
        (eventsData || []).map(async (activity) => {
          // Check if student is enrolled
          const { data: enrollmentData } = await supabase
            .from('enrollments')
            .select('enrollment_id')
            .eq('event_id', activity.event_id)
            .eq('user_id', user.user_id)
            .single();

          // Check attendance status
          const { data: attendanceData } = await supabase
            .from('attendance')
            .select('status')
            .eq('event_id', activity.event_id)
            .eq('user_id', user.user_id)
            .single();

          // Get enrollment count
          const { count, error: countError } = await supabase
            .from('enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', activity.event_id);

          // Check if feedback is given
          const { data: feedbackData } = await supabase
            .from('feedback')
            .select('feedback_id')
            .eq('event_id', activity.event_id)
            .eq('user_id', user.user_id)
            .single();

            return {
            ...activity,
            category: 'CEP',
            created_by: '',
            enrolled_students: 0,
            type: '',
            attendance_status: attendanceData?.status || null,
            is_enrolled: !!enrollmentData,
            feedback_given: !!feedbackData,                
            earned_points: feedbackData ? activity.maxPoints : 0 
          } as Activity;
        })
      );

      setActivities(activitiesWithStatus);
    } catch (error: any) {
      console.error('Error fetching activities:', error);
    }
  };

  const handleEdit = (submission: Submission) => {
    setEditingSubmission(submission);
    setFormData({
      title: submission.title,
      activity_date: submission.activity_date.split('T')[0],
      hours: submission.hours,
      file: null
    });
    setShowUploadForm(true);
  };

  const handleEnroll = async (eventId: string, isCurrentlyEnrolled: boolean) => {
    if (!user?.user_id) return;

    setIsLoading(true);
    try {
      if (isCurrentlyEnrolled) {
        const { error } = await supabase
          .from('enrollments')
          .delete()
          .eq('event_id', eventId)
          .eq('user_id', user.user_id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('enrollments')
          .insert({ event_id: eventId, user_id: user.user_id });
        if (error) throw error;
      }
      await fetchActivities(); // Refresh the list
    } catch (err: any) {
      alert(`Error updating enrollment: ${err.message || 'Please try again.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (submission: Submission) => {
    if (!window.confirm('Are you sure you want to delete this submission?')) return;

    setIsLoading(true);
    try {
      // Delete file from storage if it exists
      if (submission.file_url) {
        const filePath = submission.file_url.split('/').slice(-2).join('/');
        await supabase.storage.from('cep-files').remove([filePath]);
      }

      // Delete submission from database
      const { error } = await supabase
        .from('cep_submissions')
        .delete()
        .eq('submission_id', submission.submission_id);

      if (error) throw new Error(`Deletion failed: ${error.message}`);
      
      await fetchSubmissions();
    } catch (error: any) {
      alert(`Error deleting submission: ${error.message || 'Please try again.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.user_id || !formData.title || !formData.activity_date || (!formData.file && !editingSubmission)) {
      alert('Please fill all required fields and select a file.');
      return;
    }

    setIsLoading(true);
    try {
      let publicUrl = editingSubmission?.file_url || '';

      // Handle file upload
      if (formData.file) {
        const fileExt = formData.file.name.split('.').pop();
        const fileName = `${user.user_id}/${Date.now()}.${fileExt}`;
        
        // Upload new file
        const { error: uploadError } = await supabase.storage
          .from('cep-files')
          .upload(fileName, formData.file, {
            cacheControl: '3600',
            upsert: false
          });
        if (uploadError) throw new Error(`File upload failed: ${uploadError.message}`);
        
        const { data: urlData } = supabase.storage
          .from('cep-files')
          .getPublicUrl(fileName);
        publicUrl = urlData.publicUrl;

        // Delete old file if editing
        if (editingSubmission?.file_url) {
          const oldFilePath = editingSubmission.file_url.split('/').slice(-2).join('/');
          await supabase.storage.from('cep-files').remove([oldFilePath]);
        }
      }

      // Upsert submission
      const submissionData = {
        user_id: user.user_id,
        title: formData.title,
        activity_date: formData.activity_date,
        hours: formData.hours,
        file_url: publicUrl,
        ...(editingSubmission ? {} : { submitted_at: new Date().toISOString() })
      };

      const { error } = editingSubmission
        ? await supabase
            .from('cep_submissions')
            .update(submissionData)
            .eq('submission_id', editingSubmission.submission_id)
        : await supabase
            .from('cep_submissions')
            .insert(submissionData);

      if (error) throw new Error(`Submission failed: ${error.message}`);

      // Reset form
      setFormData({ title: '', activity_date: '', hours: 0, file: null });
      setShowUploadForm(false);
      setEditingSubmission(null);
      await fetchSubmissions();
    } catch (error: any) {
      alert(`Error submitting: ${error.message || 'Please try again.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const progressPercentage = requirement
    ? Math.min((completedHours / requirement.hours_required) * 100, 100)
    : 0;

  const getAttendanceColor = (status: 'Present' | 'Absent' | null) => {
    switch (status) {
      case 'Present':
        return 'text-green-600 bg-green-100'
      case 'Absent':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-yellow-600 bg-yellow-100'
    }
  }

  const getAttendanceIcon = (status: 'Present' | 'Absent' | null) => {
    switch (status) {
      case 'Present':
        return <CheckCircle className="w-5 h-5" />
      case 'Absent':
        return <XCircle className="w-5 h-5" />
      default:
        return <Clock className="w-5 h-5" />
    }
  }

  const getAttendanceText = (status: 'Present' | 'Absent' | null) => {
    switch (status) {
      case 'Present':
        return 'Present'
      case 'Absent':
        return 'Absent'
      default:
        return 'Pending'
    }
  }

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
      {/* <div>
        <h1 className="text-2xl font-bold text-gray-800">Community Engagement Program</h1>
        <p className="text-gray-600">Complete your social service hours</p>
      </div> */}

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

      {/* Available CEP Activities */}
      {activities.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-6 border border-gray-200"
        >
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Available CEP Activities</h2>
          <p className="text-gray-600 mb-4">Activities created by your faculty for your department and year</p>
          <div className="space-y-4">
            {activities.map((activity, index) => (
              <motion.div
                key={activity.event_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800">{activity.title}</h3>
                    <p className="text-gray-600 mt-1">{activity.description}</p>
                    <div className="flex items-center space-x-4 text-sm text-gray-600 mt-2">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(activity.date).toLocaleDateString()} at {activity.time}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-4 h-4" />
                        <span>{activity.venue}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Users className="w-4 h-4" />
                        <span>{activity.enrolled_students || 0} enrolled</span>
                      </div>
                    </div>
                    
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg font-medium ${getAttendanceColor(activity.attendance_status || null)}`}>
                      {getAttendanceIcon(activity.attendance_status || null)}
                      <span>{getAttendanceText(activity.attendance_status || null)}</span>
                    
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleEnroll(activity.event_id, !!activity.is_enrolled)}
                      disabled={isLoading}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        activity.is_enrolled
                          ? 'bg-red-100 text-red-600 hover:bg-red-200'
                          : 'bg-green-100 text-green-600 hover:bg-green-200'
                      } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {activity.is_enrolled ? 'Unenroll' : 'Enroll'}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Attendance Summary for CEP Activities */}
      {activities.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl p-6 border border-teal-200"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-4">CEP Activities Attendance Summary</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {activities.filter(a => a.attendance_status === 'Present').length}
              </div>
              <div className="text-sm text-gray-600">Present</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {activities.filter(a => a.attendance_status === 'Absent').length}
              </div>
              <div className="text-sm text-gray-600">Absent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {activities.filter(a => !a.attendance_status).length}
              </div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Upload Button */}
      <div className="flex justify-center">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            setEditingSubmission(null);
            setFormData({ title: '', activity_date: '', hours: 0, file: null });
            setShowUploadForm(true);
          }}
          className="bg-teal-600 text-white px-6 py-3 rounded-lg flex items-center space-x-2 hover:bg-teal-700 transition-colors shadow-lg"
        >
          <Plus className="w-5 h-5" />
          <span>Add New Submission</span>
        </motion.button>
      </div>

{/* Upload/Edit Form */}
      {showUploadForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-6 border border-gray-200"
        >
          <h2 className="text-xl font-semibold mb-4">
            {editingSubmission ? 'Edit Submission' : 'Upload Social Service Activity'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Activity Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Activity Date</label>
              <input
                type="date"
                value={formData.activity_date}
                onChange={(e) => setFormData({ ...formData, activity_date: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>
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
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer text-teal-600 hover:text-teal-700"
                >
                  {formData.file ? formData.file.name : 'Click to upload certificate or proof'}
                </label>
                <p className="text-sm text-gray-500 mt-1">PDF, JPG, PNG up to 10MB</p>
                {editingSubmission && !formData.file && (
                  <p className="text-sm text-gray-500 mt-1">Leave empty to keep existing file</p>
                )}
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={isLoading}
                className="bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Submitting...' : editingSubmission ? 'Update Submission' : 'Submit Activity'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUploadForm(false);
                  setEditingSubmission(null);
                  setFormData({ title: '', activity_date: '', hours: 0, file: null });
                }}
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
                  <div className="text-lg font-semibold text-gray-800">{submission.title}</div>
                  <div className="text-sm text-gray-600">
                    Activity Date: {new Date(submission.activity_date).toLocaleDateString()}
                  </div>
                  <div className="text-sm text-gray-600">Hours: {submission.hours}</div>
                  <div className="text-sm text-gray-600">
                    Submitted: {new Date(submission.submitted_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(submission)}
                    className="bg-blue-100 text-blue-600 px-3 py-1 rounded text-sm hover:bg-blue-200 transition-colors flex items-center space-x-1"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(submission)}
                    className="bg-red-100 text-red-600 px-3 py-1 rounded text-sm hover:bg-red-200 transition-colors flex items-center space-x-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
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
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentCEP;