# Co-curricular Activity Management System

A comprehensive web application for managing co-curricular activities with real-time notifications, automated enrollment, and detailed event reporting.

## Features

### 🎯 Core Features
- **Activity Management**: Create, edit, and delete co-curricular activities
- **Student Enrollment**: Students can enroll/unenroll in activities
- **Attendance Tracking**: Faculty can mark student attendance
- **Real-time Notifications**: Instant notifications for all events
- **Event Reports**: Comprehensive reports with analytics
- **Role-based Access**: Separate interfaces for Faculty and Students

### 🔔 Notification System
- **Event Creation Notifications**: Students receive notifications when new activities are created
- **Enrollment Confirmations**: Students get confirmation when they enroll
- **Attendance Notifications**: Students are notified when their attendance is marked
- **Event Reminders**: Automated reminders for upcoming events
- **Real-time Updates**: Notifications appear instantly using Supabase real-time subscriptions

### 📊 Event Reports
- **Comprehensive Analytics**: Total enrolled, attended, absent students
- **Attendance Percentage**: Automatic calculation of attendance rates
- **Event Summaries**: Faculty can add detailed event summaries
- **Feedback System**: Capture lessons learned and recommendations
- **Export Functionality**: Download reports as text files
- **Sharing Capabilities**: Share reports via native sharing or clipboard

### 🎓 Auto-Enrollment Features
- **Department-based Targeting**: Notifications sent to relevant students
- **Enrollment Tracking**: Automatic tracking of student enrollments
- **Status Management**: Track enrollment status (enrolled, attended, absent)

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS with Framer Motion animations
- **Backend**: Supabase (PostgreSQL + Real-time)
- **Authentication**: Supabase Auth
- **Icons**: Lucide React
- **Date Handling**: date-fns

## Database Schema

### Tables
- `users`: User profiles with role-based access
- `events`: Activity details and metadata
- `enrollments`: Student enrollment tracking
- `attendance`: Attendance records
- `notifications`: Real-time notification system
- `event_reports`: Comprehensive event analytics
- `cep_requirements`: CEP requirements (existing)
- `cep_submissions`: CEP submissions (existing)

### Key Features
- **Row Level Security (RLS)**: Secure data access
- **Real-time Subscriptions**: Live notification updates
- **Automatic Triggers**: Event status updates
- **Indexed Queries**: Optimized performance

## Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd project
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a new Supabase project
   - Run the `database_setup.sql` script in your Supabase SQL editor
   - Update `src/lib/supabase.ts` with your project credentials

4. **Start the development server**
   ```bash
   npm run dev
   ```

## Database Setup

Run the following SQL script in your Supabase SQL editor:

```sql
-- See database_setup.sql for complete setup
```

This will create all necessary tables, indexes, and security policies.

## Usage

### For Faculty
1. **Create Activities**: Use the "Create Activity" button to add new co-curricular activities
2. **Manage Attendance**: Click "Attendance" on any activity to mark student attendance
3. **Generate Reports**: Use "View Reports" to create comprehensive event reports
4. **Notifications**: Receive real-time notifications about student enrollments and attendance

### For Students
1. **Browse Activities**: View all available activities in your department
2. **Enroll**: Click "Enroll" to join activities
3. **Track Attendance**: View your attendance status for each activity
4. **Notifications**: Receive notifications about new activities, reminders, and attendance updates

## Notification Types

- **event_created**: New activity created by faculty
- **event_reminder**: Reminder for upcoming events
- **enrollment_confirmed**: Confirmation of successful enrollment
- **attendance_marked**: Notification when attendance is recorded
- **event_completed**: Event report generated

## Security Features

- **Row Level Security (RLS)**: Users can only access their own data
- **Role-based Access**: Faculty and students have different permissions
- **Secure Authentication**: Supabase Auth integration
- **Data Validation**: Input validation and sanitization

## Performance Optimizations

- **Database Indexes**: Optimized queries for better performance
- **Real-time Subscriptions**: Efficient real-time updates
- **Lazy Loading**: Components load only when needed
- **Caching**: Local storage for user data

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please open an issue in the repository.
