import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export type OrgStatsExportRow = {
  label: string;
  subLabel?: string;
  vpName?: string;
  counts: Record<string, number>;
  total: number;
};

export type OrgStatsExportTable = {
  title: string;
  /** Header for column A (Category / VP / VP). */
  primaryLabel: string;
  /** Header for column B — empty for Org/VP grids, "EM" for EM grid. */
  secondaryLabel: string;
  codes: string[];
  rows: OrgStatsExportRow[];
  /** EM grid: col A = VP, col B = EM. Org/VP: col A = name, col B blank. */
  includeVpColumn?: boolean;
};

/** Spreadsheet-style skill blocks: VP | EM | skill→codes… | Total headcount */
export type SkillEmMatrixExport = {
  title: string;
  skills: string[];
  codes: string[];
  rows: {
    vpName: string;
    emName: string;
    subLabel?: string;
    bySkill: Record<string, Record<string, number>>;
    headcount: number;
  }[];
};

const HEADER_FILL = 'D9E1F2';
const TOTAL_FILL = 'F2F2F2';
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
};

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

function cellCount(value: number | undefined) {
  return value && value > 0 ? value : '';
}

/**
 * Page-aligned columns (matches Stats UI):
 *   Org/VP: [Name] [ ] [Details] [codes…] [Total]
 *   EM:     [VP]   [EM] [Details] [codes…] [Total]
 */
function headerRow(table: OrgStatsExportTable): string[] {
  return [table.primaryLabel, table.secondaryLabel, 'Details', ...table.codes, 'Total'];
}

function bodyRows(table: OrgStatsExportTable): (string | number)[][] {
  const { codes, rows, includeVpColumn } = table;
  return rows.map((row) => {
    const counts = codes.map((code) => cellCount(row.counts[code]));
    if (includeVpColumn) {
      return [row.vpName ?? '', row.label, row.subLabel ?? '', ...counts, row.total];
    }
    return [row.label, '', row.subLabel ?? '', ...counts, row.total];
  });
}

function totalRow(table: OrgStatsExportTable): (string | number)[] {
  const { codes, rows } = table;
  const columnTotals = codes.map((code) =>
    rows.reduce((sum, row) => sum + (row.counts[code] ?? 0), 0),
  );
  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);
  return [
    'Total',
    '',
    '',
    ...columnTotals.map((value) => (value > 0 ? value : 0)),
    grandTotal,
  ];
}

function applyDataCellStyle(
  cell: ExcelJS.Cell,
  colIndex: number,
  opts: { bold?: boolean; fill?: string } = {},
) {
  const isTextCol = colIndex <= 3;
  cell.border = THIN_BORDER as ExcelJS.Borders;
  cell.alignment = {
    vertical: 'middle',
    horizontal: isTextCol ? 'left' : 'center',
    wrapText: colIndex === 3,
  };
  cell.font = {
    name: 'Calibri',
    size: 11,
    bold: !!opts.bold,
  };
  if (opts.fill) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${opts.fill}` },
    };
  }
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

export async function downloadOrgStatsExcel(
  tables: OrgStatsExportTable[],
  skillMatrix?: SkillEmMatrixExport,
) {
  if (tables.length === 0 && !skillMatrix?.skills.length) return;

  const codes = tables[0]?.codes ?? skillMatrix?.codes ?? [];
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DFN-PlanX';
  const sheet = workbook.addWorksheet('Org structure stats', {
    views: [{ showGridLines: false }],
  });

  sheet.getColumn(1).width = 26;
  sheet.getColumn(2).width = 26;
  sheet.getColumn(3).width = 58;
  codes.forEach((_, i) => {
    sheet.getColumn(4 + i).width = 8;
  });
  sheet.getColumn(4 + codes.length).width = 9;

  let rowNum = 1;
  const titleRow = sheet.getRow(rowNum);
  titleRow.getCell(1).value = 'Org structure stats';
  titleRow.getCell(1).font = { name: 'Calibri', size: 14, bold: true };
  titleRow.getCell(2).value = `Generated ${stamp()}`;
  titleRow.getCell(2).font = { name: 'Calibri', size: 11, color: { argb: 'FF666666' } };
  rowNum += 2;

  for (const table of tables) {
    const sectionRow = sheet.getRow(rowNum);
    sectionRow.getCell(1).value = table.title;
    sectionRow.getCell(1).font = { name: 'Calibri', size: 12, bold: true };
    rowNum += 1;

    const headers = headerRow(table);
    const headerExcelRow = sheet.getRow(rowNum);
    headers.forEach((value, i) => {
      const cell = headerExcelRow.getCell(i + 1);
      cell.value = value;
      applyDataCellStyle(cell, i + 1, { bold: true, fill: HEADER_FILL });
    });
    rowNum += 1;

    for (const values of bodyRows(table)) {
      const dataRow = sheet.getRow(rowNum);
      values.forEach((value, i) => {
        const cell = dataRow.getCell(i + 1);
        cell.value = value === '' ? null : value;
        applyDataCellStyle(cell, i + 1);
      });
      rowNum += 1;
    }

    const totals = totalRow(table);
    const totalExcelRow = sheet.getRow(rowNum);
    totals.forEach((value, i) => {
      const cell = totalExcelRow.getCell(i + 1);
      cell.value = value === '' ? null : value;
      applyDataCellStyle(cell, i + 1, { bold: true, fill: TOTAL_FILL });
    });
    rowNum += 2;
  }

  if (skillMatrix && skillMatrix.skills.length > 0) {
    rowNum = appendSkillMatrixExcel(sheet, skillMatrix, rowNum);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(buffer as ArrayBuffer, `org-structure-stats-${stamp()}.xlsx`);
}

function appendSkillMatrixExcel(
  sheet: ExcelJS.Worksheet,
  matrix: SkillEmMatrixExport,
  startRow: number,
): number {
  const { skills, codes, rows, title } = matrix;
  let rowNum = startRow;

  const sectionRow = sheet.getRow(rowNum);
  sectionRow.getCell(1).value = title;
  sectionRow.getCell(1).font = { name: 'Calibri', size: 12, bold: true };
  rowNum += 1;

  // Widen skill-code columns
  const totalCodeCols = skills.length * codes.length;
  for (let i = 0; i < totalCodeCols; i++) {
    sheet.getColumn(3 + i).width = 7;
  }
  sheet.getColumn(3 + totalCodeCols).width = 9;

  const skillHeaderRow = sheet.getRow(rowNum);
  const codeHeaderRow = sheet.getRow(rowNum + 1);

  const styleHeader = (cell: ExcelJS.Cell, fill = HEADER_FILL) => {
    cell.border = THIN_BORDER as ExcelJS.Borders;
    cell.alignment = { vertical: 'top', horizontal: 'center', wrapText: true };
    cell.font = { name: 'Calibri', size: 10, bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${fill}` },
    };
  };

  skillHeaderRow.getCell(1).value = 'VP';
  skillHeaderRow.getCell(2).value = 'EM';
  styleHeader(skillHeaderRow.getCell(1));
  styleHeader(skillHeaderRow.getCell(2));
  sheet.mergeCells(rowNum, 1, rowNum + 1, 1);
  sheet.mergeCells(rowNum, 2, rowNum + 1, 2);

  let col = 3;
  for (const skill of skills) {
    skillHeaderRow.getCell(col).value = skill;
    styleHeader(skillHeaderRow.getCell(col));
    if (codes.length > 1) {
      sheet.mergeCells(rowNum, col, rowNum, col + codes.length - 1);
    }
    for (let i = 0; i < codes.length; i++) {
      const cell = codeHeaderRow.getCell(col + i);
      cell.value = codes[i];
      styleHeader(cell, 'E8EEF8');
    }
    col += codes.length;
  }
  skillHeaderRow.getCell(col).value = 'Total';
  styleHeader(skillHeaderRow.getCell(col));
  sheet.mergeCells(rowNum, col, rowNum + 1, col);
  skillHeaderRow.height = 22;
  codeHeaderRow.height = 28;
  rowNum += 2;

  for (const row of rows) {
    const dataRow = sheet.getRow(rowNum);
    dataRow.getCell(1).value = row.vpName;
    dataRow.getCell(2).value = row.emName;
    applyDataCellStyle(dataRow.getCell(1), 1);
    applyDataCellStyle(dataRow.getCell(2), 2);
    let c = 3;
    for (const skill of skills) {
      for (const code of codes) {
        const n = row.bySkill[skill]?.[code] ?? 0;
        const cell = dataRow.getCell(c);
        cell.value = n > 0 ? n : null;
        applyDataCellStyle(cell, 4);
        c += 1;
      }
    }
    dataRow.getCell(c).value = row.headcount > 0 ? row.headcount : null;
    applyDataCellStyle(dataRow.getCell(c), 4, { bold: true });
    rowNum += 1;
  }

  const totalsRow = sheet.getRow(rowNum);
  totalsRow.getCell(1).value = 'Total';
  totalsRow.getCell(2).value = '';
  applyDataCellStyle(totalsRow.getCell(1), 1, { bold: true, fill: TOTAL_FILL });
  applyDataCellStyle(totalsRow.getCell(2), 2, { bold: true, fill: TOTAL_FILL });
  let tc = 3;
  for (const skill of skills) {
    for (const code of codes) {
      const sum = rows.reduce((s, r) => s + (r.bySkill[skill]?.[code] ?? 0), 0);
      const cell = totalsRow.getCell(tc);
      cell.value = sum > 0 ? sum : null;
      applyDataCellStyle(cell, 4, { bold: true, fill: TOTAL_FILL });
      tc += 1;
    }
  }
  const headcountSum = rows.reduce((s, r) => s + r.headcount, 0);
  totalsRow.getCell(tc).value = headcountSum > 0 ? headcountSum : null;
  applyDataCellStyle(totalsRow.getCell(tc), 4, { bold: true, fill: TOTAL_FILL });
  rowNum += 2;

  return rowNum;
}

export function downloadOrgStatsPdf(
  tables: OrgStatsExportTable[],
  skillMatrix?: SkillEmMatrixExport,
) {
  if (tables.length === 0 && !skillMatrix?.skills.length) return;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a3',
  });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Org structure stats', 28, 36);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generated ${stamp()}`, 28, 50);
  doc.setTextColor(0);

  let startY = 64;

  for (const table of tables) {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (startY > pageHeight - 80) {
      doc.addPage();
      startY = 40;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(table.title, 28, startY);
    doc.setFont('helvetica', 'normal');
    startY += 14;

    const head = [headerRow(table)];
    const dataBody = bodyRows(table).map((row) =>
      row.map((cell) => (cell === '' ? '' : String(cell))),
    );
    const totals = totalRow(table).map((cell) => String(cell));

    autoTable(doc, {
      startY,
      head,
      body: dataBody,
      foot: [totals],
      showFoot: 'lastPage',
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
        halign: 'center',
      },
      bodyStyles: {
        textColor: [0, 0, 0],
      },
      footStyles: {
        fillColor: [242, 242, 242],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 110, halign: 'left' },
        1: { cellWidth: 110, halign: 'left' },
        2: { cellWidth: 160, halign: 'left' },
      },
      margin: { left: 28, right: 28 },
      pageBreak: 'auto',
      rowPageBreak: 'avoid',
      didParseCell: (data) => {
        if (data.section === 'head' && data.column.index < 3) {
          data.cell.styles.halign = 'left';
        }
        if (data.section === 'body' && data.column.index < 3) {
          data.cell.styles.halign = 'left';
        }
        if (data.section === 'foot' && data.column.index < 3) {
          data.cell.styles.halign = 'left';
        }
        if (data.section !== 'head' && data.column.index >= 3) {
          data.cell.styles.halign = 'center';
        }
      },
    });

    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
    startY = (finalY ?? startY) + 28;
  }

  if (skillMatrix && skillMatrix.skills.length > 0) {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (startY > pageHeight - 80) {
      doc.addPage();
      startY = 40;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(skillMatrix.title, 28, startY);
    doc.setFont('helvetica', 'normal');
    startY += 14;

    // Flattened headers: "Skill / CODE" — autoTable doesn't merge well across pages
    const flatHead = [
      'VP',
      'EM',
      ...skillMatrix.skills.flatMap((skill) =>
        skillMatrix.codes.map((code) => `${skill} / ${code}`),
      ),
      'Total',
    ];
    const body = skillMatrix.rows.map((row) => [
      row.vpName,
      row.emName,
      ...skillMatrix.skills.flatMap((skill) =>
        skillMatrix.codes.map((code) => {
          const n = row.bySkill[skill]?.[code] ?? 0;
          return n > 0 ? String(n) : '';
        }),
      ),
      row.headcount > 0 ? String(row.headcount) : '',
    ]);
    const foot = [
      'Total',
      '',
      ...skillMatrix.skills.flatMap((skill) =>
        skillMatrix.codes.map((code) => {
          const sum = skillMatrix.rows.reduce(
            (s, r) => s + (r.bySkill[skill]?.[code] ?? 0),
            0,
          );
          return sum > 0 ? String(sum) : '';
        }),
      ),
      String(skillMatrix.rows.reduce((s, r) => s + r.headcount, 0) || ''),
    ];

    autoTable(doc, {
      startY,
      head: [flatHead],
      body,
      foot: [foot],
      showFoot: 'lastPage',
      styles: {
        fontSize: 5.5,
        cellPadding: 1.5,
        overflow: 'linebreak',
        valign: 'top',
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        halign: 'center',
      },
      headStyles: {
        fillColor: [217, 225, 242],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        valign: 'top',
      },
      footStyles: {
        fillColor: [30, 58, 95],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 70, halign: 'left' },
        1: { cellWidth: 80, halign: 'left' },
      },
      margin: { left: 20, right: 20 },
      pageBreak: 'auto',
    });
  }

  doc.save(`org-structure-stats-${stamp()}.pdf`);
}
