import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { Eye, EyeOff } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { login } from '@/api/auth.api';
import { useAuthStore } from '@/store/useAuthStore';
import { authUserFromToken } from '@/utils/permissions';

const DIRECTFN_LOGO = '/directfn-login-bg.png';

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('admin@dfnpm.local');
  const [password, setPassword] = useState('Admin@12345');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login({ email, password });
      setSession(data.accessToken, authUserFromToken(data));
      navigate(data.passwordChangeDue ? '/account/change-password' : '/');
    } catch (err) {
      if (isAxiosError(err)) {
        const data = err.response?.data as
          | { detail?: string; title?: string; message?: string }
          | undefined;
        if (err.response?.status === 423 || data?.title === 'ACCOUNT_LOCKED') {
          setError(data?.detail ?? 'Account locked. Contact your administrator.');
        } else if (err.code === 'ERR_NETWORK' || !err.response) {
          setError('Unable to reach the server. Please try again.');
        } else {
          setError(data?.detail ?? data?.message ?? 'Invalid email or password');
        }
      } else {
        setError('Invalid email or password');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen">
      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>

      {/* DirectFN brand panel — full height on large screens */}
      <aside className="relative hidden w-[52%] overflow-hidden lg:block">
        <img
          src={DIRECTFN_LOGO}
          alt="DirectFN"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
      </aside>

      {/* Mobile brand strip */}
      <div className="absolute inset-x-0 top-0 h-28 overflow-hidden lg:hidden">
        <img
          src={DIRECTFN_LOGO}
          alt=""
          className="h-full w-full object-cover object-center"
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-bg/90" />
      </div>

      <div className="relative flex w-full flex-1 items-center justify-center bg-bg px-4 pb-8 pt-32 lg:w-[48%] lg:pt-8">
        <div className="w-full max-w-md">
          <div className="card p-8 shadow-theme-lg">
            <div className="mb-8 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text3">DirectFN</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight">DFN-PlaniX</h1>
              <p className="mt-2 text-text2">Sign in to your account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-text2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-text2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pr-11"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-text2 hover:text-text"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <div className="mt-6 rounded-lg border border-border bg-bg3/60 px-3 py-3 text-center text-sm text-text2">
              <p className="font-medium text-text">Demo account</p>
              <p className="mt-1 tabular-nums">
                <span className="text-text">admin@dfnpm.local</span>
                <span className="mx-1.5 text-text3">·</span>
                <span className="text-text">Admin@12345</span>
              </p>
              <button
                type="button"
                className="mt-2 text-xs font-medium text-accent hover:underline"
                onClick={() => {
                  setEmail('admin@dfnpm.local');
                  setPassword('Admin@12345');
                  setError('');
                }}
              >
                Fill demo credentials
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
