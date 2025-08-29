import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lbdbxrfhorkrqfshsnue.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiZGJ4cmZob3JrcnFmc2hzbnVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NjAyMzAsImV4cCI6MjA2NzAzNjIzMH0.sY4P9PExxA-8IaimIk4LY_FcXYgpZFkSRQjzTD3w8Lk'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
  headers: {
    'Accept': 'application/json',
  },
})  