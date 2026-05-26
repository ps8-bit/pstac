-- ============================================================
--  Migration: create labels table
--  Run once in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

CREATE TABLE IF NOT EXISTS labels (
  id         TEXT        PRIMARY KEY,
  so_id      TEXT        DEFAULT '',
  data       JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow realtime subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE labels;
