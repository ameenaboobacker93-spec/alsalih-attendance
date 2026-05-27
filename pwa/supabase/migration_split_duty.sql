-- ============================================================
-- MIGRATION: Add split duty columns to attendance_logs
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Add check_in_2 and check_out_2 columns if they don't already exist
ALTER TABLE attendance_logs 
  ADD COLUMN IF NOT EXISTS check_in_2 TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS check_out_2 TIMESTAMPTZ;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'attendance_logs' 
  AND column_name IN ('check_in_2', 'check_out_2');
