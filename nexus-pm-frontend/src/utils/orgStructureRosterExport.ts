import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

function downloadBlob(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function styleHeaderCell(cell: ExcelJS.Cell) {
  cell.border = THIN_BORDER as ExcelJS.Borders;
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: `FF${HEADER_FILL}` },
  };
  cell.font = { name: 'Calibri', size: 11, bold: true };
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
}

function styleBodyCell(cell: ExcelJS.Cell) {
  cell.border = THIN_BORDER as ExcelJS.Borders;
  cell.font = { name: 'Calibri', size: 11 };
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
}

export async function downloadRosterExcel(opts: {
  title: string;
  sheetName: string;
  filenamePrefix: string;
  headers: string[];
  rows: (string | number)[][];
  columnWidths?: number[];
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DFN-PlaniX';
  const sheet = workbook.addWorksheet(opts.sheetName.slice(0, 31), {
    views: [{ showGridLines: false }],
  });

  const widths = opts.columnWidths ?? opts.headers.map((_, i) => (i === 0 ? 6 : 18));
  widths.forEach((width, i) => {
    sheet.getColumn(i + 1).width = width;
  });

  const titleRow = sheet.getRow(1);
  titleRow.getCell(1).value = opts.title;
  titleRow.getCell(1).font = { name: 'Calibri', size: 14, bold: true };
  titleRow.getCell(2).value = `Generated ${stamp()}`;
  titleRow.getCell(2).font = { name: 'Calibri', size: 11, color: { argb: 'FF666666' } };

  const headerRow = sheet.getRow(3);
  opts.headers.forEach((header, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = header;
    styleHeaderCell(cell);
  });

  opts.rows.forEach((values, rowIndex) => {
    const row = sheet.getRow(4 + rowIndex);
    values.forEach((value, i) => {
      const cell = row.getCell(i + 1);
      cell.value = value === '' ? null : value;
      styleBodyCell(cell);
      if (i === 0) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(buffer as ArrayBuffer, `${opts.filenamePrefix}-${stamp()}.xlsx`);
}

export function downloadRosterPdf(opts: {
  title: string;
  filenamePrefix: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a3',
  });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(opts.title, 28, 36);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generated ${stamp()}`, 28, 50);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 64,
    head: [opts.headers],
    body: opts.rows.map((row) => row.map((cell) => (cell === '' ? '—' : String(cell)))),
    styles: {
      fontSize: 7,
      cellPadding: 3,
      overflow: 'linebreak',
      valign: 'middle',
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [217, 225, 242],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 28, right: 28 },
  });

  doc.save(`${opts.filenamePrefix}-${stamp()}.pdf`);
}
