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
