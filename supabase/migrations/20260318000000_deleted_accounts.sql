CREATE TABLE deleted_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  machine_ids TEXT[] DEFAULT '{}',
  deleted_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE deleted_accounts ENABLE ROW LEVEL SECURITY;
-- No RLS policies = client can't read/write, only service role
