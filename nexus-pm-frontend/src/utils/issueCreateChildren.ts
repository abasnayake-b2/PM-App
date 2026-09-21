import { createIssueNote, type IssueNotePayload } from '@/api/issueNotes.api';
import { createIssueTask, type TaskPayload } from '@/api/scopedTasks.api';
import { createIssueRisk, type IssueRiskPayload } from '@/api/issueRisks.api';
import {
  createIssueQuarterlyCompletion,
  type IssueQuarterlyCompletionPayload,
} from '@/api/issueQuarterlyCompletions.api';

export interface IssueCreateChildRows {
  notes: IssueNotePayload[];
  tasks: TaskPayload[];
  risks: IssueRiskPayload[];
  quarterlyCompletions: IssueQuarterlyCompletionPayload[];
}

export const EMPTY_CREATE_CHILD_ROWS: IssueCreateChildRows = {
  notes: [],
  tasks: [],
  risks: [],
  quarterlyCompletions: [],
};

export async function persistIssueChildRows(issueId: string, extras: IssueCreateChildRows) {
  for (const note of extras.notes) {
    await createIssueNote(issueId, note);
  }
  for (const task of extras.tasks ?? []) {
    await createIssueTask(issueId, task);
  }
  for (const row of extras.quarterlyCompletions) {
    await createIssueQuarterlyCompletion(issueId, row);
  }
  for (const risk of extras.risks) {
    await createIssueRisk(issueId, risk);
  }
}
