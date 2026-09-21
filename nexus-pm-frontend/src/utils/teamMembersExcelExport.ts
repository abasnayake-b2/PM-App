import ExcelJS from 'exceljs';
import type { TeamRosterMember } from '@/api/teamRoster.api';

/** Column order must match TeamRosterService.parseTeamSheet (fixed indices 0–9). Extra columns are ignored on older imports. */
export const TEAM_SHEET_NAME = 'Team';

export const TEAM_SHEET_HEADERS = [
  'Name',
  'Code',
  'Designation',
  'Team',
  'EM',
  'NTP/GBL',
  'Country',
  'Product',
  'Email',
  'Tel',
  'Skills',
  'Exp. total',
  'DFN',
  'Employment',
  'Status',
] as const;

const COLUMN_WIDTHS = [28, 10, 28, 22, 24, 12, 16, 16, 32, 16, 28, 12, 10, 14, 12];

const HEADER_FILL = 'D9E1F2';
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
};

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

function cell(value: string | number | null | undefined): string | number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function teamMemberToSheetRow(row: TeamRosterMember): (string | number | null)[] {
  return [
    cell(row.fullName),
    cell(row.designationCode),
    cell(row.designation),
    cell(row.teamName),
    cell(row.engineeringManagerName),
    cell(row.workType),
    cell(row.country),
    cell(row.product),
    cell(row.email),
    cell(row.phone),
    cell(row.skillNames?.join(', ')),
    row.totalYearsOfExperience ?? null,
    row.experienceInDfn ?? null,
    cell(row.employmentType),
    cell(row.status ?? 'ACTIVE'),
  ];
}

export async function downloadTeamMembersExcel(members: TeamRosterMember[]): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DFN-PlanX';
  const sheet = workbook.addWorksheet(TEAM_SHEET_NAME, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  COLUMN_WIDTHS.forEach((width, i) => {
    sheet.getColumn(i + 1).width = width;
  });

  const headerRow = sheet.getRow(1);
  headerRow.height = 22;
  TEAM_SHEET_HEADERS.forEach((header, i) => {
    const excelCell = headerRow.getCell(i + 1);
    excelCell.value = header;
    excelCell.border = THIN_BORDER as ExcelJS.Borders;
    excelCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${HEADER_FILL}` },
    };
    excelCell.font = { name: 'Calibri', size: 11, bold: true };
    excelCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  });

  members.forEach((member, index) => {
    const excelRow = sheet.getRow(2 + index);
    teamMemberToSheetRow(member).forEach((value, i) => {
      const excelCell = excelRow.getCell(i + 1);
      excelCell.value = value;
      excelCell.border = THIN_BORDER as ExcelJS.Borders;
      excelCell.font = { name: 'Calibri', size: 11 };
      excelCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `team-employees-${stamp()}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
