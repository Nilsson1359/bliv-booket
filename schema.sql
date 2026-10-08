-- fuldtbooketmusiker.dk analytics (D1). Kør: npx wrangler d1 execute fbm-analytics --remote --file=schema.sql
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  type TEXT NOT NULL,
  vid TEXT, sid TEXT, pv TEXT,
  path TEXT, ref TEXT, ref_host TEXT,
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT,
  ip TEXT, country TEXT, region TEXT, city TEXT, postal TEXT, lat REAL, lon REAL,
  ua TEXT, device TEXT, browser TEXT, os TEXT,
  vw INTEGER, vh INTEGER, dw INTEGER, dh INTEGER,
  x REAL, y REAL, sec TEXT, secy REAL, label TEXT,
  depth INTEGER, dur INTEGER
);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_type_ts ON events(type, ts);
CREATE INDEX IF NOT EXISTS idx_events_sid ON events(sid);
CREATE INDEX IF NOT EXISTS idx_events_vid ON events(vid);

-- Leads fra /firmafest + /bryllup (formularen gemmer løbende; booked_* = epoch ms). Tilføjet 8/10 2026.
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  page TEXT NOT NULL,
  created_ts INTEGER NOT NULL,
  updated_ts INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
  answers_json TEXT NOT NULL DEFAULT '{}',
  step INTEGER NOT NULL DEFAULT 0, done INTEGER NOT NULL DEFAULT 0,
  booked_start INTEGER, booked_end INTEGER, booked_ip TEXT,
  ghl_contact_id TEXT, ghl_appt_id TEXT,
  src_json TEXT NOT NULL DEFAULT '{}', vid TEXT, sid TEXT,
  ip TEXT, city TEXT, country TEXT,
  writes INTEGER NOT NULL DEFAULT 0,
  notified_flags TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_leads_updated ON leads(updated_ts);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_ts);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_booked ON leads(booked_start) WHERE booked_start IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_ip ON leads(ip, created_ts);
-- 8/10: booked_ip = IP der faktisk bookede (misbrugs-værn tæller på den). Eksisterende DB'er fik den én gang via:
--   ALTER TABLE leads ADD COLUMN booked_ip TEXT;
CREATE INDEX IF NOT EXISTS idx_leads_booked_ip ON leads(booked_ip, booked_start);
