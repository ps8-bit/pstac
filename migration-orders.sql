-- ============================================================
--  Migration: add line_items, bundle_name, deductions columns
--  Run once in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS bundle_name  TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS line_items   JSONB   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deductions   JSONB   DEFAULT NULL;
