import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import BottomNavigation from './BottomNavigation'
import FacultyCC from './FacultyCC'
import StudentCC from './StudentCC'
import FacultyCEP from './FacultyCEP'
import StudentCEP from './StudentCEP'
import Profile from './Profile'

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
    <div className="min-h-screen bg-gray-50 p-4 max-w-full max-h-full overflow-y-auto">
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
      
      <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg p-4">
        <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
      
    </div>
  )
}

export default Dashboard