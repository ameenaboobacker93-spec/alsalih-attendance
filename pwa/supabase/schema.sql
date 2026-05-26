-- ============================================================
-- AL SALIH PHARMACY ATTENDANCE - SUPABASE SCHEMA
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. BRANCHES
CREATE TABLE branches (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. BRANCH SETTINGS (admin PIN per branch)
CREATE TABLE branch_settings (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  admin_pin_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. STAFF
CREATE TABLE staff (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  staff_code TEXT,
  duty_hours NUMERIC(5,2) NOT NULL DEFAULT 9,
  shift_start TIME NOT NULL DEFAULT '09:00',
  shift_end TIME NOT NULL DEFAULT '18:00',
  is_active BOOLEAN DEFAULT TRUE,
  pin_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. DUTY ROSTER (optional scheduling)
CREATE TABLE duty_roster (
  id BIGSERIAL PRIMARY KEY,
  staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_split BOOLEAN DEFAULT FALSE,
  split_start TIME,
  split_end TIME,
  is_off_day BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, date)
);

-- 5. ATTENDANCE LOGS
CREATE TABLE attendance_logs (
  id BIGSERIAL PRIMARY KEY,
  staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  total_hours NUMERIC(5,2),
  ot_value NUMERIC(5,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'INCOMPLETE',
    -- Possible: INCOMPLETE, NORMAL, PENDING_APPROVAL, OT_APPROVED, COMPENSATED, OFF_DAY
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. OT PAYMENTS / ADJUSTMENTS
CREATE TABLE ot_payments (
  id BIGSERIAL PRIMARY KEY,
  staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  ot_value NUMERIC(5,2) DEFAULT 0,
  date DATE,
  type TEXT DEFAULT 'MANUAL_FIX',
  status TEXT DEFAULT 'Verified',
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. SETTLEMENTS
CREATE TABLE settlements (
  id BIGSERIAL PRIMARY KEY,
  staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  net_ot NUMERIC(5,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. AUDIT LOGS
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  admin_name TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_staff_branch ON staff(branch_id);
CREATE INDEX idx_attendance_staff ON attendance_logs(staff_id);
CREATE INDEX idx_attendance_date ON attendance_logs(date);
CREATE INDEX idx_attendance_branch ON attendance_logs(branch_id);
CREATE INDEX idx_roster_staff_date ON duty_roster(staff_id, date);
CREATE INDEX idx_settlements_staff_month ON settlements(staff_id, month);
CREATE INDEX idx_audit_branch ON audit_logs(branch_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE duty_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ot_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow public read for branches (branch selector)
CREATE POLICY "Branches are publicly readable" ON branches
  FOR SELECT USING (true);

-- Allow app users to update branch names (for admin use)
CREATE POLICY "App can update branches" ON branches
  FOR UPDATE USING (true);

-- All other tables accessible via the anon key with application-level auth
-- (PIN-based auth means we handle auth in-app, not via Supabase Auth)
-- These policies allow full access to authenticated app users
CREATE POLICY "App full access to staff" ON staff
  FOR ALL USING (true);

CREATE POLICY "App full access to attendance" ON attendance_logs
  FOR ALL USING (true);

CREATE POLICY "App full access to roster" ON duty_roster
  FOR ALL USING (true);

CREATE POLICY "App full access to settlements" ON settlements
  FOR ALL USING (true);

CREATE POLICY "App full access to ot_payments" ON ot_payments
  FOR ALL USING (true);

CREATE POLICY "App full access to audit" ON audit_logs
  FOR ALL USING (true);

CREATE POLICY "App full access to branch_settings" ON branch_settings
  FOR ALL USING (true);

-- ============================================================
-- SEED DATA - AJMAN BRANCH
-- ============================================================
INSERT INTO branches (name, code) VALUES ('AJMAN', 'AJM');
INSERT INTO branches (name, code) VALUES ('UAQ', 'UAQ');

-- Default admin PIN is 1206
-- The hash is generated by the app using a simple JS hash function (see useStaffApi.js)
-- After the first run, update with actual hash from the app:
--   hashPin('1206') result goes here
INSERT INTO branch_settings (branch_id, admin_pin_hash)
  SELECT id, 'hash_wcmf' FROM branches WHERE code = 'AJM';
INSERT INTO branch_settings (branch_id, admin_pin_hash)
  SELECT id, 'hash_wcmf' FROM branches WHERE code = 'UAQ';
