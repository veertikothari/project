import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Settings, Eye, Clock, CheckCircle, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

type CEPRequirement = {
  year: string
  hours_required: number
  deadline: string | null
}

type StudentSubmission = {
  user_id: string
  name: string
  uid: string
  year: string
  total_hours: number
  submissions: Array<{
    submission_id: string
    hours: number
    file_url: string
    submitted_at: string
  }>
}

const FacultyCEP = () => {
  const { user } = useAuth()
  const [requirements, setRequirements] = useState<CEPRequirement[]>([])
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([])
  const [showRequirementForm, setShowRequirementForm] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState<StudentSubmission | null>(null)
  const [formData, setFormData] = useState({
    year: '1',
    hours_required: 20,
    deadline: ''
  })

  useEffect(() => {
    fetchRequirements()
    fetchSubmissions()
  }, [])

  const fetchRequirements = async () => {
    const { data, error } = await supabase
      .from('cep_requirements')
      .select('*')
      .order('year')

    if (!error && data) {
      setRequirements(data)
    }
  }

  const fetchSubmissions = async () => {
    const { data: studentsData, error: studentsError } = await supabase
      .from('users')
      .select('user_id, name, uid, year')
      .eq('role', 'Student')

    if (studentsError || !studentsData) return

    const submissionsWithStudents = await Promise.all(
      studentsData.map(async (student) => {
        const { data: submissionData } = await supabase
          .from('cep_submissions')
          .select('*')
          .eq('user_id', student.user_id)

        const totalHours = submissionData?.reduce((sum, sub) => sum + (sub.hours || 0), 0) || 0

        return {
          ...student,
          total_hours: totalHours,
          submissions: submissionData || []
        }
      })
    )

    setSubmissions(submissionsWithStudents)
  }

  const updateRequirement = async (e: React.FormEvent) => {
    e.preventDefault()

    const { error } = await supabase
      .from('cep_requirements')
      .upsert(formData)

    if (!error) {
      setShowRequirementForm(false)
      fetchRequirements()
      setFormData({
        year: '1',
        hours_required: 20,
        deadline: ''
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Cultural Engagement Program</h1>
          <p className="text-gray-600">Manage social service requirements and track student progress</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowRequirementForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors"
        >
          <Settings className="w-5 h-5" />
          <span>Set Requirements</span>
        </motion.button>
      </div>

      {/* Current Requirements */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl p-6 border border-teal-200"
      >
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Current Requirements by Year</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {requirements.map((req) => (
            <div key={req.year} className="bg-white rounded-lg p-4 border border-teal-100">
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
      </motion.div>

      {/* Requirements Form */}
      {showRequirementForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-6 border border-gray-200"
        >
          <h2 className="text-xl font-semibold mb-4">Set Requirements</h2>
          <form onSubmit={updateRequirement} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                <select
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Deadline</label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex space-x-3">
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

      {/* Student Submissions */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">Student Submissions</h2>
        
        {submissions.map((submission) => {
          const requirement = requirements.find(req => req.year === submission.year)
          const requiredHours = requirement?.hours_required || 20
          const isCompleted = submission.total_hours >= requiredHours

          return (
            <motion.div
              key={submission.user_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-lg p-6 border border-gray-200"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{submission.name}</h3>
                  <p className="text-gray-600">UID: {submission.uid} | Year: {submission.year}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">Progress</div>
                  <div className={`text-lg font-bold ${isCompleted ? 'text-green-600' : 'text-orange-600'}`}>
                    {submission.total_hours} / {requiredHours} hours
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Progress</span>
                  <span className="text-sm font-medium">
                    {Math.round((submission.total_hours / requiredHours) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      isCompleted ? 'bg-green-500' : 'bg-orange-500'
                    }`}
                    style={{ width: `${Math.min((submission.total_hours / requiredHours) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4 text-sm text-gray-600">
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
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  <span>View Details</span>
                </button>
              </div>
            </motion.div>
          )
        })}
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
            <h2 className="text-xl font-semibold mb-4">
              Submissions by {selectedSubmission.name}
            </h2>
            
            <div className="space-y-4">
              {selectedSubmission.submissions.map((sub) => (
                <div key={sub.submission_id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-gray-800">Hours: {sub.hours}</p>
                      <p className="text-sm text-gray-600">
                        Submitted: {new Date(sub.submitted_at).toLocaleDateString()}
                      </p>
                    </div>
                    {sub.file_url && (
                      <a
                        href={sub.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-blue-100 text-blue-600 px-3 py-1 rounded text-sm hover:bg-blue-200 transition-colors"
                      >
                        View File
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setSelectedSubmission(null)}
              className="mt-6 bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}

export default FacultyCEP