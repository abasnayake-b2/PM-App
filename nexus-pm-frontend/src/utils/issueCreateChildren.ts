import { createIssueNote, type IssueNotePayload } from '@/api/issueNotes.api';
import { createIssueRisk, type IssueRiskPayload } from '@/api/issueRisks.api';
import {
  createIssueQuarterlyCompletion,
  type IssueQuarterlyCompletionPayload,
} from '@/api/issueQuarterlyCompletions.api';

export interface IssueCreateChildRows {
  notes: IssueNotePayload[];
  risks: IssueRiskPayload[];
  quarterlyCompletions: IssueQuarterlyCompletionPayload[];
}

export const EMPTY_CREATE_CHILD_ROWS: IssueCreateChildRows = {
  notes: [],
  risks: [],
  quarterlyCompletions: [],
};

export async function persistIssueChildRows(issueId: string, extras: IssueCreateChildRows) {
  for (const note of extras.notes) {
    await createIssueNote(issueId, note);
  }
  for (const row of extras.quarterlyCompletions) {
    await createIssueQuarterlyCompletion(issueId, row);
  }
  for (const risk of extras.risks) {
    await createIssueRisk(issueId, risk);
  }
}
