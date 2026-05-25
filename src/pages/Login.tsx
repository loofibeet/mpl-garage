import { useState } from 'react';
import { Wrench, Eye, EyeOff } from 'lucide-react';
import { auth } from '../lib/storage';
import { useApp } from '../contexts/AppContext';
import { Button } from '../components/ui/Button';

export function Login() {
  const { t, refreshProfile } = useApp();
  const [mode, setMode]       = useState<'signin' | 'signup'>('signin');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]  = useState(false);
  const [error, setError]      = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        auth.signUp(email, password, fullName);
      } else {
        auth.login(email, password);
      }
      refreshProfile();          // tells AppContext a user is now logged in
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-orange-500 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-orange-600 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 text-white max-w-md">
          <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mb-8 shadow-2xl">
            <Wrench className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-4 leading-tight">
            TruckGarage<br /><span className="text-orange-400">Pro</span>
          </h1>
          <p className="text-slate-300 text-lg leading-relaxed">
            Professional garage management system for truck repair workshops.
            Manage clients, trucks, work orders, workers, and invoices all in one place.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4">
            {[
              { label: 'Work Orders',   value: 'Full Tracking' },
              { label: 'Invoices',      value: 'PDF Ready'     },
              { label: 'Multi-language',value: 'AR / FR / EN'  },
              { label: 'Mobile First',  value: 'Responsive'    },
            ].map(item => (
              <div key={item.label} className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-orange-400 font-bold text-sm">{item.value}</p>
                <p className="text-slate-400 text-xs mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
          {/* Default credentials hint */}
          <div className="mt-8 bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
            <p className="text-orange-300 text-sm font-semibold mb-1">Default login</p>
            <p className="text-slate-400 text-xs">Email: admin@garage.com</p>
            <p className="text-slate-400 text-xs">Password: admin123</p>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
              <Wrench className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">TruckGarage Pro</span>
          </div>

          <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-2">
              {mode === 'signin' ? t('signIn') : t('signUp')}
            </h2>
            <p className="text-slate-400 text-sm mb-8">
              {mode === 'signin'
                ? 'Welcome back! Sign in to your account.'
                : 'Create an account to get started.'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === 'signup' && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-300">{t('name')}</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Your full name"
                    required
                    className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-3 text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-300">{t('email')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@garage.com"
                  required
                  className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-3 text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-300">{t('password')}</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-3 pr-12 text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <Button type="submit" size="lg" className="w-full justify-center" loading={loading}>
                {mode === 'signin' ? t('signIn') : t('signUp')}
              </Button>
            </form>

            <p className="text-center text-sm text-slate-400 mt-6">
              {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(''); }}
                className="text-orange-400 hover:text-orange-300 font-medium transition-colors"
              >
                {mode === 'signin' ? t('signUp') : t('signIn')}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
