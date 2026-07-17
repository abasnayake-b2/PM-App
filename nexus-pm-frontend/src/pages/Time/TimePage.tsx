import { FormEvent, useState } from 'react';
import { Clock } from 'lucide-react';
import { useCreateTimeLog, useTasks, useTimeLogs, useWeeklySummary } from '@/hooks/useResources';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function TimePage() {
  const { data: summary } = useWeeklySummary();
  const { data: logs, isLoading } = useTimeLogs();
  const { data: tasks } = useTasks();
  const createLog = useCreateTimeLog();

  const [taskId, setTaskId] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState('1');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  const maxDayHours = summary?.days.reduce((m, d) => Math.max(m, Number(d.hours)), 0) ?? 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!taskId) {
      setFormError('Select a task');
      return;
    }
    try {
      await createLog.mutateAsync({
        taskId,
        logDate,
        hours: parseFloat(hours),
        notes: notes || undefined,
      });
      setNotes('');
      setHours('1');
    } catch {
      setFormError('Failed to log time');
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <Clock className="text-accent" size={28} />
        <div>
          <h1 className="text-2xl font-bold">Time</h1>
          <p className="text-text2">Log hours and review your week</p>
        </div>
      </div>

      {summary && (
        <section className="mt-8 card p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-semibold">This week</h2>
              <p className="text-sm text-text2">
                {summary.weekStart} → {summary.weekEnd}
              </p>
            </div>
            <p className="text-3xl font-bold">{summary.totalHours}h</p>
          </div>
          <div className="mt-6 flex items-end justify-between gap-2" style={{ height: 120 }}>
            {summary.days.map((day, i) => {
              const h = Number(day.hours);
              const pct = maxDayHours > 0 ? (h / maxDayHours) * 100 : 0;
              return (
                <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-md bg-accent transition-all"
                      style={{ height: `${Math.max(pct, h > 0 ? 8 : 0)}%` }}
                      title={`${h}h`}
                    />
                  </div>
                  <span className="text-xs text-text2">{DAY_LABELS[i]}</span>
                  <span className="text-xs font-medium">{h}h</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-semibold">Log time</h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <label className="block text-sm">
              <span className="text-text2">Task</span>
              <select
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm"
              >
                <option value="">Select task…</option>
                {tasks?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.projectName} — {t.issueTitle}: {t.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm">
                <span className="text-text2">Date</span>
                <input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="text-text2">Hours</span>
                <input
                  type="number"
                  min="0.25"
                  max="24"
                  step="0.25"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm"
                  required
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="text-text2">Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm"
              />
            </label>
            {formError && <p className="text-sm text-danger">{formError}</p>}
            <button
              type="submit"
              disabled={createLog.isPending}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              style={{ color: 'var(--accent-fg)' }}
            >
              {createLog.isPending ? 'Saving…' : 'Log time'}
            </button>
          </form>
        </section>

        <section className="card p-6">
          <h2 className="font-semibold">Recent entries</h2>
          {isLoading && <p className="mt-4 text-text2">Loading…</p>}
          <ul className="mt-4 divide-y divide-border">
            {logs?.map((log) => (
              <li key={log.id} className="py-3 first:pt-0">
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-medium">{log.taskTitle}</p>
                    <p className="text-sm text-text2">
                      {log.projectName} · {log.logDate}
                    </p>
                    {log.notes && <p className="mt-1 text-xs text-text2">{log.notes}</p>}
                  </div>
                  <span className="shrink-0 font-semibold">{log.hours}h</span>
                </div>
              </li>
            ))}
            {!isLoading && (!logs || logs.length === 0) && (
              <li className="py-4 text-text2">No time logged yet.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
