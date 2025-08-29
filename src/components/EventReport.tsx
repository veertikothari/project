import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FileText, Users, CheckCircle, XCircle, Clock, Download, Share2, Calendar } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format } from 'date-fns'

type EventReport = {
  report_id: string
  event_id: string | null
  faculty_id: string | null
  total_enrolled: number | null
  total_attended: number | null
  total_absent: number | null
  attendance_percentage: number | null
  event_summary: string | null
  feedback: string | null
  created_at: string | null
}

type Event = {
  event_id: string
  title: string
  description: string | null
  date: string
  time: string
  venue: string | null
  location: string | null
  class: string | null
  department: string | null
  status: string | null
}

type StudentAttendance = {
  user_id: string
  name: string
  uid: string
  year: string
  email: string
  status: 'Present' | 'Absent'
}

const EventReport = () => {
  const { user } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [report, setReport] = useState<EventReport | null>(null)
  const [students, setStudents] = useState<StudentAttendance[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showReportForm, setShowReportForm] = useState(false)
  const [formData, setFormData] = useState({
    event_summary: '',
    feedback: ''
  })

  useEffect(() => {
    if (user?.uid) {
      fetchEvents()
    }
  }, [user])

  const fetchEvents = async () => {
    if (!user?.uid) return

    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('created_by', user.uid)
        .eq('category', 'Co-curricular')
        .order('date', { ascending: false })

      if (error) {
        console.error('Error fetching events:', error)
        return
      }

      setEvents(data || [])
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchEventData = async (event: Event) => {
    setIsLoading(true)
    try {
      // Fetch enrolled students
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('enrollments')
        .select('user_id')
        .eq('event_id', event.event_id)

      if (enrollmentsError) {
        console.error('Error fetching enrollments:', enrollmentsError)
        return
      }

      const enrolledUserIds = enrollmentsData?.map(e => e.user_id) || []

      if (enrolledUserIds.length === 0) {
        setStudents([])
        setSelectedEvent(event)
        return
      }

      // Fetch student details and attendance
      const { data: studentsData, error: studentsError } = await supabase
        .from('users')
        .select('user_id, name, uid, year, email')
        .eq('role', 'Student')
        .in('user_id', enrolledUserIds)

      if (studentsError) {
        console.error('Error fetching students:', studentsError)
        return
      }

      // Fetch attendance records
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('user_id, status')
        .eq('event_id', event.event_id)

      if (attendanceError) {
        console.error('Error fetching attendance:', attendanceError)
        return
      }

      // Combine student data with attendance
      const studentsWithAttendance = studentsData?.map(student => {
        const attendance = attendanceData?.find(a => a.user_id === student.user_id)
        return {
          ...student,
          status: attendance?.status || 'Absent'
        }
      }) || []

      setStudents(studentsWithAttendance)
      setSelectedEvent(event)

      // Check if report already exists
      const { data: existingReport, error: reportError } = await supabase
        .from('event_reports')
        .select('*')
        .eq('event_id', event.event_id)
        .single()

      if (!reportError && existingReport) {
        setReport(existingReport)
      } else {
        setReport(null)
      }

    } catch (error) {
      console.error('Error fetching event data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const generateReport = async () => {
    if (!selectedEvent || !user?.user_id) return

    setIsGenerating(true)
    try {
      const totalEnrolled = students.length
      const totalAttended = students.filter(s => s.status === 'Present').length
      const totalAbsent = students.filter(s => s.status === 'Absent').length
      const attendancePercentage = totalEnrolled > 0 ? (totalAttended / totalEnrolled) * 100 : 0

      const reportData = {
        event_id: selectedEvent.event_id,
        faculty_id: user.user_id,
        total_enrolled: totalEnrolled,
        total_attended: totalAttended,
        total_absent: totalAbsent,
        attendance_percentage: Math.round(attendancePercentage * 100) / 100,
        event_summary: formData.event_summary,
        feedback: formData.feedback
      }

      const { data, error } = await supabase
        .from('event_reports')
        .insert(reportData)
        .select()
        .single()

      if (error) {
        console.error('Error generating report:', error)
        return
      }

      setReport(data)
      setShowReportForm(false)
      setFormData({ event_summary: '', feedback: '' })

      // Send notification to faculty
      await supabase.from('notifications').insert({
        user_id: user.user_id,
        event_id: selectedEvent.event_id,
        title: 'Event Report Generated',
        message: `Report for "${selectedEvent.title}" has been successfully generated.`,
        type: 'event_completed',
        is_read: false
      })

    } catch (error) {
      console.error('Error generating report:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadReport = () => {
    if (!report || !selectedEvent) return

    const reportContent = `
Event Report: ${selectedEvent.title}
Generated on: ${format(new Date(report.created_at || ''), 'MMM dd, yyyy HH:mm')}

Event Details:
- Title: ${selectedEvent.title}
- Date: ${format(new Date(selectedEvent.date), 'MMM dd, yyyy')}
- Time: ${selectedEvent.time}
- Venue: ${selectedEvent.venue || 'N/A'}
- Location: ${selectedEvent.location || 'N/A'}

Attendance Summary:
- Total Enrolled: ${report.total_enrolled}
- Total Attended: ${report.total_attended}
- Total Absent: ${report.total_absent}
- Attendance Percentage: ${report.attendance_percentage}%

Event Summary:
${report.event_summary || 'No summary provided'}

Feedback:
${report.feedback || 'No feedback provided'}

Student Attendance Details:
${students.map(student => 
  `${student.name} (${student.uid}) - ${student.status}`
).join('\n')}
    `.trim()

    const blob = new Blob([reportContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `event-report-${selectedEvent.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const shareReport = async () => {
    if (!report || !selectedEvent) return

    try {
      const shareData = {
        title: `Event Report: ${selectedEvent.title}`,
        text: `Event Report for ${selectedEvent.title} - Attendance: ${report.attendance_percentage}%`,
        url: window.location.href
      }

      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(shareData.text)
        alert('Report link copied to clipboard!')
      }
    } catch (error) {
      console.error('Error sharing report:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Event Reports</h1>
        <p className="text-gray-600">Generate comprehensive reports for completed events</p>
      </div>

      {/* Events List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.map((event) => (
          <motion.div
            key={event.event_id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => fetchEventData(event)}
            className={`bg-white rounded-xl shadow-lg p-6 border-2 cursor-pointer transition-all ${
              selectedEvent?.event_id === event.event_id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-800">{event.title}</h3>
              <FileText className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
              {event.description || 'No description available'}
            </p>
            <div className="space-y-1 text-sm text-gray-500">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4" />
                <span>{format(new Date(event.date), 'MMM dd, yyyy')}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>{event.time}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Event Details and Report */}
      {selectedEvent && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-6 border border-gray-200"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">{selectedEvent.title}</h2>
              <p className="text-gray-600">Event Report & Analytics</p>
            </div>
            {report && (
              <div className="flex space-x-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={downloadReport}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-green-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={shareReport}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </motion.button>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading event data...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-blue-600">{students.length}</div>
                  <div className="text-sm text-blue-600">Enrolled</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-green-600">
                    {students.filter(s => s.status === 'Present').length}
                  </div>
                  <div className="text-sm text-green-600">Present</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg text-center">
                  <XCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-red-600">
                    {students.filter(s => s.status === 'Absent').length}
                  </div>
                  <div className="text-sm text-red-600">Absent</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg text-center">
                  <Clock className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-purple-600">
                    {students.length > 0 
                      ? Math.round((students.filter(s => s.status === 'Present').length / students.length) * 100)
                      : 0}%
                  </div>
                  <div className="text-sm text-purple-600">Attendance</div>
                </div>
              </div>

              {/* Report Form or Existing Report */}
              {!report ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-800">Generate Report</h3>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowReportForm(!showReportForm)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {showReportForm ? 'Cancel' : 'Generate Report'}
                    </motion.button>
                  </div>

                  {showReportForm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-4 p-4 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Event Summary
                        </label>
                        <textarea
                          value={formData.event_summary}
                          onChange={(e) => setFormData({ ...formData, event_summary: e.target.value })}
                          rows={4}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Provide a summary of the event, key highlights, and outcomes..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Feedback & Recommendations
                        </label>
                        <textarea
                          value={formData.feedback}
                          onChange={(e) => setFormData({ ...formData, feedback: e.target.value })}
                          rows={3}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Share feedback, lessons learned, and recommendations for future events..."
                        />
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={generateReport}
                          disabled={isGenerating}
                          className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          {isGenerating ? 'Generating...' : 'Generate Report'}
                        </button>
                        <button
                          onClick={() => setShowReportForm(false)}
                          className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Generated Report</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-gray-800 mb-2">Event Summary</h4>
                      <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">
                        {report.event_summary || 'No summary provided'}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-800 mb-2">Feedback & Recommendations</h4>
                      <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">
                        {report.feedback || 'No feedback provided'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Student Attendance List */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Student Attendance</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {students.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No students enrolled for this event.</p>
                  ) : (
                    students.map((student) => (
                      <div
                        key={student.user_id}
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-800">{student.name}</p>
                          <p className="text-sm text-gray-600">UID: {student.uid} | Year: {student.year}</p>
                        </div>
                        <div className={`flex items-center space-x-2 px-3 py-1 rounded-lg font-medium ${
                          student.status === 'Present'
                            ? 'bg-green-100 text-green-600'
                            : 'bg-red-100 text-red-600'
                        }`}>
                          {student.status === 'Present' ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          <span>{student.status}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

export default EventReport