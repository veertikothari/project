import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

type Notification = {
  notification_id: string
  user_id: string | null
  event_id: string | null
  title: string | null
  message: string | null
  type: 'event_created' | 'event_reminder' | 'enrollment_confirmed' | 'attendance_marked' | 'event_completed'
  is_read: boolean | null
  created_at: string | null
}

type NotificationContextType = {
  notifications: Notification[]
  unreadCount: number
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  sendNotification: (notification: Omit<Notification, 'notification_id' | 'created_at'>) => Promise<void>
  sendBulkNotifications: (notifications: Omit<Notification, 'notification_id' | 'created_at'>[]) => Promise<void>
  refreshNotifications: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = async () => {
    if (!user?.user_id) return

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.user_id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching notifications:', error)
        return
      }

      setNotifications(data || [])
      setUnreadCount(data?.filter(n => !n.is_read).length || 0)
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

  useEffect(() => {
    if (user?.user_id) {
      fetchNotifications()
      
      // Set up real-time subscription for notifications
      const subscription = supabase
        .channel('notifications')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.user_id}`
        }, () => {
          fetchNotifications()
        })
        .subscribe()

      return () => {
        subscription.unsubscribe()
      }
    }
  }, [user?.user_id])

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('notification_id', notificationId)

      if (error) {
        console.error('Error marking notification as read:', error)
        return
      }

      setNotifications(prev => 
        prev.map(n => 
          n.notification_id === notificationId 
            ? { ...n, is_read: true }
            : n
        )
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    if (!user?.user_id) return

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.user_id)
        .eq('is_read', false)

      if (error) {
        console.error('Error marking all notifications as read:', error)
        return
      }

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }

  const sendNotification = async (notification: Omit<Notification, 'notification_id' | 'created_at'>) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert(notification)

      if (error) {
        console.error('Error sending notification:', error)
        throw error
      }
    } catch (error) {
      console.error('Error sending notification:', error)
      throw error
    }
  }

  const sendBulkNotifications = async (notifications: Omit<Notification, 'notification_id' | 'created_at'>[]) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert(notifications)

      if (error) {
        console.error('Error sending bulk notifications:', error)
        throw error
      }
    } catch (error) {
      console.error('Error sending bulk notifications:', error)
      throw error
    }
  }

  const refreshNotifications = async () => {
    await fetchNotifications()
  }

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      sendNotification,
      sendBulkNotifications,
      refreshNotifications
    }}>
      {children}
    </NotificationContext.Provider>
  )
}
