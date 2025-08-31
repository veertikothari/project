import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings,  Eye,  Clock,  CheckCircle,  Plus,  Calendar, MapPin,   Users,  Edit2,  Trash2,  FileText,} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import jsPDF from "jspdf"
import EventReport from './EventReport';

type CEPRequirement = {
  year: string;
  hours_required: number;
  deadline: string | null;
  department: string;
};

type StudentSubmission = {
  user_id: string;
  name: string;
  uid: string;
  year: string;
  department: string;
  total_hours: number;
  submissions: Array<{
    submission_id: string;
    hours: number;
    file_url: string;
    submitted_at: string;
    approved: boolean;
  }>;
};

type Activity = {
  event_id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  category: string;
  created_by: string;
  class: string;
  department: string;
  enrolled_students?: number;
  hasAttendance?: boolean;
  maxPoints?: number;
};

type Student = {
  user_id: string;
  name: string;
  uid: string;
  year: string;
  email: string;
};

const FacultyCEP = () => {
  const { user } = useAuth();
  const [requirements, setRequirements] = useState<CEPRequirement[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [showRequirementForm, setShowRequirementForm] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<StudentSubmission | null>(null);

  // Activity management states
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
  const getCurrentDate = (): string => new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    year: '1',
    hours_required: 20,
    deadline: '',
    department: user?.department || '',
  });

  // Activity form data
  const [activityFormData, setActivityFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    venue: '',
    category: 'CEP',
    class: '',
    department: user?.department || '',
    maxPoints: 0,
  });

  useEffect(() => {
    if (!user?.department) {
      console.error('User department not found');
      return;
    }
    fetchRequirements();
    fetchSubmissions();
    if (user?.uid) {
      fetchActivities();
    }
  }, [user?.department, user?.uid]);

  const fetchRequirements = async () => {
    if (!user?.department) {
      console.error('User department not found');
      return;
    }

    const { data, error } = await supabase
      .from('cep_requirements')
      .select('*')
      .eq('department', user.department)
      .order('year');

    if (!error && data) {
      setRequirements(data);
    } else {
      console.error('Error fetching requirements:', error);
    }
  };

  const fetchSubmissions = async () => {
    if (!user?.department) {
      console.error('User department not found');
      return;
    }

    const { data: studentsData, error: studentsError } = await supabase
      .from('users')
      .select('user_id, name, uid, year, department')
      .eq('role', 'Student')
      .eq('department', user.department);

    if (studentsError || !studentsData) {
      console.error('Error fetching students:', studentsError);
      return;
    }

    const submissionsWithStudents = await Promise.all(
      studentsData.map(async (student) => {
        const { data: submissionData } = await supabase
          .from('cep_submissions')
          .select('submission_id, hours, file_url, submitted_at, approved')
          .eq('user_id', student.user_id);

        const totalHours = submissionData?.reduce((sum, sub) => 
          sub.approved === true || sub.approved === "true" ? sum + (sub.hours || 0) : sum, 0);

        return {
          ...student,
          total_hours: totalHours,
          submissions: submissionData || [],
        };
      })
    );

    setSubmissions(submissionsWithStudents);
  };

  const handleApproval = async (submissionId: string, approve: boolean) => {
  const { error } = await supabase
    .from('cep_submissions')
    .update({ approved: approve })
    .eq('submission_id', submissionId);

  if (error) {
    console.error("Error updating approval:", error);
  } else {
    fetchSubmissions(); // refresh data
  }
};


  const updateRequirement = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.department) {
      console.error('User department not found');
      return;
    }

    const { error } = await supabase
      .from('cep_requirements')
      .upsert({
        ...formData,
        department: user.department,
      });

    if (!error) {
      setShowRequirementForm(false);
      fetchRequirements();
      setFormData({
        year: '1',
        hours_required: 20,
        deadline: '',
        department: user.department,
      });
    } else {
      console.error('Error updating requirement:', error);
    }
  };

  // Activity management functions
  const fetchActivities = async () => {
    if (!user?.uid) {
      setError('User not logged in');
      return;
    }

    try {
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
        .eq('category', 'CEP')
        .order('date', { ascending: false });

      if (eventsError) {
        console.error('Error fetching activities:', eventsError);
        throw new Error(`Failed to fetch activities: ${eventsError.message}`);
      }

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
              category: 'CEP',
              created_by: user.uid,
              enrolled_students: 0,
            } as Activity;
          }
          // Check if attendance is marked
          const { data: attendanceData } = await supabase
            .from('attendance')
            .select('user_id')
            .eq('event_id', activity.event_id)
            .limit(1); // Check if any attendance exists

          return {
            ...activity,
            category: 'CEP',
            created_by: user.uid,
            enrolled_students: count || 0,
            hasAttendance: attendanceData && attendanceData.length > 0,
          } as Activity & { hasAttendance: boolean };
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
      const { error } = await supabase.from('events').insert({
        ...activityFormData,
        created_by: user.uid,
      });

      if (error) {
        console.error('Error creating activity:', error);
        throw new Error(`Failed to create activity: ${error.message}`);
      }

      setShowCreateForm(false);
      setActivityFormData({
        title: '',
        description: '',
        date: '',
        time: '',
        venue: '',
        category: 'CEP',
        maxPoints: 0,
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
        title: activityFormData.title,
        description: activityFormData.description,
        date: activityFormData.date,
        time: activityFormData.time,
        venue: activityFormData.venue,
        maxPoints: activityFormData.maxPoints,
        category: activityFormData.category,
        class: activityFormData.class,
        department: activityFormData.department,
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
      setActivityFormData({
        title: '',
        description: '',
        date: '',
        time: '',
        venue: '',
        category: 'CEP',
        maxPoints: 0,
        class: '',
        department: user?.department || '',
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
    setActivityFormData({
      title: activity.title,
      description: activity.description,
      date: activity.date || '',
      time: activity.time,
      venue: activity.venue,
      category: activity.category,
      maxPoints: activity.maxPoints || 0,
      class: activity.class,
      department: activity.department,
    });
    setShowEditForm(true);
  };

  const fetchStudents = async (activity: Activity) => {
    setIsLoading(true);
    setError('');

    try {
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

      const enrolledUserIds = enrollmentsData.map((e) => e.user_id);
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
      setPendingAttendance(attendanceMap);
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
      const attendanceRecords = Object.entries(pendingAttendance).map(([studentId, isPresent]) => ({
        user_id: studentId,
        event_id: selectedActivity.event_id,
        status: isPresent ? 'Present' : 'Absent',
        marked_by: user.user_id,
      }));

      const { error } = await supabase
        .from('attendance')
        .upsert(attendanceRecords, { onConflict: 'user_id,event_id' });

      if (error) {
        console.error('Error submitting attendance:', error);
        throw new Error(`Failed to submit attendance: ${error.message}`);
      }

      setAttendance(pendingAttendance);
      setError(''); // Clear any previous errors
      alert('Attendance submitted successfully!');
    } catch (err: any) {
      console.error('Attendance submission error:', err);
      setError(err.message || 'An unexpected error occurred while submitting attendance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAttendance = () => {
    setPendingAttendance(attendance);
  };

  const hasUnsavedChanges = () => {
    return JSON.stringify(pendingAttendance) !== JSON.stringify(attendance);
  };

  if (!user?.department) {
    return (
      <div className="text-red-600 p-6 text-center">
        Error: Faculty department not found. Please contact support.
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
        {/* <div>
          <h1 className="text-2xl font-bold text-gray-800">Community Engagement Program - {user.department}</h1>
          <p className="text-gray-600 text-sm">Manage social service requirements and track student progress</p>
        </div> */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowRequirementForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors w-full md:w-auto"
        >
          <Settings className="w-5 h-5" />
          <span>Set Requirements</span>
        </motion.button>
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
      </div>
        {showReports && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200"
        >
          <EventReport category='CEP'/>
        </motion.div>
      )}

      {/* Current Requirements */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl p-6 border border-teal-200"
      >
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Current Requirements by Year</h2>
        {requirements.length === 0 ? (
          <div className="text-gray-600 text-center py-4">No requirements set for {user.department}.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {requirements.map((req) => (
              <div key={req.year} className="bg-white rounded-lg p-4 border border-teal-100 shadow-sm">
                <div className="text-sm text-gray-600">Year {req.year}</div>
                <div className="text-2xl font-bold text-teal-600">{req.hours_required} hrs</div>
                {req.deadline && (
                  <div className="text-sm text-gray-600 mt-1">
                    Due: {new Date(req.deadline).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Requirements Form */}
      {showRequirementForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 max-w-4xl mx-auto mt-6"
        >
          <h2 className="text-xl font-semibold mb-4">Set Requirements</h2>
          <form onSubmit={updateRequirement} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                <select
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="1">Year 1</option>
                  <option value="2">Year 2</option>
                  <option value="3">Year 3</option>
                  <option value="4">Year 4</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hours Required</label>
                <input
                  type="number"
                  value={formData.hours_required}
                  onChange={(e) => setFormData({ ...formData, hours_required: parseInt(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Deadline</label>
                <input
                  type="date"
                  value={formData.deadline}
                  min={getCurrentDate()}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save Requirements
              </button>
              <button
                type="button"
                onClick={() => setShowRequirementForm(false)}
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* CEP Activities Section */}
      <div className="flex justify-between items-center flex-col md:flex-row space-y-4 md:space-y-0 p-6 bg-gray-100 rounded-lg">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">CEP Activities</h2>
          <p className="text-gray-600 text-sm">Manage community engagement activities</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors w-full md:w-auto"
        >
          <Plus className="w-5 h-5" />
          <span>Create Activity</span>
        </motion.button>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm text-center"
        >
          {error}
        </motion.div>
      )}

      {showCreateForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 max-w-4xl mx-auto mt-6"
        >
          <h2 className="text-xl font-semibold mb-4">Create New CEP Activity</h2>
          <form onSubmit={createActivity} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Activity Title"
                value={activityFormData.title}
                onChange={(e) => setActivityFormData({ ...activityFormData, title: e.target.value })}
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <input
                type="text"
                placeholder="Class (e.g., 1, 2, 3, 4)"
                value={activityFormData.class}
                onChange={(e) => setActivityFormData({ ...activityFormData, class: e.target.value })}
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <input
                type="date"
                value={activityFormData.date}
                min= {getCurrentDate()}
                onChange={(e) => setActivityFormData({ ...activityFormData, date: e.target.value })}
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <input
                type="time"
                value={activityFormData.time}
                onChange={(e) => setActivityFormData({ ...activityFormData, time: e.target.value })}
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <input
                type="text"
                placeholder="Venue"
                value={activityFormData.venue}
                onChange={(e) => setActivityFormData({ ...activityFormData, venue: e.target.value })}
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <input
                type="text"
                placeholder="Department"
                value={activityFormData.department}
                onChange={(e) => setActivityFormData({ ...activityFormData, department: e.target.value })}
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Maximum Points *</label>
                <input
                  type="number"
                  value={activityFormData.maxPoints}
                  onChange={(e) => setFormData({ ...activityFormData, maxPoints: parseInt(e.target.value) || 0 })}
                  min="0"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                />
              </div>
            <textarea
              placeholder="Activity Description"
              value={activityFormData.description}
              onChange={(e) => setActivityFormData({ ...activityFormData, description: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <div className="flex justify-end space-x-3">
              <button
                type="submit"
                disabled={isLoading}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
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

      {showEditForm && selectedActivity && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 max-w-4xl mx-auto mt-6"
        >
          <h2 className="text-xl font-semibold mb-4">Edit CEP Activity</h2>
          <form onSubmit={updateActivity} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Activity Title"
                value={activityFormData.title}
                onChange={(e) => setActivityFormData({ ...activityFormData, title: e.target.value })}
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <input
                type="text"
                placeholder="Class (e.g., 1, 2, 3, 4)"
                value={activityFormData.class}
                onChange={(e) => setActivityFormData({ ...activityFormData, class: e.target.value })}
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <input
                type="date"
                value={activityFormData.date}
                min={getCurrentDate()}
                onChange={(e) => setActivityFormData({ ...activityFormData, date: e.target.value })}
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <input
                type="time"
                value={activityFormData.time}
                onChange={(e) => setActivityFormData({ ...activityFormData, time: e.target.value })}
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <input
                type="text"
                placeholder="Venue"
                value={activityFormData.venue}
                onChange={(e) => setActivityFormData({ ...activityFormData, venue: e.target.value })}
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <input
                type="text"
                placeholder="Department"
                value={activityFormData.department}
                onChange={(e) => setActivityFormData({ ...activityFormData, department: e.target.value })}
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Points *</label>
                <input
                  type="number"
                  value={activityFormData.maxPoints || 0}
                  onChange={(e) => setFormData({ ...activityFormData, maxPoints: parseInt(e.target.value) || 0 })}
                  min="0"
                  required
                  className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            <textarea
              placeholder="Activity Description"
              value={activityFormData.description}
              onChange={(e) => setActivityFormData({ ...activityFormData, description: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <div className="flex justify-end space-x-3">
              <button
                type="submit"
                disabled={isLoading}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Updating...' : 'Update Activity'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEditForm(false);
                  setSelectedActivity(null);
                  setActivityFormData({
                    title: '',
                    description: '',
                    date: '',
                    time: '',
                    venue: '',
                    category: 'CEP',
                    maxPoints: 0,
                    class: '',
                    department: user?.department || '',
                  });
                }}
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Activities List */}
      <div className="space-y-3 sm:space-y-4">
            {activities.map((activity) => (
              <motion.div
                key={activity.event_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200 ${
                  !activity.hasAttendance && new Date(activity.date) > new Date()
                    ? 'border-yellow-300 bg-yellow-50'
                    : ''
                }`}
              >
            <div className="flex flex-col md:flex-row justify-between items-start mb-4 space-y-4 md:space-y-0">
              <div>
                <h3 className="text-xl font-semibold text-gray-800">{activity.title}</h3>
                <p className="text-gray-600 mt-1">{activity.description}</p>
                <p className="text-sm text-gray-600 mt-2">Enrolled Students: {activity.enrolled_students || 0}</p>
              </div>
              <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2">
                {!activity.hasAttendance && (
                  <>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleEditClick(activity)}
                  className="bg-blue-100 text-blue-600 px-3 py-1 rounded text-sm hover:bg-blue-200 transition-colors flex items-center space-x-1 w-full md:w-auto"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Edit</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => deleteActivity(activity.event_id)}
                  className="bg-red-100 text-red-600 px-3 py-1 rounded text-sm hover:bg-red-200 transition-colors flex items-center space-x-1 w-full md:w-auto"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </motion.button>
                  </>
                )}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => fetchStudents(activity)}
                  className="bg-teal-100 text-teal-600 px-3 py-1 rounded text-sm hover:bg-teal-200 transition-colors flex items-center space-x-1 w-full md:w-auto"
                >
                  <Users className="w-4 h-4" />
                  <span>Attendance</span>
                </motion.button>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6 text-sm text-gray-600">
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

      {/* Student Submissions */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">Student Submissions</h2>
        {submissions.length === 0 ? (
          <div className="text-gray-600 text-center py-4">No students found in {user.department}.</div>
        ) : (
          submissions.map((submission) => {
            const requirement = requirements.find((req) => req.year === submission.year);
            const requiredHours = requirement?.hours_required || 20;
            const isCompleted = submission.total_hours >= requiredHours;

            return (
              <motion.div
                key={submission.user_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col md:flex-row justify-between items-start mb-4 space-y-4 md:space-y-0">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">{submission.name}</h3>
                    <p className="text-gray-600 text-sm">UID: {submission.uid} | Year: {submission.year}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Progress</div>
                    <div className={`text-lg font-bold ${isCompleted ? 'text-green-600' : 'text-orange-600'}`}>
                      {submission.total_hours} / {requiredHours} hours
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        isCompleted ? 'bg-green-500' : 'bg-orange-500'
                      }`}
                      style={{ width: `${Math.min((submission.total_hours / requiredHours) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center">
                  <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4 md:mb-0">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>{submission.submissions.length} submissions</span>
                    </div>
                    {isCompleted && (
                      <div className="flex items-center space-x-1 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span>Completed</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedSubmission(submission)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors w-full md:w-auto"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View Details</span>
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Submission Details Modal */}
      {selectedSubmission && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto"
          >
            <h2 className="text-xl font-semibold mb-4">Submissions by {selectedSubmission.name}</h2>

            <div className="space-y-4">
              {selectedSubmission.submissions.map((sub) => (
                <div key={sub.submission_id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col md:flex-row justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-gray-800">Hours: {sub.hours}</p>
                      <p className="text-sm text-gray-600">
                        Submitted: {new Date(sub.submitted_at).toLocaleDateString()}
                      </p>
                    </div>
                    {/* {sub.file_url && (
                      <a
                        href={sub.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-blue-100 text-blue-600 px-3 py-1 rounded text-sm hover:bg-blue-200 transition-colors mt-2 md:mt-0"
                      >
                        View File
                      </a>
                    )} */}
                    {sub.file_url && (
  <div className="mt-3 space-y-2">
    {/* File preview */}
    {sub.file_url.endsWith(".pdf") ? (
      <iframe
        src={sub.file_url}
        className="w-full h-64 rounded border"
        title="PDF Preview"
      />
    ) : (
      <img
        src={sub.file_url}
        alt="Submission Preview"
        className="w-64 h-40 object-contain rounded border"
      />
    )}

    {/* Status */}
    <p className="text-sm">
      Status:{" "}
      {sub.approved === true
        ? "✅ Approved"
        : sub.approved === false
        ? "❌ Rejected"
        : "⏳ Pending"}
    </p>

    {/* Approval buttons */}
    <div className="flex gap-2">
      <button
        onClick={() => handleApproval(sub.submission_id, true)}
        className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
      >
        Approve
      </button>
      <button
        onClick={() => handleApproval(sub.submission_id, false)}
        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
      >
        Reject
      </button>
    </div>
  </div>
)}

                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setSelectedSubmission(null)}
              className="mt-6 bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors w-full md:w-auto"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}

      {/* Attendance Modal */}
      {selectedActivity && !showEditForm && (
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
            <h2 className="text-xl font-semibold mb-4">Mark Attendance - {selectedActivity.title}</h2>

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
                        <p className="text-sm text-gray-600">UID: {student.uid} | Year: {student.year}</p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => markAttendance(student.user_id, true)}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            pendingAttendance[student.user_id] === true
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                          }`}
                        >
                          Present
                        </button>
                        <button
                          onClick={() => markAttendance(student.user_id, false)}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
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
                    <p className="text-yellow-800 text-sm">⚠️ You have unsaved changes. Click "Submit Attendance" to save them.</p>
                  </div>
                )}
                <div className="flex space-x-3">
                  <button
                    onClick={submitAttendance}
                    disabled={isSubmitting || !hasUnsavedChanges()}
                    className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Attendance'}
                  </button>
                  <button
                    onClick={resetAttendance}
                    disabled={isSubmitting || !hasUnsavedChanges()}
                    className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setSelectedActivity(null)}
                    className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {students.length === 0 && (
              <button
                onClick={() => setSelectedActivity(null)}
                className="mt-6 bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors"
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

export default FacultyCEP;