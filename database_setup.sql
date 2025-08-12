-- Database setup script for notification system and event management

-- Update events table to include new columns
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS class VARCHAR,
ADD COLUMN IF NOT EXISTS department VARCHAR,
ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'upcoming',
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create enrollments table
CREATE TABLE IF NOT EXISTS enrollments (
    enrollment_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES events(event_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR DEFAULT 'enrolled',
    UNIQUE(event_id, user_id)
);

-- Update attendance table to include marked_at
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS marked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(event_id) ON DELETE CASCADE,
    title VARCHAR,
    message TEXT,
    type VARCHAR CHECK (type IN ('event_created', 'event_reminder', 'enrollment_confirmed', 'attendance_marked', 'event_completed')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create event_reports table
CREATE TABLE IF NOT EXISTS event_reports (
    report_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES events(event_id) ON DELETE CASCADE,
    faculty_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    total_enrolled INTEGER,
    total_attended INTEGER,
    total_absent INTEGER,
    attendance_percentage DECIMAL(5,2),
    event_summary TEXT,
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_enrollments_event_id ON enrollments(event_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user_id ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_event_id ON notifications(event_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_event_reports_event_id ON event_reports(event_id);
CREATE INDEX IF NOT EXISTS idx_event_reports_faculty_id ON event_reports(faculty_id);
CREATE INDEX IF NOT EXISTS idx_attendance_event_id ON attendance(event_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_reports ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for enrollments
CREATE POLICY "Users can view their own enrollments" ON enrollments
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own enrollments" ON enrollments
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own enrollments" ON enrollments
    FOR DELETE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Faculty can view enrollments for their events" ON enrollments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM events 
            WHERE events.event_id = enrollments.event_id 
            AND events.created_by = auth.uid()::text
        )
    );

-- Create RLS policies for notifications
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "System can insert notifications" ON notifications
    FOR INSERT WITH CHECK (true);

-- Create RLS policies for event_reports
CREATE POLICY "Faculty can view their own reports" ON event_reports
    FOR SELECT USING (auth.uid()::text = faculty_id::text);

CREATE POLICY "Faculty can insert their own reports" ON event_reports
    FOR INSERT WITH CHECK (auth.uid()::text = faculty_id::text);

CREATE POLICY "Faculty can update their own reports" ON event_reports
    FOR UPDATE USING (auth.uid()::text = faculty_id::text);

-- Create function to automatically update event status
CREATE OR REPLACE FUNCTION update_event_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update status to 'completed' if event date has passed
    UPDATE events 
    SET status = 'completed' 
    WHERE event_id = NEW.event_id 
    AND date < CURRENT_DATE 
    AND status = 'upcoming';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update event status
CREATE TRIGGER trigger_update_event_status
    AFTER INSERT OR UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION update_event_status();

-- Create function to send event reminders
CREATE OR REPLACE FUNCTION send_event_reminders()
RETURNS void AS $$
DECLARE
    event_record RECORD;
    student_record RECORD;
BEGIN
    -- Find events happening tomorrow
    FOR event_record IN 
        SELECT e.*, u.user_id, u.name
        FROM events e
        JOIN enrollments enr ON e.event_id = enr.event_id
        JOIN users u ON enr.user_id = u.user_id
        WHERE e.date = CURRENT_DATE + INTERVAL '1 day'
        AND e.status = 'upcoming'
    LOOP
        -- Insert reminder notification
        INSERT INTO notifications (user_id, event_id, title, message, type)
        VALUES (
            event_record.user_id,
            event_record.event_id,
            'Event Reminder',
            'Reminder: "' || event_record.title || '" is tomorrow at ' || event_record.time || '. Venue: ' || COALESCE(event_record.venue, 'TBA'),
            'event_reminder'
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;
