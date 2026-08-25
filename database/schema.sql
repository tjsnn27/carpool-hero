-- Agasthiyar Academy — Carpool Hero (M365-native schema)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE student_status_enum AS ENUM (
    'not_checked_in', 'in_class', 'pickup_arrived', 'released_from_class', 'loaded', 'absent'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE queue_status_enum AS ENUM ('waiting', 'calling', 'staged', 'loaded', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_number VARCHAR(10) UNIQUE NOT NULL,
  family_name VARCHAR(100) NOT NULL,
  primary_phone VARCHAR(20),
  authorized_pickups TEXT[] DEFAULT '{}',
  safety_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  m365_user_id VARCHAR(100) UNIQUE,
  family_id UUID REFERENCES families(id) ON DELETE SET NULL,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  grade_room VARCHAR(50) NOT NULL,
  m365_group_id VARCHAR(100),
  m365_photo_url TEXT,
  status student_status_enum DEFAULT 'not_checked_in',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS carpool_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_number VARCHAR(10) NOT NULL,
  family_id UUID REFERENCES families(id) ON DELETE SET NULL,
  lane_number INT DEFAULT 1,
  status queue_status_enum DEFAULT 'waiting',
  session_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  dismissed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_families_tag ON families(tag_number);
CREATE INDEX IF NOT EXISTS idx_students_m365 ON students(m365_user_id);
CREATE INDEX IF NOT EXISTS idx_students_grade ON students(grade_room);
CREATE INDEX IF NOT EXISTS idx_students_family ON students(family_id);
CREATE INDEX IF NOT EXISTS idx_queue_active ON carpool_queue(session_date, status, created_at);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration helpers for existing deployments
ALTER TABLE students ADD COLUMN IF NOT EXISTS m365_user_id VARCHAR(100) UNIQUE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS m365_group_id VARCHAR(100);
ALTER TABLE students ADD COLUMN IF NOT EXISTS m365_photo_url TEXT;
ALTER TABLE carpool_queue ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;
ALTER TYPE student_status_enum ADD VALUE IF NOT EXISTS 'not_checked_in' BEFORE 'in_class';
ALTER TYPE student_status_enum ADD VALUE IF NOT EXISTS 'pickup_arrived' AFTER 'in_class';
ALTER TYPE student_status_enum ADD VALUE IF NOT EXISTS 'released_from_class' AFTER 'pickup_arrived';
ALTER TABLE students ALTER COLUMN status SET DEFAULT 'not_checked_in';
