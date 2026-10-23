import ExcelJS from 'exceljs';

export type BacklogRegionExcelColumn = {
  name: string;
  color: string;
};

export type BacklogRegionExcelRow = {
  level: 'region' | 'country' | 'project' | 'total';
  region: string;
  country: string;
  project: string;
  buckets: { rdCount: number; effort: number }[];
  totalRd: number;
  totalEffort: number;
};

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
};

const LEVEL_FILL: Record<BacklogRegionExcelRow['level'], string> = {
  region: 'FFE5E7EB',
  country: 'FFF3F4F6',
  project: 'FFFFFFFF',
  total: 'FFD1D5DB',
};

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

function downloadBlob(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function countValue(value: number): number | '' {
  if (!value) return '';
  const rounded = Math.round(value * 10) / 10;
  return rounded;
}

function applyCell(
  cell: ExcelJS.Cell,
  opts: { bold?: boolean; fill?: string; center?: boolean; color?: string } = {},
) {
  cell.border = THIN_BORDER as ExcelJS.Borders;
  cell.alignment = { vertical: 'middle', horizontal: opts.center ? 'center' : 'left' };
  cell.font = {
    name: 'Calibri',
    size: 10,
    bold: !!opts.bold,
    color: opts.color ? { argb: `FF${opts.color}` } : undefined,
  };
  if (opts.fill) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } };
  }
}

export async function downloadBacklogRegionExcel(
  rows: BacklogRegionExcelRow[],
  columns: BacklogRegionExcelColumn[],
  filename: string,
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DFN-PlanX';
  const sheet = workbook.addWorksheet('Backlog by region', {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 2 }],
  });

  const headerTop = sheet.addRow([
    'Region',
    'Country',
    'Project',
    ...columns.flatMap((column) => [column.name, '']),
    'Total',
    '',
  ]);
  const headerSub = sheet.addRow([
    '',
    '',
    '',
    ...columns.flatMap(() => ['RD', 'Et']),
    'RD',
    'Et',
  ]);
  headerTop.height = columns.length > 6 ? 36 : 22;
  headerSub.height = 18;

  sheet.mergeCells(1, 1, 2, 1);
  sheet.mergeCells(1, 2, 2, 2);
  sheet.mergeCells(1, 3, 2, 3);
  columns.forEach((column, index) => {
    const start = 4 + index * 2;
    sheet.mergeCells(1, start, 1, start + 1);
    const color = column.color.replace('#', '');
    applyCell(headerTop.getCell(start), { bold: true, center: true, fill: 'FFF8FAFC', color });
    applyCell(headerTop.getCell(start + 1), { bold: true, center: true, fill: 'FFF8FAFC', color });
    headerTop.getCell(start).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    applyCell(headerSub.getCell(start), { bold: true, center: true, fill: 'FFF8FAFC' });
    applyCell(headerSub.getCell(start + 1), { bold: true, center: true, fill: 'FFF8FAFC' });
  });
  const totalStart = 4 + columns.length * 2;
  sheet.mergeCells(1, totalStart, 1, totalStart + 1);
  for (let col = 1; col <= 3; col++) {
    applyCell(headerTop.getCell(col), { bold: true, fill: 'FFE5E7EB' });
    applyCell(headerSub.getCell(col), { bold: true, fill: 'FFE5E7EB' });
  }
  applyCell(headerTop.getCell(totalStart), { bold: true, center: true, fill: 'FFE5E7EB' });
  applyCell(headerTop.getCell(totalStart + 1), { bold: true, center: true, fill: 'FFE5E7EB' });
  applyCell(headerSub.getCell(totalStart), { bold: true, center: true, fill: 'FFE5E7EB' });
  applyCell(headerSub.getCell(totalStart + 1), { bold: true, center: true, fill: 'FFE5E7EB' });

  for (const row of rows) {
    const values: (string | number)[] = [
      row.region,
      row.country,
      row.project,
      ...row.buckets.flatMap((bucket) => [countValue(bucket.rdCount), countValue(bucket.effort)]),
      countValue(row.totalRd),
      countValue(row.totalEffort),
    ];
    const excelRow = sheet.addRow(values);
    const fill = LEVEL_FILL[row.level];
    const bold = row.level === 'region' || row.level === 'total';
    values.forEach((_, index) => {
      const effortColumn = index >= 3 && (index - 3) % 2 === 1;
      applyCell(excelRow.getCell(index + 1), {
        bold: (bold && index < 3) || effortColumn,
        center: index >= 3,
        fill,
      });
    });
  }

  const pairWidth = columns.length > 6 ? 14 : 12;
  [22, 20, 28, ...columns.flatMap(() => [10, pairWidth]), 10, 12].forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(buffer as ArrayBuffer, `${filename}-${stamp()}.xlsx`);
}
