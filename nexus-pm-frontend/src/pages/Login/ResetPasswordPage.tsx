import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { confirmPasswordReset } from '@/api/auth.api';

const PASSWORD_HINT =
  'At least 8 characters with upper, lower, digit, and special character (@#$%^&+=!).';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('Reset link is missing or invalid.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordReset(token, password);
      setDone(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string; message?: string } } })?.response?.data
          ?.detail ??
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Unable to reset password. The link may have expired.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center p-4"
      style={{ background: 'var(--gradient-header)' }}
    >
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="card p-8 shadow-theme-lg">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-muted text-lg font-bold text-accent">
              DF
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Set new password</h1>
            <p className="mt-2 text-text2">Choose a strong password for your account.</p>
          </div>

          {done ? (
            <div className="space-y-4">
              <p className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-text">
                Your password has been updated. You can sign in with the new password.
              </p>
              <Link to="/login" className="btn-primary block w-full py-2.5 text-center">
                Sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!token && (
                <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  This reset link is invalid. Request a new one from the forgot password page.
                </p>
              )}

              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-text2">
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <p className="mt-1 text-xs text-text2">{PASSWORD_HINT}</p>
              </div>

              <div>
                <label htmlFor="confirm" className="mb-1 block text-sm font-medium text-text2">
                  Confirm password
                </label>
                <input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input-field"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !token}
                className="btn-primary w-full py-2.5 disabled:opacity-50"
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>

              <p className="text-center text-sm text-text2">
                <Link to="/forgot-password" className="text-accent hover:underline">
                  Request a new link
                </Link>
                {' · '}
                <Link to="/login" className="text-accent hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
