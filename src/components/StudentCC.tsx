import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Calendar, MapPin, CheckCircle, XCircle, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { format } from 'date-fns'
import jsPDF from "jspdf"

type Activity = {
  event_id: string
  title: string
  description: string
  date: string
  time: string
  venue: string
  type: string
  created_by: string
  //category: string
  //location: string
  attendance_status?: 'Present' | 'Absent' | null
  is_enrolled?: boolean
  maxPoints?: number
  feedbackSubmitted?: boolean
  earned_points?: number
  rating?: number | null
  comments?: string | null

}

const StudentCC = () => {
  const { user } = useAuth()
  const { sendNotification } = useNotifications()
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showFeedback, setShowFeedback] = useState<{ [key: string]: boolean }>({})
  const [feedback, setFeedback] = useState<{ eventId: string; rating: number; comments: string }>({
    eventId: '',
    rating: 0,
    comments: '',
  })
  const [feedbackError, setFeedbackError] = useState('')

  // --- Progress Bar Section ---
  // Group by category/type (here using category)
  const typeColors: Record<string, string> = {
    NCC: 'bg-blue-500',
    Technical: 'bg-green-500',
    Competition: 'bg-purple-500',
    Sports: 'bg-yellow-500',
    Cultural: 'bg-pink-500',
    Other: 'bg-gray-400',
  }
  const grouped: Record<string, Activity[]> = activities.reduce((acc, act) => {
    const key = act.type || 'Other'
    if (!acc[key]) acc[key] = []
    acc[key].push(act)
    return acc
  }, {} as Record<string, Activity[]>)

  const ProgressBar: React.FC<{ type: string; attended: number; total: number }> = ({ type, attended, total }) => {
    const percent = total > 0 ? (attended / total) * 100 : 0
    const color = typeColors[type] || typeColors.Other
    return (
      <div className="mb-2">
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium text-blue-700">{type}</span>
          <span className="text-xs text-gray-500">{attended}/{total}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`${color} h-3 rounded-full transition-all`}
            style={{ width: `${percent}%` }}
          ></div>
        </div>
      </div>
    )
  }

  useEffect(() => {
    fetchActivities()
  }, [])

  const fetchActivities = async () => {
    if (!user) {
      console.log('No user logged in')
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    try {
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('category', 'Co-curricular')
        .eq('department', user.department)
        .order('date', {ascending: false})

      if (eventsError) {
        console.error('Error fetching events:', eventsError.message)
        setIsLoading(false)
        return
      }

      if (eventsData) {
        const activitiesWithEnrollment = await Promise.all(
          eventsData.map(async (activity) => {
            try {
              const { data: attendanceData } = await supabase
                .from('attendance')
                .select('status, created_at')
                .eq('event_id', activity.event_id)
                .eq('user_id', user.user_id)
                .order('created_at', { ascending: false })

              const attendanceStatus = Array.isArray(attendanceData) && attendanceData.length > 0 ? attendanceData[0].status : null

              const { data: enrollmentData } = await supabase
                .from('enrollments')
                .select('enrollment_id')
                .eq('event_id', activity.event_id)
                .eq('user_id', user.user_id)
                .maybeSingle()

              const { data: feedbackData } = await supabase
                .from('feedback')
                .select('rating, comments')
                .eq('event_id', activity.event_id)
                .eq('user_id', user.user_id)
                .maybeSingle()

              return {
                ...activity,
                attendance_status: attendanceStatus,
                is_enrolled: !!enrollmentData,
                feedbackSubmitted: !!feedbackData,
                rating: feedbackData?.rating || null,
                comments: feedbackData?.comments || null,
              }
            } catch (err) {
              console.error('Error mapping activity', activity.event_id, ':', err)
              return { ...activity, attendance_status: null, is_enrolled: false, feedbackSubmitted: false }
            }
          })
        )

        setActivities(activitiesWithEnrollment)
      }
    } catch (err) {
      console.error('Overall fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEnroll = async (eventId: string, isCurrentlyEnrolled: boolean) => {
    if (!user?.user_id) return

    setIsLoading(true)
    try {
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('status')
        .eq('event_id', eventId)
        .eq('user_id', user.user_id)
        .maybeSingle()

      if (attendanceData?.status && isCurrentlyEnrolled) {
        alert('Cannot unenroll as attendance has already been marked.')
        return
      }
      if (isCurrentlyEnrolled) {
        const { error } = await supabase
          .from('enrollments')
          .delete()
          .eq('event_id', eventId)
          .eq('user_id', user.user_id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('enrollments')
          .insert({ event_id: eventId, user_id: user.user_id })
        if (error) throw error

        const activity = activities.find(a => a.event_id === eventId)
        if (activity) {
          await sendNotification({
            user_id: user.user_id,
            event_id: eventId,
            title: 'Enrollment Confirmed',
            message: `You have successfully enrolled for "${activity.title}". Don't forget to attend on ${format(new Date(activity.date), 'MMM dd, yyyy')} at ${activity.time}.`,
            type: 'enrollment_confirmed',
            is_read: false
          })
        }
      }
      await fetchActivities()
    } catch (err: any) {
      alert(`Error updating enrollment: ${err.message || 'Please try again.'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const submitFeedback = async (eventId: string) => {
  if (!feedback.rating || !feedback.comments.trim()) {
    setFeedbackError('Rating and comments are required')
    return
  }

  if (!user?.user_id) {
    setFeedbackError('User not authenticated')
    return
  }

  // Find the activity to check attendance status
  const activity = activities.find(a => a.event_id === eventId)
  if (activity?.attendance_status === 'Absent') {
    setFeedbackError('Feedback cannot be submitted for absent attendance')
    return
  }
  
  try {
    const { error } = await supabase.from('feedback').upsert(
      {
        event_id: eventId,
        user_id: user.user_id,
        rating: feedback.rating,
        comments: feedback.comments,
        submitted_at: new Date().toISOString(),
      },
      {
        onConflict: 'event_id,user_id',
        ignoreDuplicates: false,
      }
    )
    if (error) throw error

    setActivities((prev) =>
      prev.map((activity) =>
        activity.event_id === eventId
          ? { ...activity, feedbackSubmitted: true, earned_points: activity.maxPoints || 0 }
          : activity
      )
    )
    setShowFeedback((prev) => ({ ...prev, [eventId]: false }))
    setFeedback({ eventId: '', rating: 0, comments: '' })
    setFeedbackError('')
    alert('Feedback submitted successfully!')
  } catch (err: any) {
    setFeedbackError(err.message || 'Failed to submit feedback')
  }
}

  // Generate report for a single event
const generateEventReport = (activity: Activity) => {
  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.text("Event Report", 14, 20)

  doc.setFontSize(12)
  doc.text(`Title: ${activity.title}`, 14, 35)
  doc.text(`Description: ${activity.description || "N/A"}`, 14, 45)
  doc.text(`Date: ${format(new Date(activity.date), "MMM dd, yyyy")}`, 14, 55)
  doc.text(`Time: ${activity.time}`, 14, 65)
  doc.text(`Venue: ${activity.venue}`, 14, 75)
  doc.text(`Type: ${activity.type || "N/A"}`, 14, 85)
  doc.text(`Max Points: ${activity.maxPoints || 0}`, 14, 95)

  doc.text("Student Details", 14, 115)
  doc.text(`Attendance: ${activity.attendance_status || "Pending"}`, 14, 125)
  doc.text(`Earned Points: ${activity.maxPoints || 0}`, 14, 135)
  doc.text(`Rating: ${activity.rating || "Not submitted"}`, 14, 145)
  doc.text(`Comments: ${activity.comments || "Not submitted"}`, 14, 155)

  doc.save(`${activity.title}_report.pdf`)
}

// Generate combined report for all events
const generateCombinedReport = () => {
  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.text("Combined Event Report", 14, 20)

  let y = 35
  activities.forEach((activity, index) => {
    doc.setFontSize(14)
    doc.text(`${index + 1}. ${activity.title}`, 14, y)
    y += 8

    doc.setFontSize(11)
    doc.text(`Date: ${format(new Date(activity.date), "MMM dd, yyyy")} | Time: ${activity.time}`, 14, y)
    y += 6
    doc.text(`Venue: ${activity.venue}`, 14, y)
    y += 6
    doc.text(`Attendance: ${activity.attendance_status || "Pending"} | Earned Points: ${activity.maxPoints || 0}`, 14, y)
    y += 6
    doc.text(`Rating: ${activity.feedbackSubmitted ? activity.rating : "Not submitted"}`, 14, y)
    y += 6
    doc.text(`Comments: ${activity.feedbackSubmitted ? activity.comments : "Not submitted"}`, 14, y)
    y += 10

    // Move to new page if overflowing
    if (y > 260) {
      doc.addPage()
      y = 20
    }
  })

  doc.save("all_events_report.pdf")
}

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

const pendingActivities = activities.filter(a => !a.attendance_status)
const markedActivities = activities.filter(a => a.attendance_status)


  return (
  <div className="space-y-4 sm:space-y-6 pb-20">
    <div className="space-y-3 sm:space-y-4">
      {activities.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-6 sm:p-8 text-center border border-gray-200"
        >
          <Calendar className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-base sm:text-lg font-medium text-gray-800 mb-2">No Activities Yet</h3>
          <p className="text-sm sm:text-base text-gray-600">Check back later for upcoming co-curricular activities.</p>
        </motion.div>
      ) : (
        <>
          {/* Pending Attendance First */}
          {pendingActivities.map((activity, index) => (
            <motion.div
              key={activity.event_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-yellow-300 bg-yellow-50"
            >
            {
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-3 sm:space-y-0 sm:mb-4">
                <div className="flex-1">
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">{activity.title}</h3>
                  <p className="text-sm sm:text-base text-gray-600 mb-3">{activity.description}</p>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600">
                      <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span>{format(new Date(activity.date), 'MMM dd, yyyy')} at {activity.time}</span>
                    </div>
                    {activity.venue && (
                      <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600">
                        <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span>{activity.venue}</span>                        
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  {activity.attendance_status && (
                    <>
                      {activity.feedbackSubmitted && activity.maxPoints && (
                        <div className="text-sm sm:text-base text-gray-800">
                          Earned Points: {activity.maxPoints || 0}/{activity.maxPoints}
                        </div>
                      )}
                      {!activity.feedbackSubmitted && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setShowFeedback((prev) => ({ ...prev, [activity.event_id]: true }))}
                          className={`bg-blue-100 text-blue-600 px-2 py-1 sm:px-3 sm:py-1 rounded text-xs sm:text-sm hover:bg-blue-200 transition-colors ${
                            activity.attendance_status === 'Absent' ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          disabled={activity.attendance_status === 'Absent'}
                        >
                          Submit Feedback
                        </motion.button>
                      )}
                      <div className={`flex items-center space-x-2 px-2 py-1 sm:px-3 sm:py-2 rounded-lg font-medium text-xs sm:text-sm ${getAttendanceColor(activity.attendance_status)}`}>
                        {getAttendanceIcon(activity.attendance_status)}
                        <span>{getAttendanceText(activity.attendance_status)}</span>
                      </div>
                    </>
                  )}
                  {!activity.attendance_status && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleEnroll(activity.event_id, !!activity.is_enrolled)}
                      className={`px-3 py-1 sm:px-4 sm:py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm ${
                        activity.is_enrolled
                          ? 'bg-red-100 text-red-600 hover:bg-red-200'
                          : 'bg-green-100 text-green-600 hover:bg-green-200'
                      }`}
                    >
                      {activity.is_enrolled ? 'Unenroll' : 'Enroll'}
                    </motion.button>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => generateEventReport(activity)}
                    className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-lg text-xs sm:text-sm hover:bg-indigo-200 transition-colors"
                  >
                    Download Report
                  </motion.button>

                </div>
              </div>
                           
            }  

            </motion.div>
          ))}

          {/* Marked Attendance Below */}
          {markedActivities.map((activity, index) => (
            <motion.div
              key={activity.event_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200"
            >
              {/* your existing card content here */}
              {
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-3 sm:space-y-0 sm:mb-4">
                <div className="flex-1">
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">{activity.title}</h3>
                  <p className="text-sm sm:text-base text-gray-600 mb-3">{activity.description}</p>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600">
                      <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span>{format(new Date(activity.date), 'MMM dd, yyyy')} at {activity.time}</span>
                    </div>
                    {activity.venue && (
                      <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600">
                        <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span>{activity.venue}</span>                        
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  {activity.attendance_status && (
                    <>
                      {activity.feedbackSubmitted && activity.maxPoints && (
                        <div className="text-sm sm:text-base text-gray-800">
                          Earned Points: {activity.maxPoints || 0}/{activity.maxPoints}
                        </div>
                      )}
                      {!activity.feedbackSubmitted && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setShowFeedback((prev) => ({ ...prev, [activity.event_id]: true }))}
                          className={`bg-blue-100 text-blue-600 px-2 py-1 sm:px-3 sm:py-1 rounded text-xs sm:text-sm hover:bg-blue-200 transition-colors ${
                            activity.attendance_status === 'Absent' ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          disabled={activity.attendance_status === 'Absent'}
                        >
                          Submit Feedback
                        </motion.button>
                      )}
                      <div className={`flex items-center space-x-2 px-2 py-1 sm:px-3 sm:py-2 rounded-lg font-medium text-xs sm:text-sm ${getAttendanceColor(activity.attendance_status)}`}>
                        {getAttendanceIcon(activity.attendance_status)}
                        <span>{getAttendanceText(activity.attendance_status)}</span>
                      </div>
                    </>
                  )}
                  {!activity.attendance_status && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleEnroll(activity.event_id, !!activity.is_enrolled)}
                      className={`px-3 py-1 sm:px-4 sm:py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm ${
                        activity.is_enrolled
                          ? 'bg-red-100 text-red-600 hover:bg-red-200'
                          : 'bg-green-100 text-green-600 hover:bg-green-200'
                      }`}
                    >
                      {activity.is_enrolled ? 'Unenroll' : 'Enroll'}
                    </motion.button>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => generateEventReport(activity)}
                    className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-lg text-xs sm:text-sm hover:bg-indigo-200 transition-colors"
                  >
                    Download Report
                  </motion.button>
                </div>
              </div>
            } 
            </motion.div>
          ))}
        </>
      )}
    </div>
      <div className="flex justify-center mt-6">
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={generateCombinedReport}
    className="bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700"
  >
    Download Combined Report
  </motion.button>
</div>

    {activities.length > 0 && (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 sm:p-6 border border-blue-200"
      >
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">Attendance Summary</h3>
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="text-center">
            <div className="text-xl sm:text-2xl font-bold text-green-600">
              {activities.filter(a => a.attendance_status === 'Present').length}
            </div>
            <div className="text-xs sm:text-sm text-gray-600">Present</div>
          </div>
          <div className="text-center">
            <div className="text-xl sm:text-2xl font-bold text-red-600">
              {activities.filter(a => a.attendance_status === 'Absent').length}
            </div>
            <div className="text-xs sm:text-sm text-gray-600">Absent</div>
          </div>
          <div className="text-center">
            <div className="text-xl sm:text-2xl font-bold text-yellow-600">
              {activities.filter(a => !a.attendance_status).length}
            </div>
            <div className="text-xs sm:text-sm text-gray-600">Pending</div>
          </div>
        </div>
      </motion.div>
    )}

    {Object.keys(grouped).length > 0 && (
      <div className="bg-white rounded-xl shadow p-4 border border-gray-200 mb-2">
        <h3 className="text-base font-semibold text-gray-800 mb-2">Co-Curricular Progress</h3>
        <div className="w-full bg-gray-200 rounded-full h-4 flex overflow-hidden">
          {Object.entries(grouped).map(([type, acts]) => {
            const attended = (acts as Activity[]).filter((a) => a.attendance_status === 'Present').length
            const total = (acts as Activity[]).length
            const percent = total > 0 ? (attended / total) * 100 : 0
            const color = typeColors[type] || typeColors.Other

            return (
              <div
                key={type}
                className={`${color} h-4`}
                style={{ width: `${percent}%` }}
                title={`${type}: ${attended}/${total}`}
              />
            )
          })}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {Object.entries(grouped).map(([type, acts]) => {
            const attended = (acts as Activity[]).filter((a) => a.attendance_status === 'Present').length
            const total = (acts as Activity[]).length
            return (
              <span key={type} className="flex items-center text-xs text-gray-600">
                <span className={`inline-block w-3 h-3 rounded-full mr-1 ${typeColors[type] || typeColors.Other}`} />
                {type} ({attended}/{total})
              </span>
            )
          })}
        </div>
      </div>
    )}

    {/* Feedback Modal stays the same */}
    {Object.keys(showFeedback).map((eventId) => showFeedback[eventId] && (
      <motion.div
        key={eventId}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-xl shadow-xl p-4 sm:p-6 w-full max-w-md"
        >
          {/* feedback modal content */}
        </motion.div>
      </motion.div>
    ))}
  </div>
)

}

export default StudentCC