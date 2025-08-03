import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { User, Mail, Phone, Building, Calendar, Hash, LogOut, Edit } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const Profile = () => {
  const { user, logout } = useAuth()
  const [isEditing, setIsEditing] = useState(false)

  if (!user) return null

  const handleLogout = () => {
    logout()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-4 pb-20 space-y-6"
    >
      {/* Header */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-4"
        >
          <User className="text-blue-600 w-12 h-12" />
        </motion.div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">{user.name}</h1>
        <p className="text-gray-600 capitalize">{user.role}</p>
      </div>

      {/* Profile Information */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-xl shadow-lg p-6 border border-gray-200"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-800">Profile Information</h2>
          
          {/*<button
            onClick={() => setIsEditing(!isEditing)}
            className="text-blue-600 hover:text-blue-700 flex items-center space-x-1"
          >
            <Edit className="w-4 h-4" />
            <span>{isEditing ? 'Cancel' : 'Edit'}</span>
          </button> */}

        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <Mail className="w-5 h-5 text-gray-400" />
            <div>
              <div className="text-sm text-gray-600">Email</div>
              <div className="font-medium text-gray-800">{user.email}</div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Phone className="w-5 h-5 text-gray-400" />
            <div>
              <div className="text-sm text-gray-600">Phone Number</div>
              <div className="font-medium text-gray-800">{user.phone_number}</div>
            </div>
          </div>

          {user.uid && (
            <div className="flex items-center space-x-3">
              <Hash className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-600">UID</div>
                <div className="font-medium text-gray-800">{user.uid}</div>
              </div>
            </div>
          )}

          {user.department && (
            <div className="flex items-center space-x-3">
              <Building className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-600">Department</div>
                <div className="font-medium text-gray-800">{user.department}</div>
              </div>
            </div>
          )}

          {user.year && (
            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-600">Year</div>
                <div className="font-medium text-gray-800">Year {user.year}</div>
              </div>
            </div>
          )}

          {user.semester && (
            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-600">Semester</div>
                <div className="font-medium text-gray-800">Semester {user.semester}</div>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Statistics for Students */}
      {user.role === 'Student' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200"
        >
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Your Activity Summary</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">1</div>
              <div className="text-sm text-gray-600">CC Activities</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-teal-600">10</div>
              <div className="text-sm text-gray-600">CEP Hours</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Logout Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleLogout}
        className="w-full bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center justify-center space-x-2"
      >
        <LogOut className="w-5 h-5" />
        <span>Logout</span>
      </motion.button>
    </motion.div>
  )
}

export default Profile