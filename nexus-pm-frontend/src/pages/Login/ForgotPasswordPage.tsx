import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { requestPasswordReset } from '@/api/auth.api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch {
      setError('Unable to send reset email. Please try again.');
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
            <h1 className="text-2xl font-bold tracking-tight">Forgot password</h1>
            <p className="mt-2 text-text2">
              Enter your account email and we will send a reset link if it exists.
            </p>
          </div>

          {sent ? (
            <div className="space-y-4">
              <p className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-text">
                If an account exists for <span className="font-medium">{email}</span>, a password reset
                link has been sent. Check your inbox and spam folder.
              </p>
              <Link to="/login" className="btn-primary block w-full py-2.5 text-center">
                Back to sign in
              </Link>
            </div>
          ) : (
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
                  required
                  autoComplete="email"
                />
              </div>

              {error && (
                <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
                {loading ? 'Sending…' : 'Send reset link'}
              </button>

              <p className="text-center text-sm text-text2">
                <Link to="/login" className="text-accent hover:underline">
                  Back to sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
