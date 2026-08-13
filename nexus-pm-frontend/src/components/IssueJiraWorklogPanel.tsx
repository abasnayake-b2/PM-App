import { useQuery } from '@tanstack/react-query';
import { fetchIssueJiraWorklogs, type JiraWorklogEntry, type JiraWorklogResponse } from '@/api/issues.api';

function formatTotal(seconds: number): string {
  if (seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function TimeTrackingSummary({ data }: { data: JiraWorklogResponse }) {
  const originalLabel = data.originalEstimate ?? (data.originalEstimateSeconds != null
    ? formatTotal(data.originalEstimateSeconds)
    : '—');
  const loggedSeconds = data.timeSpentSeconds ?? data.totalTimeSpentSeconds ?? 0;
  const loggedLabel = data.timeSpent ?? formatTotal(loggedSeconds);
  const remainingSeconds =
    data.remainingEstimateSeconds ??
    (data.originalEstimateSeconds != null
      ? Math.max(0, data.originalEstimateSeconds - loggedSeconds)
      : 0);
  const remainingLabel = data.remainingEstimate ?? formatTotal(remainingSeconds);

  const originalSeconds = data.originalEstimateSeconds ?? loggedSeconds + remainingSeconds;
  const loggedPct =
    originalSeconds > 0 ? Math.min(100, Math.round((loggedSeconds / originalSeconds) * 100)) : loggedSeconds > 0 ? 100 : 0;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-bg px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-text2">Original estimate</span>
        <span className="rounded bg-bg3 px-2 py-0.5 text-xs font-medium text-text">{originalLabel}</span>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm text-text2">Time tracking</p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-bg3">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${loggedPct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-text2">
          <span>
            <span className="font-medium text-text">{loggedLabel}</span> logged
          </span>
          <span>
            <span className="font-medium text-text">{remainingLabel}</span> remaining
          </span>
        </div>
      </div>
      <p className="text-[11px] text-text2">
        Jira {data.jiraIssueKey} · {data.total} work log entr{data.total === 1 ? 'y' : 'ies'}
      </p>
    </div>
  );
}

function WorklogGrid({ worklogs }: { worklogs: JiraWorklogEntry[] }) {
  if (worklogs.length === 0) {
    return <p className="px-1 py-3 text-sm text-text2">No work logged in Jira for this issue yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-bg3/80 text-[11px] uppercase tracking-wide text-text2">
          <tr>
            <th className="border-b border-border px-3 py-2 font-semibold">Date</th>
            <th className="border-b border-border px-3 py-2 font-semibold">Name</th>
            <th className="border-b border-border px-3 py-2 font-semibold">Time logged</th>
          </tr>
        </thead>
        <tbody>
          {worklogs.map((entry) => (
            <tr key={entry.id} className="border-b border-border/70 last:border-b-0 hover:bg-bg3/40">
              <td className="whitespace-nowrap px-3 py-2.5 text-text2">
                {formatDate(entry.started ?? entry.created)}
              </td>
              <td className="px-3 py-2.5 font-medium text-text">{entry.authorDisplayName}</td>
              <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-text">
                {entry.timeSpent || formatTotal(entry.timeSpentSeconds ?? 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface IssueJiraWorklogPanelProps {
  issueId: string;
  jiraId?: string | null;
}

export function IssueJiraWorklogPanel({ issueId, jiraId }: IssueJiraWorklogPanelProps) {
  const hasJiraId = Boolean(jiraId?.trim());
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['issue-jira-worklogs', issueId],
    queryFn: () => fetchIssueJiraWorklogs(issueId),
    enabled: hasJiraId,
  });

  if (!hasJiraId) {
    return (
      <div className="rounded-lg border border-border bg-bg2 p-4 text-sm text-text2">
        No JIRA ID on this item. Sync from Jira or set a JIRA ID to load work logs.
      </div>
    );
  }

  if (isLoading) {
    return <p className="text-sm text-text2">Loading work log from Jira…</p>;
  }

  if (isError) {
    const msg =
      (error as { response?: { data?: { detail?: string; message?: string } } })?.response?.data
        ?.detail ??
      (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Failed to load Jira work logs';
    return (
      <div className="space-y-2">
        <p className="text-sm text-danger">{msg}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-bg3"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-bg3 disabled:opacity-50"
        >
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <TimeTrackingSummary data={data} />
      <WorklogGrid worklogs={data.worklogs ?? []} />
    </div>
  );
}
