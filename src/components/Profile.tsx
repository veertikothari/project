import  { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User, Mail, Phone, Building, Calendar, Hash, LogOut, Edit, Save, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const Profile = () => {
  const { user, logout } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [editForm, setEditForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone_number: user?.phone_number || ''
  })

  useEffect(() => {
    if (user) {
      setEditForm({
        name: user.name || '',
        email: user.email || '',
        phone_number: user.phone_number || ''
      })
    }
  }, [user])

  const validateEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhoneNumber = (phone: string) => {
  const phoneRegex = /^\d{10}$/;
  return phoneRegex.test(phone);
};

  const handleSave = async () => {
    if (!user?.user_id) return
    setIsLoading(true)

    if (!validateEmail(editForm.email)) {
    setIsLoading(false);
    alert('Please enter a valid email address (e.g., user@domain.com).');
    return;
  }
  if (!validatePhoneNumber(editForm.phone_number)) {
    setIsLoading(false);
    alert('Please enter a valid 10-digit phone number.');
    return;
  }

    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: editForm.name,
          email: editForm.email,
          phone_number: editForm.phone_number
        })
        .eq('user_id', user.user_id)

      if (error) {
        console.error('Error updating profile:', error)
        alert('Failed to update profile. Please try again.')
        return
      }

      // Update local user data
      const updatedUser = { ...user, ...editForm }
      localStorage.setItem('user', JSON.stringify(updatedUser))
      
      // Force a page reload to update the auth context
      window.location.reload()
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('Failed to update profile. Please try again.')
    } finally {
      setIsLoading(false)
      setIsEditing(false)
    }
  }

  const handleCancel = () => {
    setEditForm({
      name: user?.name || '',
      email: user?.email || '',
      phone_number: user?.phone_number || ''
    })
    setIsEditing(false)
  }

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
          
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="text-blue-600 hover:text-blue-700 flex items-center space-x-1"
            >
              <Edit className="w-4 h-4" />
              <span>Edit</span>
            </button>
          ) : (
            <div className="flex space-x-2">
              <button
                onClick={handleSave}
                disabled={isLoading}
                className="text-green-600 hover:text-green-700 flex items-center space-x-1 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isLoading ? 'Saving...' : 'Save'}</span>
              </button>
              <button
                onClick={handleCancel}
                className="text-red-600 hover:text-red-700 flex items-center space-x-1"
              >
                <X className="w-4 h-4" />
                <span>Cancel</span>
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Name - Editable */}
          <div className="flex items-center space-x-3">
            <User className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <div className="text-sm text-gray-600">Name</div>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <div className="font-medium text-gray-800">{user.name}</div>
              )}
            </div>
          </div>

          {/* Email - Editable */}
          <div className="flex items-center space-x-3">
            <Mail className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <div className="text-sm text-gray-600">Email</div>
              {isEditing ? (
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <div className="font-medium text-gray-800">{user.email}</div>
              )}
            </div>
          </div>

          {/* Phone Number - Editable */}
          <div className="flex items-center space-x-3">
            <Phone className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <div className="text-sm text-gray-600">Phone Number</div>
              {isEditing ? (
                <input
                  type="tel"
                  value={editForm.phone_number}
                  onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <div className="font-medium text-gray-800">{user.phone_number}</div>
              )}
            </div>
          </div>

          {/* UID - Read Only */}
          {user.uid && (
            <div className="flex items-center space-x-3">
              <Hash className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-600">UID</div>
                <div className="font-medium text-gray-800">{user.uid}</div>
              </div>
            </div>
          )}

          {/* Department - Read Only */}
          {user.department && (
            <div className="flex items-center space-x-3">
              <Building className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-600">Department</div>
                <div className="font-medium text-gray-800">{user.department}</div>
              </div>
            </div>
          )}

          {/* Year - Read Only */}
          {user.year && (
            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-600">Year</div>
                <div className="font-medium text-gray-800">Year {user.year}</div>
              </div>
            </div>
          )}

          {/* Semester - Read Only */}
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