import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lbdbxrfhorkrqfshsnue.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiZGJ4cmZob3JrcnFmc2hzbnVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NjAyMzAsImV4cCI6MjA2NzAzNjIzMH0.sY4P9PExxA-8IaimIk4LY_FcXYgpZFkSRQjzTD3w8Lk'

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          user_id: string
          name: string
          email: string
          department: string | null
          year: string | null
          phone_number: string
          semester: string | null
          role: 'Student' | 'Faculty' | 'Admin'
          uid: string | null
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'user_id'>
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      events: {
        Row: {
          event_id: string
          title: string
          description: string | null
          date: string
          time: string
          venue: string | null
          category: string | null
          location: string | null
          flyer_url: string | null
          created_by: string | null
          class: string | null
          department: string | null
          status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled'
          created_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['events']['Row'], 'event_id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['events']['Insert']>
      }
      enrollments: {
        Row: {
          enrollment_id: string
          event_id: string | null
          user_id: string | null
          enrolled_at: string | null
          status: 'enrolled' | 'attended' | 'absent'
        }
        Insert: Omit<Database['public']['Tables']['enrollments']['Row'], 'enrollment_id' | 'enrolled_at'>
        Update: Partial<Database['public']['Tables']['enrollments']['Insert']>
      }
      attendance: {
        Row: {
          attendance_id: string
          user_id: string | null
          event_id: string | null
          status: 'Present' | 'Absent'
          marked_by: string | null
          marked_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['attendance']['Row'], 'attendance_id' | 'marked_at'>
        Update: Partial<Database['public']['Tables']['attendance']['Insert']>
      }
      notifications: {
        Row: {
          notification_id: string
          user_id: string | null
          event_id: string | null
          title: string | null
          message: string | null
          type: 'event_created' | 'event_reminder' | 'enrollment_confirmed' | 'attendance_marked' | 'event_completed'
          is_read: boolean | null
          created_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'notification_id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
      }
      event_reports: {
        Row: {
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
        Insert: Omit<Database['public']['Tables']['event_reports']['Row'], 'report_id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['event_reports']['Insert']>
      }
      cep_requirements: {
        Row: {
          year: string
          hours_required: number
          deadline: string | null
        }
        Insert: Database['public']['Tables']['cep_requirements']['Row']
        Update: Partial<Database['public']['Tables']['cep_requirements']['Insert']>
      }
      cep_submissions: {
        Row: {
          submission_id: string
          user_id: string | null
          hours: number | null
          file_url: string | null
          submitted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['cep_submissions']['Row'], 'submission_id' | 'submitted_at'>
        Update: Partial<Database['public']['Tables']['cep_submissions']['Insert']>
      }
    }
  }
}