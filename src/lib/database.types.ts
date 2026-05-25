export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>;
      };
      companies: {
        Row: Company;
        Insert: Omit<Company, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Company, 'id' | 'created_at'>>;
      };
      trucks: {
        Row: Truck;
        Insert: Omit<Truck, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Truck, 'id' | 'created_at'>>;
      };
      workers: {
        Row: Worker;
        Insert: Omit<Worker, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Worker, 'id' | 'created_at'>>;
      };
      repair_jobs: {
        Row: RepairJob;
        Insert: Omit<RepairJob, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<RepairJob, 'id' | 'created_at'>>;
      };
      job_workers: {
        Row: JobWorker;
        Insert: Omit<JobWorker, 'id'>;
        Update: Partial<Omit<JobWorker, 'id'>>;
      };
      job_parts: {
        Row: JobPart;
        Insert: Omit<JobPart, 'id'>;
        Update: Partial<Omit<JobPart, 'id'>>;
      };
      job_photos: {
        Row: JobPhoto;
        Insert: Omit<JobPhoto, 'id' | 'uploaded_at'>;
        Update: Partial<Omit<JobPhoto, 'id'>>;
      };
      invoices: {
        Row: Invoice;
        Insert: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Invoice, 'id' | 'created_at'>>;
      };
      invoice_line_items: {
        Row: InvoiceLineItem;
        Insert: Omit<InvoiceLineItem, 'id'>;
        Update: Partial<Omit<InvoiceLineItem, 'id'>>;
      };
    };
  };
}

export interface Profile {
  id: string;
  full_name: string;
  role: 'admin' | 'worker';
  phone: string;
  avatar_url: string;
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  notes: string;
  logo_url: string;
  created_at: string;
  updated_at: string;
}

export interface Truck {
  id: string;
  company_id: string;
  make: string;
  model: string;
  year: number | null;
  plate_number: string;
  vin: string;
  mileage: number;
  status: 'active' | 'in_repair' | 'retired';
  color: string;
  notes: string;
  photo_url: string;
  created_at: string;
  updated_at: string;
}

export interface Worker {
  id: string;
  profile_id: string | null;
  name: string;
  phone: string;
  specialization: string;
  hourly_rate: number;
  status: 'active' | 'inactive';
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface RepairJob {
  id: string;
  job_number: string;
  truck_id: string;
  company_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  problem_description: string;
  diagnostics: string;
  repairs_completed: string;
  start_date: string;
  end_date: string | null;
  estimated_hours: number;
  actual_hours: number;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobWorker {
  id: string;
  job_id: string;
  worker_id: string;
  hours_worked: number;
  notes: string;
}

export interface JobPart {
  id: string;
  job_id: string;
  part_name: string;
  part_number: string;
  quantity: number;
  unit_price: number;
  notes: string;
}

export interface JobPhoto {
  id: string;
  job_id: string;
  url: string;
  caption: string;
  uploaded_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  job_id: string;
  company_id: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount: number;
  total: number;
  notes: string;
  payment_method: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  item_type: 'service' | 'part' | 'labor';
}
