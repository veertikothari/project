import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Calendar, MapPin, CheckCircle, XCircle, Clock, Bell } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { format } from 'date-fns'

type Activity = {
  event_id: string
  title: string
  description: string
  date: string
  time: string
  venue: string
  category: string
  location: string
  attendance_status?: 'Present' | 'Absent' | null
  is_enrolled?: boolean
}

const StudentCC = () => {
  const { user } = useAuth()
  const { sendNotification } = useNotifications()
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchActivities()
  }, [])

  const fetchActivities = async () => {
    if (!user) return

    setIsLoading(true)
    
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('category', 'Co-curricular')
      .eq('department', user.department)
      .order('date', { ascending: false })

    if (eventsError) {
      setIsLoading(false)
      return
    }

    if (eventsData) {
      const activitiesWithEnrollment = await Promise.all(
        eventsData.map(async (activity) => {
          const { data: attendanceData } = await supabase
            .from('attendance')
            .select('status')
            .eq('event_id', activity.event_id)
            .eq('user_id', user.user_id)
            .single()
          
          const { data: enrollmentData } = await supabase
          .from('enrollments')
          .select('enrollment_id')
          .eq('event_id', activity.event_id)
          .eq('user_id', user.user_id)
          .single();

          return {
            ...activity,
            attendance_status: attendanceData?.status || null,
            is_enrolled: !!enrollmentData,
          }
        })
      )

      setActivities(activitiesWithEnrollment)
    }
    
    setIsLoading(false)
  }

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

      // Send enrollment confirmation notification
      const activity = activities.find(a => a.event_id === eventId);
      if (activity) {
        await sendNotification({
          user_id: user.user_id,
          event_id: eventId,
          title: 'Enrollment Confirmed',
          message: `You have successfully enrolled for "${activity.title}". Don't forget to attend on ${format(new Date(activity.date), 'MMM dd, yyyy')} at ${activity.time}.`,
          type: 'enrollment_confirmed',
          is_read: false
        });
      }
    }
    await fetchActivities(); // Refresh the list
  } catch (err: any) {
    alert(`Error updating enrollment: ${err.message || 'Please try again.'}`);
  } finally {
    setIsLoading(false);
  }
};

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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 ">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">My Co-curricular Activities</h1>
        <p className="text-gray-600">View your assigned activities and attendance status</p>
      </div>

      <div className="space-y-4">
        {activities.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-lg p-8 text-center border border-gray-200"
          >
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-800 mb-2">No Activities Yet</h3>
            <p className="text-gray-600">Check back later for upcoming co-curricular activities.</p>
          </motion.div>
        ) : (
          activities.map((activity, index) => (
            <motion.div
              key={activity.event_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-lg p-6 border border-gray-200"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">{activity.title}</h3>
                  <p className="text-gray-600 mb-3">{activity.description}</p>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>{format(new Date(activity.date), 'MMM dd, yyyy')} at {activity.time}</span>
                    </div>
                    {activity.venue && (
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <MapPin className="w-4 h-4" />
                        <span>{activity.venue}</span>
                        {activity.location && <span> - {activity.location}</span>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end space-y-2">
                <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg font-medium ${getAttendanceColor(activity.attendance_status)}`}>
                  {getAttendanceIcon(activity.attendance_status)}
                  <span>{getAttendanceText(activity.attendance_status)}</span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleEnroll(activity.event_id, !!activity.is_enrolled)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activity.is_enrolled
                      ? 'bg-red-100 text-red-600 hover:bg-red-200'
                      : 'bg-green-100 text-green-600 hover:bg-green-200'
                  }`}
                >
                  {activity.is_enrolled ? 'Unenroll' : 'Enroll'}
                </motion.button>
              </div>
            </div>
          </motion.div>
          ))
        )}
      </div>

      {activities.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 "
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Attendance Summary</h3>
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
    </div>
  )
}

export default StudentCC