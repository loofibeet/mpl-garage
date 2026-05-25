import { useEffect, useState } from 'react';
import { AppProvider, useApp } from './contexts/AppContext';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Companies } from './pages/Companies';
import { Trucks } from './pages/Trucks';
import { Jobs } from './pages/Jobs';
import { Workers } from './pages/Workers';
import { Invoices } from './pages/Invoices';
import { Search } from './pages/Search';
import { Settings } from './pages/Settings';

function Router() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  if (path === '/' || path === '') return <Dashboard />;
  if (path.startsWith('/companies')) return <Companies />;
  if (path.startsWith('/trucks')) return <Trucks />;
  if (path.startsWith('/jobs')) return <Jobs />;
  if (path.startsWith('/workers')) return <Workers />;
  if (path.startsWith('/invoices')) return <Invoices />;
  if (path.startsWith('/search')) return <Search />;
  if (path.startsWith('/settings')) return <Settings />;
  return <Dashboard />;
}

function AppContent() {
  const { user, loading } = useApp();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading TruckGarage Pro...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;
  return <Router />;
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
