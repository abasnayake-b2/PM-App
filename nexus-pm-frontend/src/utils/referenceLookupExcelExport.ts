import ExcelJS from 'exceljs';
import type { ReferenceItem } from '@/api/referenceData.api';

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

function byName(a: ReferenceItem, b: ReferenceItem) {
  return (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' });
}

async function downloadSheet(options: {
  sheetName: string;
  fileName: string;
  headers: string[];
  widths: number[];
  rows: (string | null)[][];
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DFN-PlanX';
  const sheet = workbook.addWorksheet(options.sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  options.widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });

  const headerRow = sheet.getRow(1);
  headerRow.height = 22;
  options.headers.forEach((header, index) => {
    const excelCell = headerRow.getCell(index + 1);
    excelCell.value = header;
    excelCell.border = THIN_BORDER as ExcelJS.Borders;
    excelCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${HEADER_FILL}` },
    };
    excelCell.font = { name: 'Calibri', size: 11, bold: true };
    excelCell.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  options.rows.forEach((row, rowIndex) => {
    const excelRow = sheet.getRow(2 + rowIndex);
    row.forEach((value, index) => {
      const excelCell = excelRow.getCell(index + 1);
      excelCell.value = value;
      excelCell.border = THIN_BORDER as ExcelJS.Borders;
      excelCell.font = { name: 'Calibri', size: 11 };
      excelCell.alignment = { vertical: 'middle', horizontal: 'left' };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = options.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadSkillsExcel(items: ReferenceItem[]): Promise<void> {
  const rows = [...items].sort(byName).map((item) => [item.name?.trim() || null, item.description?.trim() || null]);
  await downloadSheet({
    sheetName: 'Skills',
    fileName: `skills-${stamp()}.xlsx`,
    headers: ['Name', 'Description'],
    widths: [28, 48],
    rows,
  });
}

export async function downloadWorkTypesExcel(items: ReferenceItem[]): Promise<void> {
  const rows = [...items].sort(byName).map((item) => [item.name?.trim() || null]);
  await downloadSheet({
    sheetName: 'NTP-GBL',
    fileName: `ntp-gbl-${stamp()}.xlsx`,
    headers: ['Name'],
    widths: [28],
    rows,
  });
}
