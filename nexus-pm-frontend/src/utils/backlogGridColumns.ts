/** Backlog grid columns — aligned with Excel export categories & light color themes. */

export type BacklogDensity = 'compact' | 'expanded';

export type BacklogCategory =
  | 'Core'
  | 'General'
  | 'Dates'
  | 'Financials'
  | 'Man-days'
  | 'Milestones'
  | 'Risk'
  | 'Other';

export type BacklogColumnKey =
  | 'displayKey'
  | 'title'
  | 'description'
  | 'status'
  | 'priority'
  | 'type'
  | 'project'
  | 'capitalizable'
  | 'assignee'
  | 'utilization'
  | `cf:${string}`;

export interface BacklogColumn {
  key: BacklogColumnKey;
  category: BacklogCategory;
  header: string;
  /** Tailwind min-width class (used when no pixel width is set). */
  minWidth: string;
  /** Default pixel width — enables resize and a fixed starting size. */
  defaultWidthPx?: number;
  /** Columns the user can drag-resize (defaults true when defaultWidthPx is set). */
  resizable?: boolean;
  sticky?: boolean;
}

/** Soft pastel theme matching Excel export category colors */
export const CATEGORY_THEME: Record<
  BacklogCategory,
  { banner: string; header: string; cell: string; text: string }
> = {
  Core: {
    banner: 'bg-slate-200 text-slate-800',
    header: 'bg-slate-100 text-slate-700',
    cell: 'bg-slate-50/80',
    text: 'text-slate-800',
  },
  General: {
    banner: 'bg-indigo-200 text-indigo-900',
    header: 'bg-indigo-100 text-indigo-800',
    cell: 'bg-indigo-50/70',
    text: 'text-indigo-950',
  },
  Dates: {
    banner: 'bg-teal-200 text-teal-900',
    header: 'bg-teal-100 text-teal-800',
    cell: 'bg-teal-50/70',
    text: 'text-teal-950',
  },
  Financials: {
    banner: 'bg-amber-200 text-amber-950',
    header: 'bg-amber-100 text-amber-900',
    cell: 'bg-amber-50/70',
    text: 'text-amber-950',
  },
  'Man-days': {
    banner: 'bg-green-200 text-green-900',
    header: 'bg-green-100 text-green-800',
    cell: 'bg-green-50/70',
    text: 'text-green-950',
  },
  Milestones: {
    banner: 'bg-violet-200 text-violet-900',
    header: 'bg-violet-100 text-violet-800',
    cell: 'bg-violet-50/70',
    text: 'text-violet-950',
  },
  Risk: {
    banner: 'bg-rose-200 text-rose-900',
    header: 'bg-rose-100 text-rose-800',
    cell: 'bg-rose-50/70',
    text: 'text-rose-950',
  },
  Other: {
    banner: 'bg-stone-200 text-stone-800',
    header: 'bg-stone-100 text-stone-700',
    cell: 'bg-stone-50/70',
    text: 'text-stone-900',
  },
};

/** Compact view — essentials only, in this order. */
const COMPACT_COLUMN_KEYS: BacklogColumnKey[] = [
  'displayKey',
  'title',
  'status',
  'project',
  'type',
  'priority',
  'assignee',
];

export function buildBacklogColumns(options: {
  hideProject?: boolean;
  density?: BacklogDensity;
}): { columns: BacklogColumn[]; categorySpans: { category: BacklogCategory; span: number }[] } {
  const allColumns: BacklogColumn[] = [
    { key: 'displayKey', category: 'Core', header: 'CR No / ID', minWidth: 'min-w-[9.5rem]', defaultWidthPx: 152, sticky: true, resizable: true },
    {
      key: 'title',
      category: 'Core',
      header: 'Change Request Name',
      minWidth: 'min-w-[22rem]',
      defaultWidthPx: 360,
      sticky: true,
      resizable: true,
    },
    {
      key: 'description',
      category: 'Core',
      header: 'Description',
      minWidth: 'min-w-[20rem]',
      defaultWidthPx: 320,
      resizable: true,
    },
    { key: 'status', category: 'Core', header: 'Current Stage', minWidth: 'min-w-[9rem]', resizable: true },
    { key: 'priority', category: 'Core', header: 'Priority', minWidth: 'min-w-[5.5rem]', resizable: true },
    { key: 'type', category: 'Core', header: 'Type', minWidth: 'min-w-[6.5rem]', resizable: true },
    { key: 'project', category: 'Core', header: 'Project', minWidth: 'min-w-[7rem]', resizable: true },
    { key: 'capitalizable', category: 'Core', header: 'Capitalizable', minWidth: 'min-w-[6rem]', resizable: true },
    { key: 'assignee', category: 'Core', header: 'Assignee', minWidth: 'min-w-[9rem]', resizable: true },
    { key: 'utilization', category: 'Core', header: 'Utilization', minWidth: 'min-w-[5.5rem]', resizable: true },

    { key: 'cf:sow', category: 'General', header: 'SOW', minWidth: 'min-w-[7rem]', resizable: true },
    { key: 'cf:covered_in_existing_resources', category: 'General', header: 'Covered in Existing Resources', minWidth: 'min-w-[9rem]', resizable: true },
    { key: 'cf:cr_type', category: 'General', header: 'CR Type', minWidth: 'min-w-[5.5rem]', resizable: true },
    { key: 'cf:major_cr', category: 'General', header: 'Major CR', minWidth: 'min-w-[5.5rem]', resizable: true },
    { key: 'cf:delivery_quarter', category: 'General', header: 'Delivery Quarter', minWidth: 'min-w-[6rem]', resizable: true },
    { key: 'cf:delivery_year', category: 'General', header: 'Delivery Year', minWidth: 'min-w-[5.5rem]', resizable: true },
    { key: 'cf:percentage_completion', category: 'General', header: 'Percentage Completion', minWidth: 'min-w-[6.5rem]', resizable: true },

    { key: 'cf:requirement_initiated_date', category: 'Dates', header: 'Requirement Initiated Date', minWidth: 'min-w-[8rem]', resizable: true },
    { key: 'cf:brd_requested_date', category: 'Dates', header: 'BRD Requested Date', minWidth: 'min-w-[8rem]', resizable: true },
    { key: 'cf:brd_received_date', category: 'Dates', header: 'BRD Received Date', minWidth: 'min-w-[8rem]', resizable: true },
    { key: 'cf:ba_ballpark_effort', category: 'Dates', header: 'BA Ballpark Effort', minWidth: 'min-w-[7rem]', resizable: true },
    { key: 'cf:bp_effort_eta', category: 'Dates', header: 'BP Effort ETA', minWidth: 'min-w-[7.5rem]', resizable: true },
    { key: 'cf:bp_effort', category: 'Dates', header: 'BP Effort', minWidth: 'min-w-[6rem]', resizable: true },
    { key: 'cf:bp_effort_accepted_date', category: 'Dates', header: 'BP Effort Accepted Date', minWidth: 'min-w-[8.5rem]', resizable: true },
    { key: 'cf:total_effort_eta', category: 'Dates', header: 'Total Effort ETA', minWidth: 'min-w-[7.5rem]', resizable: true },
    { key: 'cf:rd_start_date', category: 'Dates', header: 'RD Start Date', minWidth: 'min-w-[7.5rem]', resizable: true },
    { key: 'cf:rd_delivery_eta', category: 'Dates', header: 'RD Delivery ETA', minWidth: 'min-w-[7.5rem]', resizable: true },
    { key: 'cf:rd_sign_off_date', category: 'Dates', header: 'RD Sign Off Date', minWidth: 'min-w-[7.5rem]', resizable: true },

    { key: 'cf:costing_done', category: 'Financials', header: 'Costing Done?', minWidth: 'min-w-[6.5rem]', resizable: true },
    { key: 'cf:quote_done', category: 'Financials', header: 'Quote Done?', minWidth: 'min-w-[6rem]', resizable: true },
    { key: 'cf:quotation', category: 'Financials', header: 'Quotation', minWidth: 'min-w-[6rem]', resizable: true },
    { key: 'cf:quotation_shared_date', category: 'Financials', header: 'Quotation Shared Date', minWidth: 'min-w-[8rem]', resizable: true },
    { key: 'cf:quotation_approved_date', category: 'Financials', header: 'Quotation Approved Date', minWidth: 'min-w-[8.5rem]', resizable: true },
    { key: 'cf:deal_desk_approval_status', category: 'Financials', header: 'Deal Desk Approval Status', minWidth: 'min-w-[9rem]', resizable: true },
    { key: 'cf:payment_status', category: 'Financials', header: 'Payment Status', minWidth: 'min-w-[7rem]', resizable: true },

    { key: 'cf:md_planned', category: 'Man-days', header: 'Man-days Planned', minWidth: 'min-w-[7rem]', resizable: true },
    { key: 'cf:md_additional', category: 'Man-days', header: 'Man-days Additional', minWidth: 'min-w-[7.5rem]', resizable: true },
    { key: 'cf:md_total', category: 'Man-days', header: 'Man-days Total', minWidth: 'min-w-[6.5rem]', resizable: true },
    { key: 'cf:md_actually_utilized', category: 'Man-days', header: 'Man-days Actually Utilized', minWidth: 'min-w-[8.5rem]', resizable: true },
    { key: 'cf:md_remaining', category: 'Man-days', header: 'Man-days Remaining', minWidth: 'min-w-[7.5rem]', resizable: true },

    { key: 'cf:dev_start_date', category: 'Milestones', header: 'Dev Start Date', minWidth: 'min-w-[7.5rem]', resizable: true },
    { key: 'cf:dev_end_date', category: 'Milestones', header: 'Dev End Date', minWidth: 'min-w-[7rem]', resizable: true },
    { key: 'cf:sit_start_date', category: 'Milestones', header: 'SIT Start Date', minWidth: 'min-w-[7.5rem]', resizable: true },
    { key: 'cf:sit_end_date', category: 'Milestones', header: 'SIT End Date', minWidth: 'min-w-[7rem]', resizable: true },
    { key: 'cf:uat_start_date', category: 'Milestones', header: 'UAT Start Date', minWidth: 'min-w-[7.5rem]', resizable: true },
    { key: 'cf:uat_end_date', category: 'Milestones', header: 'UAT End Date', minWidth: 'min-w-[7rem]', resizable: true },
    { key: 'cf:prod_date', category: 'Milestones', header: 'Prod Date', minWidth: 'min-w-[6.5rem]', resizable: true },

    {
      key: 'cf:risk_description',
      category: 'Risk',
      header: 'Risk Description',
      minWidth: 'min-w-[12rem]',
      defaultWidthPx: 240,
      resizable: true,
    },
    { key: 'cf:risk_created_date', category: 'Risk', header: 'Risk Created Date', minWidth: 'min-w-[7.5rem]', resizable: true },
    { key: 'cf:risk_owner', category: 'Risk', header: 'Risk Owner', minWidth: 'min-w-[7rem]', resizable: true },
    { key: 'cf:risk_status', category: 'Risk', header: 'Risk Status', minWidth: 'min-w-[6.5rem]', resizable: true },
    { key: 'cf:risk_impact', category: 'Risk', header: 'Risk Impact', minWidth: 'min-w-[6rem]', resizable: true },
    { key: 'cf:risk_closed_date', category: 'Risk', header: 'Risk Closed Date', minWidth: 'min-w-[7.5rem]', resizable: true },
    {
      key: 'cf:risk_mitigation',
      category: 'Risk',
      header: 'Risk Mitigation',
      minWidth: 'min-w-[12rem]',
      defaultWidthPx: 240,
      resizable: true,
    },

    {
      key: 'cf:notes',
      category: 'Other',
      header: 'Notes',
      minWidth: 'min-w-[12rem]',
      defaultWidthPx: 240,
      resizable: true,
    },
  ];

  const byKey = new Map(allColumns.map((col) => [col.key, col]));
  let columns: BacklogColumn[];

  if (options.density === 'compact') {
    columns = COMPACT_COLUMN_KEYS.map((key) => byKey.get(key)).filter((col): col is BacklogColumn => {
      if (!col) return false;
      if (col.key === 'project' && options.hideProject) return false;
      return true;
    });
  } else {
    columns = allColumns.filter((col) => !(col.key === 'project' && options.hideProject));
  }

  const categorySpans: { category: BacklogCategory; span: number }[] = [];
  // Category color banners only in expanded (all-fields) view
  if (options.density !== 'compact') {
    for (const col of columns) {
      const last = categorySpans[categorySpans.length - 1];
      if (last && last.category === col.category) {
        last.span += 1;
      } else {
        categorySpans.push({ category: col.category, span: 1 });
      }
    }
  }

  return { columns, categorySpans };
}

export function customFieldKey(columnKey: BacklogColumnKey): string | null {
  return columnKey.startsWith('cf:') ? columnKey.slice(3) : null;
}
