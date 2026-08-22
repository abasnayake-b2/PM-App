import { FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { Eye, EyeOff, ShieldCheck, Sparkles } from 'lucide-react';
import { login } from '@/api/auth.api';
import { ensureAccessToken } from '@/api/axios';
import { useAuthStore } from '@/store/useAuthStore';
import { useUIStore } from '@/store/useUIStore';
import { authUserFromToken } from '@/utils/permissions';
import {
  clearRememberedLogin,
  loadRememberedLogin,
  saveRememberedLogin,
} from '@/utils/rememberLogin';
import { IDLE_TIMEOUT_MINUTES } from '@/hooks/useIdleLogout';

const DIRECTFN_LOGO = '/directfn-login-bg.png';
const DIRECTFN_VIDEO = '/directfn-login-bg.mp4';

const remembered = loadRememberedLogin();

const STATS = [
  { value: '100+', label: 'Corporate clients' },
  { value: '13', label: 'Countries' },
  { value: '05', label: 'Offices' },
  { value: '500+', label: 'Professionals' },
] as const;

function postLoginPath(
  passwordChangeDue: boolean | undefined,
  fromPathname: string | undefined,
) {
  if (passwordChangeDue) return '/account/change-password';
  if (fromPathname && fromPathname !== '/login') return fromPathname;
  return '/';
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromState = (location.state as { from?: { pathname?: string }; idleTimeout?: boolean } | null)
    ?.from?.pathname;
  const idleTimeout =
    (location.state as { idleTimeout?: boolean } | null)?.idleTimeout === true ||
    new URLSearchParams(location.search).get('reason') === 'idle';
  const fromQuery = new URLSearchParams(location.search).get('next') ?? undefined;
  const fromPathname = fromState || fromQuery;
  const setSession = useAuthStore((s) => s.setSession);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [email, setEmail] = useState(remembered?.email ?? '');
  const [password, setPassword] = useState(remembered?.password ?? '');
  const [rememberMe, setRememberMe] = useState(!!remembered);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(() => {
    if (typeof window === 'undefined') return true;
    if (new URLSearchParams(window.location.search).get('reason') === 'idle') return false;
    return !useAuthStore.getState().accessToken;
  });

  // Login is always dark (no theme / glass picker). Restore app preference on leave.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', 'dark');
    root.setAttribute('data-glass', 'off');
    return () => {
      const { theme, glassEnabled } = useUIStore.getState();
      root.setAttribute('data-theme', theme);
      root.setAttribute('data-glass', glassEnabled ? 'on' : 'off');
    };
  }, []);

  // If a refresh cookie still exists, restore the session instead of showing login.
  useEffect(() => {
    if (idleTimeout) {
      setRestoring(false);
      return;
    }
    if (accessToken) {
      setRestoring(false);
      navigate(postLoginPath(false, fromPathname), { replace: true });
      return;
    }

    let cancelled = false;
    void ensureAccessToken().then((token) => {
      if (cancelled) return;
      if (token) {
        navigate(postLoginPath(false, fromPathname), { replace: true });
      } else {
        setRestoring(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [accessToken, fromPathname, idleTimeout, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login({ email, password });
      if (rememberMe) {
        saveRememberedLogin(email, password);
      } else {
        clearRememberedLogin();
      }
      setSession(data.accessToken, authUserFromToken(data));
      navigate(postLoginPath(data.passwordChangeDue, fromPathname));
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

  if (restoring) {
    return (
      <div className="login-shell flex min-h-screen items-center justify-center bg-[#07122f] text-sm text-white/70">
        Restoring session…
      </div>
    );
  }

  return (
    <div className="login-shell relative flex min-h-screen">
      <aside className="login-brand-panel relative hidden w-[78%] bg-[#07122f] lg:block">
        <video
          className="login-brand-media absolute inset-0 h-full w-full object-contain object-center"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={DIRECTFN_LOGO}
          aria-hidden
        >
          <source src={DIRECTFN_VIDEO} type="video/mp4" />
        </video>
        <img
          src={DIRECTFN_LOGO}
          alt=""
          className="login-brand-fallback absolute inset-0 h-full w-full object-contain object-center"
          aria-hidden
        />
        <div className="login-brand-content">
          <p className="login-brand-mark">DirectFN</p>
          <div className="login-stats">
            {STATS.map((stat) => (
              <div key={stat.label} className="login-stat">
                <div className="login-stat-value">{stat.value}</div>
                <div className="login-stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="login-mobile-banner bg-[#07122f] lg:hidden">
        <video
          className="login-brand-media absolute inset-0 h-full w-full object-contain object-center"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={DIRECTFN_LOGO}
          aria-hidden
        >
          <source src={DIRECTFN_VIDEO} type="video/mp4" />
        </video>
        <img
          src={DIRECTFN_LOGO}
          alt=""
          className="login-brand-fallback absolute inset-0 h-full w-full object-contain object-center"
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-3 z-10 px-4 text-center">
          <p
            className="text-2xl font-extrabold italic tracking-tight text-white drop-shadow-md"
            style={{ fontFamily: "'Plus Jakarta Sans', Inter, system-ui, sans-serif" }}
          >
            DirectFN
          </p>
        </div>
      </div>

      <div className="login-form-panel relative flex w-full flex-1 items-center justify-center px-3 pb-10 pt-36 lg:w-[22%] lg:px-3 lg:pt-8">
        <div className="login-orb login-orb-a hidden lg:block" aria-hidden />
        <div className="login-orb login-orb-b hidden lg:block" aria-hidden />
        <div className="login-orb login-orb-c hidden lg:block" aria-hidden />

        <div className="relative z-10 w-full max-w-[20rem]">
          <div className="login-card p-5 sm:p-6">
            <div className="mb-7 text-center">
              <div className="mx-auto mb-3 inline-flex items-center gap-1.5 rounded-full border border-[color:var(--accent)]/25 bg-[color:var(--accent-muted)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                <Sparkles size={12} />
                DirectFN
              </div>
              <h2 className="login-product-title text-2xl text-text">DFN-PlanX</h2>
              <p className="mt-2 text-sm text-text2">
                Sign in to plan projects, capacity, and delivery.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-text2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field bg-bg2"
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-text2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field bg-bg2 pr-11"
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

              <label className="flex cursor-pointer items-center gap-2 text-sm text-text2">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setRememberMe(checked);
                    if (!checked) {
                      clearRememberedLogin();
                    }
                  }}
                  className="rounded border-border accent-[var(--accent)]"
                />
                Remember me on this device
              </label>

              {idleTimeout && !error && (
                <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-text">
                  You were signed out after {IDLE_TIMEOUT_MINUTES} minute
                  {IDLE_TIMEOUT_MINUTES === 1 ? '' : 's'} of inactivity.
                </p>
              )}
              {error && (
                <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="login-submit btn-primary w-full py-2.5 text-[15px] font-semibold"
                style={{ color: 'var(--accent-fg)' }}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <div className="mt-6 grid grid-cols-1 gap-2.5 border-t border-border/80 pt-4 text-xs text-text2">
              <div className="flex items-start gap-2">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent" />
                <span>Secure access to backlog & capacity planning</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
