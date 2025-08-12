import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Calendar, MapPin, Users, Edit2, Trash2, Bell, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { format } from 'date-fns';
import EventReport from './EventReport';

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
  class: string;
  department: string; // Changed from string[]
  enrolled_students?: number;
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
  const { sendBulkNotifications } = useNotifications();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [pendingAttendance, setPendingAttendance] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showReports, setShowReports] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    venue: '',
    category: 'Co-curricular',
    location: '',
    class: '',
    department: user?.department || '', // Changed from array to string
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
      // First, fetch the events
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
          department
        `)
        .eq('created_by', user.uid)
        .eq('category', 'Co-curricular')
        .order('date', { ascending: false });

      if (eventsError) {
        console.error('Error fetching activities:', eventsError);
        throw new Error(`Failed to fetch activities: ${eventsError.message}`);
      }

      // Then, fetch enrollment counts for each event
      const activitiesWithCount = await Promise.all(
        eventsData.map(async (activity) => {
          const { count, error: countError } = await supabase
            .from('enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', activity.event_id);

          if (countError) {
            console.error('Error fetching enrollment count:', countError);
            return {
              ...activity,
              category: 'Co-curricular',
              created_by: user.uid,
              enrolled_students: 0,
            } as Activity;
          }

          return {
            ...activity,
            category: 'Co-curricular',
            created_by: user.uid,
            enrolled_students: count || 0,
          } as Activity;
        })
      );

      setActivities(activitiesWithCount);
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
      const { data: newEvent, error } = await supabase.from('events').insert({
        ...formData,
        created_by: user.uid,
        status: 'upcoming'
      }).select().single();

      if (error) {
        console.error('Error creating activity:', error);
        throw new Error(`Failed to create activity: ${error.message}`);
      }

      // Send notifications to all students in the department
      await sendNotificationsToStudents(newEvent);

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
        department: user?.department || '', // String value
      });
      await fetchActivities();
    } catch (err: any) {
      console.error('Activity creation error:', err);
      setError(err.message || 'An unexpected error occurred while creating the activity.');
    } finally {
      setIsLoading(false);
    }
  };

  const sendNotificationsToStudents = async (event: any) => {
    try {
      // Get all students in the department
      const { data: students, error } = await supabase
        .from('users')
        .select('user_id')
        .eq('role', 'Student')
        .eq('department', event.department);

      if (error || !students) {
        console.error('Error fetching students for notifications:', error);
        return;
      }

      // Create notifications for all students
      const notifications = students.map(student => ({
        user_id: student.user_id,
        event_id: event.event_id,
        title: 'New Co-curricular Activity',
        message: `A new activity "${event.title}" has been created. Date: ${format(new Date(event.date), 'MMM dd, yyyy')} at ${event.time}. Venue: ${event.venue}`,
        type: 'event_created' as const,
        is_read: false
      }));

      await sendBulkNotifications(notifications);
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  };

  const updateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !selectedActivity) {
      setError('User not logged in or no activity selected');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const updateData = {
        title: formData.title,
        description: formData.description,
        date: formData.date || selectedActivity.date,
        time: formData.time,
        venue: formData.venue,
        location: formData.location,
        category: formData.category,
        class: formData.class,
        department: formData.department, // String value
      };

      const { error } = await supabase
        .from('events')
        .update(updateData)
        .eq('event_id', selectedActivity.event_id)
        .eq('created_by', user.uid);

      if (error) {
        console.error('Error updating activity:', error);
        throw new Error(`Failed to update activity: ${error.message}`);
      }

      setShowEditForm(false);
      setSelectedActivity(null);
      setFormData({
        title: '',
        description: '',
        date: '',
        time: '',
        venue: '',
        category: 'Co-curricular',
        location: '',
        class: '',
        department: user?.department || '', // String value
      });
      await fetchActivities();
    } catch (err: any) {
      console.error('Activity update error:', err);
      setError(err.message || 'An unexpected error occurred while updating the activity.');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteActivity = async (eventId: string) => {
    if (!user?.uid) {
      setError('User not logged in');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('event_id', eventId)
        .eq('created_by', user.uid);

      if (error) {
        console.error('Error deleting activity:', error);
        throw new Error(`Failed to delete activity: ${error.message}`);
      }

      await fetchActivities();
    } catch (err: any) {
      console.error('Activity deletion error:', err);
      setError(err.message || 'An unexpected error occurred while deleting the activity.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (activity: Activity) => {
    setSelectedActivity(activity);
    setFormData({
      title: activity.title,
      description: activity.description,
      date: activity.date,
      time: activity.time,
      venue: activity.venue,
      category: activity.category,
      location: activity.location,
      class: activity.class,
      department: activity.department, // String value
    });
    setShowEditForm(true);
  };

  const fetchStudents = async (activity: Activity) => {
    setIsLoading(true);
    setError('');
    
    try {
      // First, get all enrolled students for this event
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('enrollments')
        .select('user_id')
        .eq('event_id', activity.event_id);

      if (enrollmentsError) {
        console.error('Error fetching enrollments:', enrollmentsError);
        throw new Error(`Failed to fetch enrollments: ${enrollmentsError.message}`);
      }

      if (!enrollmentsData || enrollmentsData.length === 0) {
        setStudents([]);
        setSelectedActivity(activity);
        setAttendance({});
        return;
      }

      // Get user details for enrolled students
      const enrolledUserIds = enrollmentsData.map(e => e.user_id);
      const { data: studentsData, error: studentsError } = await supabase
        .from('users')
        .select('user_id, name, uid, year, email')
        .eq('role', 'Student')
        .in('user_id', enrolledUserIds);

      if (studentsError) {
        console.error('Error fetching students:', studentsError);
        throw new Error(`Failed to fetch students: ${studentsError.message}`);
      }

      setStudents(studentsData || []);
      setSelectedActivity(activity);

      // Fetch existing attendance records
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
      setPendingAttendance(attendanceMap); // Initialize pending attendance with current data
    } catch (err: any) {
      console.error('Unexpected error:', err);
      setError(err.message || 'An unexpected error occurred while fetching students.');
    } finally {
      setIsLoading(false);
    }
  };

  const markAttendance = (studentId: string, isPresent: boolean) => {
    setPendingAttendance((prev) => ({
      ...prev,
      [studentId]: isPresent,
    }));
  };

  const submitAttendance = async () => {
    if (!selectedActivity || !user?.user_id) {
      setError('No activity selected or user not logged in');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Prepare all attendance records to be upserted
      const attendanceRecords = Object.entries(pendingAttendance).map(([studentId, isPresent]) => ({
        user_id: studentId,
        event_id: selectedActivity.event_id,
        status: isPresent ? 'Present' : 'Absent',
        marked_by: user.user_id,
      }));

      // Upsert all attendance records
      const { error } = await supabase
        .from('attendance')
        .upsert(attendanceRecords, { onConflict: 'user_id,event_id' });

      if (error) {
        console.error('Error submitting attendance:', error);
        throw new Error(`Failed to submit attendance: ${error.message}`);
      }

      // Update the main attendance state with pending changes
      setAttendance(pendingAttendance);
      
      // Send notifications to students about attendance being marked
      await sendAttendanceNotifications();
      
      // Show success message
      setError(''); // Clear any previous errors
      alert('Attendance submitted successfully!');
      
    } catch (err: any) {
      console.error('Attendance submission error:', err);
      setError(err.message || 'An unexpected error occurred while submitting attendance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendAttendanceNotifications = async () => {
    if (!selectedActivity) return;

    try {
      const notifications = Object.entries(pendingAttendance).map(([studentId, isPresent]) => ({
        user_id: studentId,
        event_id: selectedActivity.event_id,
        title: 'Attendance Marked',
        message: `Your attendance for "${selectedActivity.title}" has been marked as ${isPresent ? 'Present' : 'Absent'}.`,
        type: 'attendance_marked' as const,
        is_read: false
      }));

      await sendBulkNotifications(notifications);
    } catch (error) {
      console.error('Error sending attendance notifications:', error);
    }
  };

  const resetAttendance = () => {
    setPendingAttendance(attendance); // Reset to original saved state
  };

  // Check if there are unsaved changes
  const hasUnsavedChanges = () => {
    return JSON.stringify(pendingAttendance) !== JSON.stringify(attendance);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Co-curricular Activities</h1>
          <p className="text-sm sm:text-base text-gray-600">Manage and track student activities</p>
        </div>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowReports(!showReports)}
            className="bg-purple-600 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg flex items-center justify-center space-x-2 hover:bg-purple-700 transition-colors text-sm sm:text-base"
          >
            <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">{showReports ? 'Hide Reports' : 'View Reports'}</span>
            <span className="sm:hidden">{showReports ? 'Hide' : 'Reports'}</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg flex items-center justify-center space-x-2 hover:bg-blue-700 transition-colors text-sm sm:text-base"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Create Activity</span>
            <span className="sm:hidden">Create</span>
          </motion.button>
        </div>
      </div>

      {showReports && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200"
        >
          <EventReport />
        </motion.div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 sm:px-4 sm:py-3 rounded-lg text-xs sm:text-sm"
        >
          {error}
        </motion.div>
      )}

      {showCreateForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200"
        >
          <h2 className="text-lg sm:text-xl font-semibold mb-4">Create New Activity</h2>
          <form onSubmit={createActivity} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                placeholder="Class (e.g., 1, 2, 3)"
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
              <input
                type="text"
                placeholder="Department"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
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
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
              <button
                type="submit"
                disabled={isLoading}
                className="bg-blue-600 text-white px-4 py-2 sm:px-6 sm:py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm sm:text-base"
              >
                {isLoading ? 'Creating...' : 'Create Activity'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="bg-gray-200 text-gray-700 px-4 py-2 sm:px-6 sm:py-2 rounded-lg hover:bg-gray-300 transition-colors text-sm sm:text-base"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {showEditForm && selectedActivity && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200"
        >
          <h2 className="text-lg sm:text-xl font-semibold mb-4">Edit Activity</h2>
          <form onSubmit={updateActivity} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                placeholder="Class (e.g., 1, 2, 3)"
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
              <input
                type="text"
                placeholder="Department"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
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
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
              <button
                type="submit"
                disabled={isLoading}
                className="bg-blue-600 text-white px-4 py-2 sm:px-6 sm:py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm sm:text-base"
              >
                {isLoading ? 'Updating...' : 'Update Activity'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEditForm(false);
                  setSelectedActivity(null);
                  setFormData({
                    title: '',
                    description: '',
                    date: '',
                    time: '',
                    venue: '',
                    category: 'Co-curricular',
                    location: '',
                    class: '',
                    department: user?.department || '', // String value
                  });
                }}
                className="bg-gray-200 text-gray-700 px-4 py-2 sm:px-6 sm:py-2 rounded-lg hover:bg-gray-300 transition-colors text-sm sm:text-base"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="space-y-3 sm:space-y-4">
        {activities.map((activity) => (
          <motion.div
            key={activity.event_id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200"
          >
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-3 sm:space-y-0 sm:mb-4">
              <div className="flex-1">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-800">{activity.title}</h3>
                <p className="text-sm sm:text-base text-gray-600 mt-1">{activity.description}</p>
                <p className="text-xs sm:text-sm text-gray-600 mt-2">Enrolled Students: {activity.enrolled_students || 0}</p>
              </div>
              <div className="flex flex-wrap gap-2 sm:space-x-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleEditClick(activity)}
                  className="bg-blue-100 text-blue-600 px-2 py-1 sm:px-3 sm:py-1 rounded text-xs sm:text-sm hover:bg-blue-200 transition-colors flex items-center space-x-1"
                >
                  <Edit2 className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>Edit</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => deleteActivity(activity.event_id)}
                  className="bg-red-100 text-red-600 px-2 py-1 sm:px-3 sm:py-1 rounded text-xs sm:text-sm hover:bg-red-200 transition-colors flex items-center space-x-1"
                >
                  <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>Delete</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => fetchStudents(activity)}
                  className="bg-teal-100 text-teal-600 px-2 py-1 sm:px-3 sm:py-1 rounded text-xs sm:text-sm hover:bg-teal-200 transition-colors flex items-center space-x-1"
                >
                  <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>Attendance</span>
                </motion.button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-6 text-xs sm:text-sm text-gray-600">
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

      {selectedActivity && !showEditForm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl shadow-xl p-4 sm:p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
          >
            <h2 className="text-lg sm:text-xl font-semibold mb-4">
              Mark Attendance - {selectedActivity.title}
            </h2>

            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading enrolled students...</p>
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 text-lg">No students have enrolled for this activity yet.</p>
                <p className="text-gray-500 text-sm mt-2">Students need to enroll before you can mark their attendance.</p>
              </div>
            ) : (
              <>
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-blue-800 text-sm">
                    <strong>{students.length}</strong> student{students.length !== 1 ? 's' : ''} enrolled
                  </p>
                </div>
                
                <div className="space-y-3">
                  {students.map((student) => (
                    <div
                      key={student.user_id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-gray-800">{student.name}</p>
                        <p className="text-sm text-gray-600">
                          UID: {student.uid} | Year: {student.year}
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-3">
                        <button
                          onClick={() => markAttendance(student.user_id, true)}
                          className={`px-3 py-1 sm:px-4 sm:py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm ${
                            pendingAttendance[student.user_id] === true
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                          }`}
                        >
                          Present
                        </button>
                        <button
                          onClick={() => markAttendance(student.user_id, false)}
                          className={`px-3 py-1 sm:px-4 sm:py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm ${
                            pendingAttendance[student.user_id] === false
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
              </>
            )}

            {students.length > 0 && (
              <div className="mt-6 space-y-3">
                {hasUnsavedChanges() && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-800 text-sm">
                      ⚠️ You have unsaved changes. Click "Submit Attendance" to save them.
                    </p>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                  <button
                    onClick={submitAttendance}
                    disabled={isSubmitting || !hasUnsavedChanges()}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm sm:text-base"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Attendance'}
                  </button>
                  <button
                    onClick={resetAttendance}
                    disabled={isSubmitting || !hasUnsavedChanges()}
                    className="bg-gray-200 text-gray-700 px-4 py-2 sm:px-6 sm:py-3 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm sm:text-base"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setSelectedActivity(null)}
                    className="bg-gray-600 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-lg hover:bg-gray-700 transition-colors font-medium text-sm sm:text-base"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {students.length === 0 && (
              <button
                onClick={() => setSelectedActivity(null)}
                className="mt-6 bg-gray-600 text-white px-4 py-2 sm:px-6 sm:py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm sm:text-base"
              >
                Close
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default FacultyCC;