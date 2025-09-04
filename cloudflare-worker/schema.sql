-- D1 Schema for FM Global RAG Agent
-- Run with: wrangler d1 execute fm-global-rag --file=schema.sql

-- Documents table with embeddings stored as JSON
CREATE TABLE IF NOT EXISTS fm_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  metadata TEXT, -- JSON string
  embedding TEXT, -- JSON array of floats
  document_type TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Design parameters table
CREATE TABLE IF NOT EXISTS fm_design_parameters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asrs_type TEXT NOT NULL,
  container_type TEXT NOT NULL,
  ceiling_protection TEXT,
  in_rack_protection TEXT,
  design_pressure TEXT,
  water_demand TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(asrs_type, container_type)
);

-- Insert sample design parameters
INSERT OR REPLACE INTO fm_design_parameters 
  (asrs_type, container_type, ceiling_protection, in_rack_protection, design_pressure, water_demand)
VALUES 
  ('mini-load', 'tote', 'ESFR K-16.8', 'Quick-response ordinary temperature', '52 psi', '1,200 gpm'),
  ('unit-load', 'pallet', 'ESFR K-25.2', 'Required for Class I-IV commodities', '75 psi', '2,000 gpm'),
  ('shuttle', 'tote', 'ESFR K-14', 'Face sprinklers at alternate levels', '50 psi', '1,000 gpm'),
  ('crane', 'pallet', 'ESFR K-22.4', 'In-rack at every tier level', '60 psi', '1,800 gpm');

-- Search history for analytics
CREATE TABLE IF NOT EXISTS search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  results_count INTEGER,
  response_time_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_documents_type ON fm_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_design_params ON fm_design_parameters(asrs_type, container_type);
CREATE INDEX IF NOT EXISTS idx_search_history_date ON search_history(created_at);