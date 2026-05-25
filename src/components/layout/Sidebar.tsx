import { NavLink } from './NavLink';
import { useApp } from '../../contexts/AppContext';
import {
  LayoutDashboard, Building2, Truck, ClipboardList,
  Users, FileText, Search, Settings, Wrench, LogOut, X
} from 'lucide-react';

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const { t, signOut, profile, isRTL } = useApp();

  const navItems = [
    { to: '/', icon: <LayoutDashboard className="w-5 h-5" />, label: t('dashboard') },
    { to: '/companies', icon: <Building2 className="w-5 h-5" />, label: t('companies') },
    { to: '/trucks', icon: <Truck className="w-5 h-5" />, label: t('trucks') },
    { to: '/jobs', icon: <ClipboardList className="w-5 h-5" />, label: t('jobs') },
    { to: '/workers', icon: <Users className="w-5 h-5" />, label: t('workers') },
    { to: '/invoices', icon: <FileText className="w-5 h-5" />, label: t('invoices') },
    { to: '/search', icon: <Search className="w-5 h-5" />, label: t('search') },
    { to: '/settings', icon: <Settings className="w-5 h-5" />, label: t('settings') },
  ];

  const content = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">{t('appName')}</p>
            <p className="text-xs text-slate-400">Garage Pro</p>
          </div>
        </div>
        <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} icon={item.icon} label={item.label} onClick={onClose} isRTL={isRTL} />
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-slate-700/50">
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {profile?.full_name ? profile.full_name[0].toUpperCase() : 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{profile?.full_name || 'User'}</p>
            <p className="text-xs text-slate-400 capitalize">{profile?.role || 'worker'}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          {t('logout')}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 border-r border-slate-700/50 h-full flex-shrink-0">
        {content}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />
          <aside className={`absolute top-0 ${isRTL ? 'right-0' : 'left-0'} w-72 h-full bg-slate-900 border-r border-slate-700/50 z-50 flex flex-col`}>
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
