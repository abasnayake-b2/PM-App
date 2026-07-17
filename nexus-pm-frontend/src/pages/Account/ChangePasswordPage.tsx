import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { changePassword } from '@/api/auth.api';
import { useAuthStore } from '@/store/useAuthStore';
import { authUserFromToken } from '@/utils/permissions';

const PASSWORD_HINT =
  'At least 8 characters with upper, lower, digit, and special character (@#$%^&+=!).';

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const user = useAuthStore((s) => s.user);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) {
      setError('New passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const data = await changePassword(currentPassword, newPassword);
      setSession(data.accessToken, authUserFromToken(data));
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string; message?: string } } })?.response?.data
          ?.detail ??
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Unable to change password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Change password</h1>
      <p className="mt-1 text-sm text-text2">
        {user?.passwordChangeDue
          ? 'Your password is over 3 months old. Please set a new password.'
          : 'Update your account password.'}
      </p>

      <form onSubmit={handleSubmit} className="card mt-6 space-y-4 p-6">
        <div>
          <label htmlFor="current" className="mb-1 block text-sm font-medium text-text2">
            Current password
          </label>
          <input
            id="current"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="input-field"
            required
            autoComplete="current-password"
          />
        </div>

        <div>
          <label htmlFor="new" className="mb-1 block text-sm font-medium text-text2">
            New password
          </label>
          <input
            id="new"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="input-field"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <p className="mt-1 text-xs text-text2">{PASSWORD_HINT}</p>
        </div>

        <div>
          <label htmlFor="confirm" className="mb-1 block text-sm font-medium text-text2">
            Confirm new password
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

        <div className="flex flex-wrap gap-3 pt-2">
          <button type="submit" disabled={loading} className="btn-primary px-4 py-2">
            {loading ? 'Saving…' : 'Save password'}
          </button>
          <Link
            to="/"
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-bg3"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
