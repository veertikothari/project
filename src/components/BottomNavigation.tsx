import React from 'react'
import { motion } from 'framer-motion'
import { BookOpen, Heart, User } from 'lucide-react'

type NavigationItem = {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  shortLabel: string
}

const navigationItems: NavigationItem[] = [
  {
    id: 'cc',
    label: 'Co-curricular Activities',
    icon: BookOpen,
    shortLabel: 'Co-Curricular'
  },
  {
    id: 'cep',
    label: 'Cultural Engagement Program',
    icon: Heart,
    shortLabel: 'CEP'
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: User,
    shortLabel: 'Profile'
  }
]

type BottomNavigationProps = {
  activeTab: string
  onTabChange: (tab: string) => void
}

const BottomNavigation = ({ activeTab, onTabChange }: BottomNavigationProps) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-50 ">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {navigationItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id

          return (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
                isActive
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className={`w-6 h-6 mb-1 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
              <span className={`text-xs font-medium ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                {item.shortLabel}
              </span>
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute -bottom-2 w-12 h-1 bg-blue-600 rounded-full"
                />
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

export default BottomNavigation