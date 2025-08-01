import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Calendar, MapPin, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';

type Activity = {
  event_id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  category: string;
  location: string;
  created_by: string;
};

type Student = {
  user_id: string;
  name: string;
  uid: string;
  year: string;
  email: string;
};

const FacultyCC = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    venue: '',
    category: 'Co-curricular',
    location: '',
    class: '',
    department: user?.department || '',
  });

  useEffect(() => {
    if (user?.uid) {
      fetchActivities();
    } else {
      setError('User not logged in');
    }
  }, [user]);

  const fetchActivities = async () => {
    if (!user?.uid) {
      setError('User not logged in');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('created_by', user.uid) // Use user.uid (TEXT) instead of user.user_id (UUID)
        .eq('category', 'Co-curricular')
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching activities:', error);
        throw new Error(`Failed to fetch activities: ${error.message}`);
      }

      setActivities(data || []);
    } catch (err: any) {
      console.error('Unexpected error:', err);
      setError(err.message || 'An unexpected error occurred while fetching activities.');
    }
  };

  const createActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) {
      setError('User not logged in');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { error } = await supabase.from('events').insert({
        ...formData,
        created_by: user.uid, // Use user.uid (TEXT)
      });

      if (error) {
        console.error('Error creating activity:', error);
        throw new Error(`Failed to create activity: ${error.message}`);
      }

      setShowCreateForm(false);
      setFormData({
        title: '',
        description: '',
        date: '',
        time: '',
        venue: '',
        category: 'Co-curricular',
        location: '',
        class: '',
        department: user?.department || '',
      });
      await fetchActivities();
    } catch (err: any) {
      console.error('Activity creation error:', err);
      setError(err.message || 'An unexpected error occurred while creating the activity.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStudents = async (activity: Activity) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('user_id, name, uid, year, email')
        .eq('role', 'Student')
        .eq('year', formData.class || '1');

      if (error) {
        console.error('Error fetching students:', error);
        throw new Error(`Failed to fetch students: ${error.message}`);
      }

      setStudents(data || []);
      setSelectedActivity(activity);

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('user_id, status')
        .eq('event_id', activity.event_id);

      if (attendanceError) {
        console.error('Error fetching attendance:', attendanceError);
        throw new Error(`Failed to fetch attendance: ${attendanceError.message}`);
      }

      const attendanceMap: Record<string, boolean> = {};
      attendanceData?.forEach((record) => {
        attendanceMap[record.user_id] = record.status === 'Present';
      });
      setAttendance(attendanceMap);
    } catch (err: any) {
      console.error('Unexpected error:', err);
      setError(err.message || 'An unexpected error occurred while fetching students.');
    }
  };

  const markAttendance = async (studentId: string, isPresent: boolean) => {
    if (!selectedActivity || !user?.uid) {
      setError('No activity selected or user not logged in');
      return;
    }

    try {
      const { error } = await supabase.from('attendance').upsert({
        user_id: studentId,
        event_id: selectedActivity.event_id,
        status: isPresent ? 'Present' : 'Absent',
        marked_by: user.uid, // Use user.uid (TEXT)
      });

      if (error) {
        console.error('Error marking attendance:', error);
        throw new Error(`Failed to mark attendance: ${error.message}`);
      }

      setAttendance((prev) => ({
        ...prev,
        [studentId]: isPresent,
      }));
    } catch (err: any) {
      console.error('Attendance error:', err);
      setError(err.message || 'An unexpected error occurred while marking attendance.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Co-curricular Activities</h1>
          <p className="text-gray-600">Manage and track student activities</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Create Activity</span>
        </motion.button>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm"
        >
          {error}
        </motion.div>
      )}

      {showCreateForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-6 border border-gray-200"
        >
          <h2 className="text-xl font-semibold mb-4">Create New Activity</h2>
          <form onSubmit={createActivity} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Activity Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <input
                type="text"
                placeholder="Class (e.g., 1, 2, 3, 4)"
                value={formData.class}
                onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <input
                type="text"
                placeholder="Venue"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <input
                type="text"
                placeholder="Location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <textarea
              placeholder="Activity Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={isLoading}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Creating...' : 'Create Activity'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="space-y-4">
        {activities.map((activity) => (
          <motion.div
            key={activity.event_id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-lg p-6 border border-gray-200"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-800">{activity.title}</h3>
                <p className="text-gray-600 mt-1">{activity.description}</p>
              </div>
              <button
                onClick={() => fetchStudents(activity)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-green-700 transition-colors"
              >
                <Users className="w-4 h-4" />
                <span>Mark Attendance</span>
              </button>
            </div>

            <div className="flex items-center space-x-6 text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4" />
                <span>
                  {format(new Date(activity.date), 'MMM dd, yyyy')} at {activity.time}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4" />
                <span>{activity.venue}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {selectedActivity && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
          >
            <h2 className="text-xl font-semibold mb-4">
              Mark Attendance - {selectedActivity.title}
            </h2>

            <div className="space-y-3">
              {students.map((student) => (
                <div
                  key={student.user_id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-800">{student.name}</p>
                    <p className="text-sm text-gray-600">
                      UID: {student.uid} | Year: {student.year}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => markAttendance(student.user_id, true)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        attendance[student.user_id] === true
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                      }`}
                    >
                      Present
                    </button>
                    <button
                      onClick={() => markAttendance(student.user_id, false)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        attendance[student.user_id] === false
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                      }`}
                    >
                      Absent
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setSelectedActivity(null)}
              className="mt-6 bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default FacultyCC;