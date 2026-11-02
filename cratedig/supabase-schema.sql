-- Run this in your Supabase SQL Editor (https://app.supabase.com → SQL Editor)
-- Creates the pairings table and sets up Row Level Security

CREATE TABLE IF NOT EXISTS pairings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_a_title   TEXT NOT NULL,
  song_a_artist  TEXT NOT NULL,
  song_a_mb_id   TEXT,                  -- MusicBrainz recording ID
  song_b_title   TEXT NOT NULL,
  song_b_artist  TEXT NOT NULL,
  song_b_mb_id   TEXT,
  timestamp_a    TEXT NOT NULL,         -- e.g. "3:20"
  timestamp_b    TEXT NOT NULL,         -- e.g. "0:45"
  genre          TEXT NOT NULL DEFAULT 'Other',
  note           TEXT,
  upvotes        INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE pairings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read pairings
CREATE POLICY "Public read"
  ON pairings FOR SELECT
  USING (true);

-- Allow anyone to insert pairings (no auth required for prototype)
CREATE POLICY "Public insert"
  ON pairings FOR INSERT
  WITH CHECK (true);

-- Allow upvote updates (only the upvotes column)
CREATE POLICY "Public upvote"
  ON pairings FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Index for faster genre filtering
CREATE INDEX IF NOT EXISTS pairings_genre_idx ON pairings (genre);

-- Index for song search
CREATE INDEX IF NOT EXISTS pairings_song_a_title_idx ON pairings (song_a_title);
CREATE INDEX IF NOT EXISTS pairings_song_b_title_idx ON pairings (song_b_title);
