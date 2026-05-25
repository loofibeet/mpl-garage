import { ReactNode } from 'react';

type Variant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

const variants: Record<Variant, string> = {
  default: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  info: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  neutral: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300',
};

interface BadgeProps {
  children: ReactNode;
  variant?: Variant;
  className?: string;
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}

export function statusVariant(status: string): Variant {
  switch (status) {
    case 'active': case 'completed': case 'paid': return 'success';
    case 'in_progress': case 'sent': return 'info';
    case 'pending': case 'draft': return 'warning';
    case 'cancelled': case 'overdue': case 'retired': return 'error';
    case 'in_repair': return 'warning';
    default: return 'neutral';
  }
}

export function priorityVariant(priority: string): Variant {
  switch (priority) {
    case 'urgent': return 'error';
    case 'high': return 'warning';
    case 'normal': return 'info';
    case 'low': return 'neutral';
    default: return 'default';
  }
}
