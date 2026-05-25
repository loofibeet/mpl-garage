// ============================================================
// storage.ts — localStorage (instant UI) + Firebase (cloud sync)
// Pages do NOT need any changes
// ============================================================
import {
  collection, getDocs, setDoc, deleteDoc, doc
} from 'firebase/firestore';
import { firestore } from './firebase';

export interface LocalUser {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'worker';
}

const DATA_TABLES = [
  'companies', 'trucks', 'repair_jobs', 'workers',
  'job_workers', 'job_parts', 'invoices', 'invoice_line_items',
];

// ─── tiny ID generator ───────────────────────────────────────
function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ─── localStorage helpers ────────────────────────────────────
function read<T>(table: string): T[] {
  try { return JSON.parse(localStorage.getItem(`garage_${table}`) ?? '[]'); }
  catch { return []; }
}
function write<T>(table: string, data: T[]): void {
  localStorage.setItem(`garage_${table}`, JSON.stringify(data));
}

// ─── Firebase sync helpers ───────────────────────────────────
async function pushToCloud(table: string, id: string, data: Record<string, unknown>): Promise<void> {
  try { await setDoc(doc(firestore, table, id), data, { merge: true }); }
  catch (e) { console.warn('Firebase push failed:', e); }
}

async function deleteFromCloud(table: string, id: string): Promise<void> {
  try { await deleteDoc(doc(firestore, table, id)); }
  catch (e) { console.warn('Firebase delete failed:', e); }
}

// ─── Pull ALL data from Firebase into localStorage ────────────
export async function syncFromCloud(): Promise<void> {
  try {
    for (const table of DATA_TABLES) {
      const snapshot = await getDocs(collection(firestore, table));
      if (!snapshot.empty) {
        const rows = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
        write(table, rows);
      }
    }
  } catch (e) {
    console.warn('Firebase sync failed (offline?):', e);
  }
}

// ─── Push ALL localStorage data to Firebase ──────────────────
export async function pushAllToCloud(): Promise<void> {
  for (const table of DATA_TABLES) {
    const rows = read<Record<string, unknown>>(table);
    for (const row of rows) {
      if (row.id) await pushToCloud(table, row.id as string, row);
    }
  }
}

// ─── database (db) ───────────────────────────────────────────
export const db = {
  getAll<T>(table: string): T[] {
    return read<T>(table);
  },

  getById<T extends { id: string }>(table: string, id: string): T | null {
    return read<T>(table).find(r => r.id === id) ?? null;
  },

  insert<T extends object>(table: string, item: T): T & { id: string } {
    const rows = read<T & { id: string }>(table);
    const now = new Date().toISOString();
    const newRow = { ...item, id: genId(), created_at: now, updated_at: now } as T & { id: string };
    rows.push(newRow);
    write(table, rows);
    pushToCloud(table, newRow.id, newRow as Record<string, unknown>);
    return newRow;
  },

  update<T extends { id: string }>(table: string, id: string, changes: Partial<T>): T | null {
    const rows = read<T>(table);
    const idx = rows.findIndex(r => r.id === id);
    if (idx === -1) return null;
    rows[idx] = { ...rows[idx], ...changes, updated_at: new Date().toISOString() } as T;
    write(table, rows);
    pushToCloud(table, id, rows[idx] as Record<string, unknown>);
    return rows[idx];
  },

  remove(table: string, id: string): void {
    write(table, read(table).filter((r: any) => r.id !== id));
    deleteFromCloud(table, id);
  },
};

// removeWhere used in Jobs and Invoices
export function removeWhere(table: string, field: string, value: string): void {
  const rows = read<Record<string, unknown>>(table);
  const toDelete = rows.filter(r => r[field] === value);
  write(table, rows.filter(r => r[field] !== value));
  toDelete.forEach(r => { if (r.id) deleteFromCloud(table, r.id as string); });
}

// ─── auth (localStorage based) ───────────────────────────────
export const auth = {
  init(): void {
    const users = read('users');
    if (users.length === 0) {
      write('users', [{
        id: genId(), email: 'admin@garage.com', password: 'admin123',
        full_name: 'Admin', role: 'admin', created_at: new Date().toISOString(),
      }]);
    }
  },

  login(email: string, password: string): LocalUser {
    const users = read<LocalUser & { password: string }>('users');
    const found = users.find(u => u.email === email && u.password === password);
    if (!found) throw new Error('Invalid email or password');
    const session: LocalUser = { id: found.id, email: found.email, full_name: found.full_name, role: found.role };
    localStorage.setItem('garage_session', JSON.stringify(session));
    return session;
  },

  signUp(email: string, password: string, fullName: string): LocalUser {
    const users = read<LocalUser & { password: string }>('users');
    if (users.find(u => u.email === email)) throw new Error('Email already in use');
    if (password.length < 6) throw new Error('Password must be at least 6 characters');
    const newUser = { id: genId(), email, password, full_name: fullName, role: 'worker' as const, created_at: new Date().toISOString() };
    users.push(newUser);
    write('users', users);
    const session: LocalUser = { id: newUser.id, email: newUser.email, full_name: newUser.full_name, role: newUser.role };
    localStorage.setItem('garage_session', JSON.stringify(session));
    return session;
  },

  getSession(): LocalUser | null {
    try { const raw = localStorage.getItem('garage_session'); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  },

  logout(): void { localStorage.removeItem('garage_session'); },
};
