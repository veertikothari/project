import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import BottomNavigation from './BottomNavigation'
import FacultyCC from './FacultyCC'
import StudentCC from './StudentCC'
import FacultyCEP from './FacultyCEP'
import StudentCEP from './StudentCEP'
import Profile from './Profile'
import NotificationPanel from './NotificationPanel'

const Dashboard = () => {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('cc')

  const renderContent = () => {
    switch (activeTab) {
      case 'cc':
        return user?.role === 'Faculty' ? <FacultyCC /> : <StudentCC />
      case 'cep':
        return user?.role === 'Faculty' ? <FacultyCEP /> : <StudentCEP />
      case 'profile':
        return <Profile />
      default:
        return user?.role === 'Faculty' ? <FacultyCC /> : <StudentCC />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 max-w-full max-h-full overflow-y-auto pb-20">
      {/* Header with Notifications */}
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-800">
            {activeTab === 'cc' ? user?.role === 'Faculty' ? 'Co-curricular - Faculty' : 'Co-curricular - Student' : activeTab === 'cep' ? user?.role === 'Faculty' ? 'Community Engagement Program -Faculty' : 'Community Engagement Program - Student' : 'Profile'}
          </h1>
          <p className="text-xs sm:text-sm text-gray-600">
            {user?.name} - {user?.department}
          </p>
        </div>
        <NotificationPanel />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
      
      <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg p-2 sm:p-4">
        <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
      
    </div>
  )
}

export default Dashboard