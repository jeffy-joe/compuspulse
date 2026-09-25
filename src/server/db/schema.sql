-- Database Schema for CampusPulse

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  name TEXT NOT NULL DEFAULT 'Student',
  avatar_url TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  department TEXT,
  year TEXT,
  class_name TEXT,
  role TEXT NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email Verification OTPs Table (Google SMTP)
CREATE TABLE IF NOT EXISTS auth_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT,
  type TEXT NOT NULL DEFAULT 'signup',
  department TEXT,
  year TEXT,
  class_name TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_otps_email ON auth_otps(email);


-- Polls Table
CREATE TABLE IF NOT EXISTS polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Campus',
  creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  creator_name TEXT NOT NULL DEFAULT 'CampusPulse',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '1 day',
  anonymous_voting BOOLEAN NOT NULL DEFAULT false,
  multiple_selection BOOLEAN NOT NULL DEFAULT false,
  total_votes INTEGER NOT NULL DEFAULT 0,
  is_global BOOLEAN NOT NULL DEFAULT false,
  class_name TEXT,
  department TEXT,
  year TEXT
);
CREATE INDEX IF NOT EXISTS idx_polls_created_at ON polls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_polls_class_name ON polls(class_name);
CREATE INDEX IF NOT EXISTS idx_polls_is_global ON polls(is_global);

-- Poll Options Table
CREATE TABLE IF NOT EXISTS poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  votes_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id ON poll_options(poll_id);

-- Votes Table
CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (poll_id, option_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_votes_user_poll ON votes(user_id, poll_id);
