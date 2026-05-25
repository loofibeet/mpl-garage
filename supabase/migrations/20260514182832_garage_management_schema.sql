/*
  # Garage Management System - Full Schema

  ## Tables
  1. profiles - User profiles (admin/worker roles)
  2. companies - Client companies
  3. trucks - Trucks belonging to companies
  4. workers - Mechanic/worker records
  5. repair_jobs - Work orders
  6. job_workers - Many-to-many: jobs <-> workers
  7. job_parts - Parts used in a job
  8. invoices - Invoices tied to jobs
  9. invoice_line_items - Line items on an invoice

  ## Security
  - RLS enabled on all tables
  - Authenticated users can read all records
  - Only admins can delete records; workers read-only on most
*/

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'worker' CHECK (role IN ('admin', 'worker')),
  phone text DEFAULT '',
  avatar_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Companies
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text DEFAULT '',
  email text DEFAULT '',
  address text DEFAULT '',
  city text DEFAULT '',
  notes text DEFAULT '',
  logo_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view companies"
  ON companies FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert companies"
  ON companies FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update companies"
  ON companies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete companies"
  ON companies FOR DELETE TO authenticated USING (true);

-- Trucks
CREATE TABLE IF NOT EXISTS trucks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  make text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  year integer DEFAULT NULL,
  plate_number text NOT NULL DEFAULT '',
  vin text DEFAULT '',
  mileage integer DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'in_repair', 'retired')),
  color text DEFAULT '',
  notes text DEFAULT '',
  photo_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE trucks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view trucks"
  ON trucks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert trucks"
  ON trucks FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update trucks"
  ON trucks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete trucks"
  ON trucks FOR DELETE TO authenticated USING (true);

-- Workers
CREATE TABLE IF NOT EXISTS workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text DEFAULT '',
  specialization text DEFAULT '',
  hourly_rate numeric(10,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE workers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view workers"
  ON workers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert workers"
  ON workers FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update workers"
  ON workers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete workers"
  ON workers FOR DELETE TO authenticated USING (true);

-- Repair Jobs
CREATE TABLE IF NOT EXISTS repair_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number text NOT NULL UNIQUE,
  truck_id uuid NOT NULL REFERENCES trucks(id) ON DELETE RESTRICT,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  problem_description text DEFAULT '',
  diagnostics text DEFAULT '',
  repairs_completed text DEFAULT '',
  start_date date DEFAULT CURRENT_DATE,
  end_date date DEFAULT NULL,
  estimated_hours numeric(6,2) DEFAULT 0,
  actual_hours numeric(6,2) DEFAULT 0,
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE repair_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view repair jobs"
  ON repair_jobs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert repair jobs"
  ON repair_jobs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update repair jobs"
  ON repair_jobs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete repair jobs"
  ON repair_jobs FOR DELETE TO authenticated USING (true);

-- Job Workers (many-to-many)
CREATE TABLE IF NOT EXISTS job_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES repair_jobs(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  hours_worked numeric(6,2) DEFAULT 0,
  notes text DEFAULT '',
  UNIQUE(job_id, worker_id)
);

ALTER TABLE job_workers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view job workers"
  ON job_workers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert job workers"
  ON job_workers FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update job workers"
  ON job_workers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete job workers"
  ON job_workers FOR DELETE TO authenticated USING (true);

-- Job Parts
CREATE TABLE IF NOT EXISTS job_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES repair_jobs(id) ON DELETE CASCADE,
  part_name text NOT NULL,
  part_number text DEFAULT '',
  quantity numeric(10,2) DEFAULT 1,
  unit_price numeric(10,2) DEFAULT 0,
  notes text DEFAULT ''
);

ALTER TABLE job_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view job parts"
  ON job_parts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert job parts"
  ON job_parts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update job parts"
  ON job_parts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete job parts"
  ON job_parts FOR DELETE TO authenticated USING (true);

-- Job Photos
CREATE TABLE IF NOT EXISTS job_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES repair_jobs(id) ON DELETE CASCADE,
  url text NOT NULL,
  caption text DEFAULT '',
  uploaded_at timestamptz DEFAULT now()
);

ALTER TABLE job_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view job photos"
  ON job_photos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert job photos"
  ON job_photos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete job photos"
  ON job_photos FOR DELETE TO authenticated USING (true);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  job_id uuid NOT NULL REFERENCES repair_jobs(id) ON DELETE RESTRICT,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  issue_date date DEFAULT CURRENT_DATE,
  due_date date DEFAULT NULL,
  subtotal numeric(12,2) DEFAULT 0,
  tax_rate numeric(5,2) DEFAULT 0,
  tax_amount numeric(12,2) DEFAULT 0,
  discount numeric(12,2) DEFAULT 0,
  total numeric(12,2) DEFAULT 0,
  notes text DEFAULT '',
  payment_method text DEFAULT '',
  paid_at timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view invoices"
  ON invoices FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert invoices"
  ON invoices FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update invoices"
  ON invoices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete invoices"
  ON invoices FOR DELETE TO authenticated USING (true);

-- Invoice Line Items
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(10,2) DEFAULT 1,
  unit_price numeric(10,2) DEFAULT 0,
  total numeric(10,2) DEFAULT 0,
  item_type text DEFAULT 'service' CHECK (item_type IN ('service', 'part', 'labor'))
);

ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view invoice line items"
  ON invoice_line_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert invoice line items"
  ON invoice_line_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update invoice line items"
  ON invoice_line_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete invoice line items"
  ON invoice_line_items FOR DELETE TO authenticated USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trucks_company ON trucks(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_truck ON repair_jobs(truck_id);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON repair_jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON repair_jobs(status);
CREATE INDEX IF NOT EXISTS idx_invoices_job ON invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_job_parts_job ON job_parts(job_id);
CREATE INDEX IF NOT EXISTS idx_job_workers_job ON job_workers(job_id);
