import { ReactNode } from 'react';

interface NavLinkProps {
  to: string;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  isRTL?: boolean;
  currentPath?: string;
}

export function NavLink({ to, icon, label, onClick, isRTL, currentPath }: NavLinkProps) {
  const path = currentPath || window.location.pathname;
  const isActive = to === '/' ? path === '/' : path.startsWith(to);

  return (
    <a
      href={to}
      onClick={(e) => {
        e.preventDefault();
        window.history.pushState({}, '', to);
        window.dispatchEvent(new PopStateEvent('popstate'));
        onClick?.();
      }}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
        isActive
          ? 'bg-orange-500 text-white shadow-sm'
          : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
      } ${isRTL ? 'flex-row-reverse' : ''}`}
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}
