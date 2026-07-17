import { Bell } from 'lucide-react';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/hooks/useNotifications';
import clsx from 'clsx';

const TYPE_LABELS: Record<string, string> = {
  ALLOCATION: 'Allocation',
  OVER_ALLOCATION: 'Capacity',
};

export function NotificationsPage() {
  const { data: notifications, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unread = notifications?.filter((n) => !n.read).length ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Bell className="text-accent" size={28} />
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-text2">In-app alerts and updates</p>
          </div>
        </div>
        {unread > 0 && (
          <button
            type="button"
            onClick={() => markAllRead.mutate()}
            className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-bg3"
          >
            Mark all read ({unread})
          </button>
        )}
      </div>

      {isLoading && <p className="mt-8 text-text2">Loading…</p>}

      <ul className="mt-8 space-y-3">
        {notifications?.map((n) => (
          <li
            key={n.id}
            className={clsx('card p-4', !n.read && 'border-accent/30 bg-accent/5')}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{n.title}</h3>
                  {n.type && (
                    <span className="rounded bg-bg3 px-2 py-0.5 text-xs text-text2">
                      {TYPE_LABELS[n.type] ?? n.type}
                    </span>
                  )}
                </div>
                {n.body && <p className="mt-1 text-sm text-text2">{n.body}</p>}
                <p className="mt-2 text-xs text-text2">
                  {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                </p>
              </div>
              {!n.read && (
                <button
                  type="button"
                  onClick={() => markRead.mutate(n.id)}
                  className="shrink-0 text-xs text-accent hover:underline"
                >
                  Mark read
                </button>
              )}
            </div>
          </li>
        ))}
        {!isLoading && (!notifications || notifications.length === 0) && (
          <p className="text-text2">No notifications yet.</p>
        )}
      </ul>
    </div>
  );
}
