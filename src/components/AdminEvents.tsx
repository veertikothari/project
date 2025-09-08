import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Filter, RefreshCcw } from 'lucide-react'
import { supabase } from '../lib/supabase'

 type EventRow = {
  event_id: string
  title: string
  category: 'Co-curricular' | 'CEP'
  department: string | null
  class: string | null
  date: string
  time: string
 }

 const AdminEvents = () => {
  const [events, setEvents] = useState<EventRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // filters
  const [filterDepartment, setFilterDepartment] = useState('all')
  const [filterClass, setFilterClass] = useState('all')
  const [filterCategory, setFilterCategory] = useState<'all' | 'Co-curricular' | 'CEP'>('all')
  const [filterDate, setFilterDate] = useState<string>('')

  const [departments, setDepartments] = useState<string[]>([])
  const [classes, setClasses] = useState<string[]>([])

  useEffect(() => {
    fetchEvents()
  }, [])

  const fetchEvents = async () => {
    try {
      setIsLoading(true)
      setError('')
      const { data, error } = await supabase
        .from('events')
        .select('event_id, title, category, department, class, date, time')
        .order('date', { ascending: false })

      if (error) throw error
      const rows: EventRow[] = (data || []).map((e: any) => ({
        event_id: e.event_id,
        title: e.title,
        category: (e.category || 'Co-curricular') as 'Co-curricular' | 'CEP',
        department: e.department || null,
        class: e.class || null,
        date: e.date,
        time: e.time,
      }))
      setEvents(rows)

      // build filter lists
      const deptList = Array.from(new Set(rows.map(r => r.department).filter(Boolean))) as string[]
      const classList = Array.from(new Set(rows.map(r => r.class).filter(Boolean))) as string[]
      setDepartments(deptList)
      setClasses(classList)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch events')
    } finally {
      setIsLoading(false)
    }
  }

  const filtered = useMemo(() => {
    return events.filter(ev => {
      const depOk = filterDepartment === 'all' || ev.department === filterDepartment
      const classOk = filterClass === 'all' || ev.class === filterClass
      const catOk = filterCategory === 'all' || ev.category === filterCategory
      const dateOk = !filterDate || (new Date(ev.date).toDateString() === new Date(filterDate).toDateString())
      return depOk && classOk && catOk && dateOk
    })
  }, [events, filterDepartment, filterClass, filterCategory, filterDate])

  const resetFilters = () => {
    setFilterDepartment('all')
    setFilterClass('all')
    setFilterCategory('all')
    setFilterDate('')
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-gray-700">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Filters</span>
          </div>
          <button onClick={resetFilters} className="flex items-center gap-2 text-xs px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700">
            <RefreshCcw className="w-3 h-3" /> Reset
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Classes</option>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Categories</option>
            <option value="Co-curricular">Co-curricular</option>
            <option value="CEP">CEP</option>
          </select>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-s font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-s font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-s font-medium text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-s font-medium text-gray-500 uppercase tracking-wider">Class</th>
                <th className="px-6 py-3 text-left text-s font-medium text-gray-500 uppercase tracking-wider">When</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.map((ev) => (
                <tr key={ev.event_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ev.category}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ev.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ev.department || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ev.class || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(ev.date).toLocaleDateString()} at {ev.time}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && !isLoading && (
          <div className="text-center py-12 text-sm text-gray-600">No events match the current filters.</div>
        )}
        {isLoading && (
          <div className="text-center py-12 text-sm text-gray-600">Loading events...</div>
        )}
        {error && (
          <div className="text-center py-3 text-sm text-red-600">{error}</div>
        )}
      </div>
    </div>
  )
 }

 export default AdminEvents
