import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CrStatusMatrix } from '@/api/crMatrix.api';

const META_HEADERS = ['EM', 'Architect', 'Country', 'Client', 'NTP/GBL', 'PM', 'DM', 'Total CR', 'Active CR'];

const META_FILL = 'E8E4DC';
const TOTAL_FILL = 'F3F0EA';
const BODY_META_FILL = 'F5F1E8';

const STATUS_BG: Record<string, string> = {
  'on hold': 'F8D7DA',
  'quotation approved / dev not started': 'E8F0E8',
  'dev in progress': 'FFE8CC',
  'dev completed': 'D4EDDA',
  'uat testing': 'F5E6C8',
  'sit testing': 'F5E6C8',
  'uat signed off / pending production': 'EEF0F2',
  cancelled: 'FFD8B8',
  'in production': 'C3E6CB',
  completed: '8FD19E',
};

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFB8B4AA' } },
  left: { style: 'thin', color: { argb: 'FFB8B4AA' } },
  bottom: { style: 'thin', color: { argb: 'FFB8B4AA' } },
  right: { style: 'thin', color: { argb: 'FFB8B4AA' } },
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

function statusFill(name: string): string | undefined {
  return STATUS_BG[name.trim().toLowerCase()];
}

function countCell(n: number | undefined): number | string {
  return n && n > 0 ? n : '';
}

function buildHeaderRow(matrix: CrStatusMatrix): string[] {
  return [...META_HEADERS, ...matrix.statuses.map((s) => s.name)];
}

function buildTotalsRow(matrix: CrStatusMatrix): (string | number)[] {
  return [
    'Totals',
    '',
    '',
    '',
    '',
    '',
    '',
    matrix.totals.totalCr,
    matrix.totals.activeCr,
    ...matrix.statuses.map((s) => countCell(matrix.totals.statusCounts[s.id])),
  ];
}

function buildBodyRows(matrix: CrStatusMatrix): (string | number)[][] {
  let lastEm = '\0';
  return matrix.rows.map((row) => {
    const em = row.emName?.trim() || 'Unassigned EM';
    const emLabel = em !== lastEm ? em : '';
    lastEm = em;
    return [
      emLabel,
      row.architectName ?? '',
      row.countryName ?? '',
      row.clientName ?? '',
      row.product ?? '',
      row.pmName ?? '',
      row.dmName ?? '',
      row.totalCr,
      row.activeCr,
      ...matrix.statuses.map((s) => countCell(row.statusCounts[s.id])),
    ];
  });
}

function applyCell(
  cell: ExcelJS.Cell,
  opts: { bold?: boolean; fill?: string; center?: boolean; valign?: 'top' | 'middle' | 'bottom' } = {},
) {
  cell.border = THIN_BORDER as ExcelJS.Borders;
  cell.alignment = {
    vertical: opts.valign ?? 'middle',
    horizontal: opts.center ? 'center' : 'left',
    wrapText: true,
  };
  cell.font = { name: 'Calibri', size: 10, bold: !!opts.bold };
  if (opts.fill) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${opts.fill}` },
    };
  }
}

export async function downloadEmCrMatrixExcel(matrix: CrStatusMatrix) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DFN-PlaniX';
  const sheet = workbook.addWorksheet('EM status matrix', {
    views: [{ state: 'frozen', ySplit: 2 }],
  });

  const headers = buildHeaderRow(matrix);
  const headerRow = sheet.addRow(headers);
  headerRow.height = 36;
  headers.forEach((_, i) => {
    const col = i + 1;
    const isStatus = col > META_HEADERS.length;
    const status = isStatus ? matrix.statuses[col - META_HEADERS.length - 1] : undefined;
    applyCell(headerRow.getCell(col), {
      bold: true,
      center: col > 7,
      valign: 'top',
      fill: status ? statusFill(status.name) ?? META_FILL : META_FILL,
    });
  });

  const totals = buildTotalsRow(matrix);
  const totalsRow = sheet.addRow(totals);
  totals.forEach((_, i) => {
    const col = i + 1;
    const isStatus = col > META_HEADERS.length;
    const status = isStatus ? matrix.statuses[col - META_HEADERS.length - 1] : undefined;
    applyCell(totalsRow.getCell(col), {
      bold: true,
      center: col > 7,
      fill: status ? statusFill(status.name) ?? TOTAL_FILL : TOTAL_FILL,
    });
  });

  for (const values of buildBodyRows(matrix)) {
    const excelRow = sheet.addRow(values);
    values.forEach((_, i) => {
      const col = i + 1;
      const isMeta = col <= 7;
      const isStatus = col > META_HEADERS.length;
      const status = isStatus ? matrix.statuses[col - META_HEADERS.length - 1] : undefined;
      applyCell(excelRow.getCell(col), {
        center: col > 7,
        fill: isMeta ? BODY_META_FILL : status ? statusFill(status.name) : undefined,
        bold: col === 8,
      });
    });
  }

  const widths = [18, 16, 12, 14, 10, 16, 10, 10, 10, ...matrix.statuses.map(() => 12)];
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(buffer as ArrayBuffer, `em-status-matrix-${stamp()}.xlsx`);
}

export function downloadEmCrMatrixPdf(matrix: CrStatusMatrix) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3' });
  doc.setFontSize(14);
  doc.text('EM status matrix', 40, 36);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`DFN-PlaniX · ${stamp()} · ${matrix.rows.length} projects`, 40, 52);
  doc.setTextColor(0);

  const head = [buildHeaderRow(matrix)];
  const body = [buildTotalsRow(matrix), ...buildBodyRows(matrix)];

  autoTable(doc, {
    startY: 64,
    head,
    body,
    styles: {
      fontSize: 6.5,
      cellPadding: 2,
      lineColor: [184, 180, 170],
      lineWidth: 0.3,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [232, 228, 220],
      textColor: [28, 28, 28],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'top',
    },
    columnStyles: {
      0: { cellWidth: 70, halign: 'left' },
      1: { cellWidth: 60, halign: 'left' },
      2: { cellWidth: 48, halign: 'left' },
      3: { cellWidth: 52,halign: 'left' },
      4: { cellWidth: 40,halign: 'left' },
      5: { cellWidth: 58,halign: 'left' },
      6: { cellWidth: 36,halign: 'left' },
      7: { cellWidth: 36,halign: 'center', fontStyle: 'bold' },
      8: { cellWidth: 36,halign: 'center' },
    },
    didParseCell: (hookData) => {
      const { section, column, row, cell } = hookData;
      const colIdx = column.index;
      const statusIdx = colIdx - META_HEADERS.length;
      if (statusIdx >= 0 && matrix.statuses[statusIdx]) {
        const hex = statusFill(matrix.statuses[statusIdx].name);
        if (hex) {
          const r = parseInt(hex.slice(0, 2), 16);
          const g = parseInt(hex.slice(2, 4), 16);
          const b = parseInt(hex.slice(4, 6), 16);
          cell.styles.fillColor = [r, g, b];
        }
      } else if (section === 'body' && row.index === 0) {
        cell.styles.fillColor = [243, 240, 234];
        cell.styles.fontStyle = 'bold';
      } else if (section === 'body' && colIdx < 7) {
        cell.styles.fillColor = [245, 241, 232];
      }
      if (colIdx >= 7) {
        cell.styles.halign = 'center';
      }
    },
    margin: { left: 28, right: 28 },
  });

  doc.save(`em-status-matrix-${stamp()}.pdf`);
}
