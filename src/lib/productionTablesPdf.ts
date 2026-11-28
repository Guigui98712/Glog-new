import jsPDF from 'jspdf';

interface ProductionPdfSection {
  table: HTMLTableElement | null;
  title: string;
}

interface ProductionTablesPdfOptions {
  sections: ProductionPdfSection[];
  fileName: string;
  title: string;
  subtitle: string;
}

interface PdfCell {
  text: string;
  colSpan: number;
}

interface PdfRow {
  cells: PdfCell[];
}

type PdfRowStyle = 'header' | 'body' | 'footer';

const readCellText = (cell: HTMLTableCellElement) => {
  const control = cell.querySelector('input, textarea, select') as
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement
    | null;
  const value = control?.value || cell.innerText || cell.textContent || '';
  return value.replace(/\s+/g, ' ').trim() || '-';
};

const readRows = (sections: HTMLTableSectionElement[]) =>
  sections.flatMap((section) =>
    Array.from(section.rows).map((row): PdfRow => ({
      cells: Array.from(row.cells).map((cell) => ({
        text: readCellText(cell),
        colSpan: Math.max(cell.colSpan, 1),
      })),
    })),
  );

const countColumns = (rows: PdfRow[]) =>
  Math.max(1, ...rows.map((row) => row.cells.reduce((count, cell) => count + cell.colSpan, 0)));

const getColumnWidths = (table: HTMLTableElement, columnCount: number, contentWidth: number) => {
  const columns = Array.from(table.querySelectorAll('colgroup col'));
  const weights = Array.from({ length: columnCount }, (_, index) => {
    const column = columns[index];
    const declaredWidth = column?.style.width || column?.getAttribute('width') || '';
    const parsedWidth = Number.parseFloat(declaredWidth);
    return Number.isFinite(parsedWidth) && parsedWidth > 0 ? parsedWidth : 1;
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  return weights.map((weight) => (contentWidth * weight) / totalWeight);
};

export const generateProductionTablesPdf = async ({
  sections,
  fileName,
  title,
  subtitle,
}: ProductionTablesPdfOptions) => {
  const tables = sections.filter(
    (section): section is ProductionPdfSection & { table: HTMLTableElement } => section.table !== null,
  );
  if (tables.length === 0) {
    throw new Error('As tabelas não estão disponíveis para exportação.');
  }

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  const bottomY = pageHeight - 14;
  const lineHeight = 3.5;
  const cellPadding = 2;
  const generatedAt = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date());
  let cursorY = 0;

  const drawPageHeader = () => {
    pdf.setFillColor(34, 63, 98);
    pdf.rect(0, 0, pageWidth, 29, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(255, 255, 255);
    const titleLines = pdf.splitTextToSize(title, contentWidth * 0.72).slice(0, 2);
    pdf.text(titleLines, margin, 10.5);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(220, 230, 242);
    pdf.text(`Emitido em ${generatedAt}`, pageWidth - margin, 10.5, { align: 'right' });

    pdf.setFontSize(8.5);
    pdf.setTextColor(255, 255, 255);
    const subtitleLines = pdf.splitTextToSize(subtitle, contentWidth * 0.92).slice(0, 2);
    pdf.text(subtitleLines, margin, titleLines.length > 1 ? 22 : 19);
    cursorY = 35;
  };

  const drawFooter = () => {
    pdf.setDrawColor(210, 218, 228);
    pdf.setLineWidth(0.25);
    pdf.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(110, 120, 132);
    pdf.text(pdf.splitTextToSize(title, contentWidth * 0.72)[0], margin, pageHeight - 5);
    pdf.text(
      `Página ${pdf.getCurrentPageInfo().pageNumber} de ${pdf.getNumberOfPages()}`,
      pageWidth - margin,
      pageHeight - 5,
      { align: 'right' },
    );
  };

  const getCellLines = (
    row: PdfRow,
    widths: number[],
    fontSize: number,
    fontStyle: 'normal' | 'bold',
  ) => {
    let columnIndex = 0;
    pdf.setFont('helvetica', fontStyle);
    pdf.setFontSize(fontSize);

    return row.cells.map((cell) => {
      const cellWidth = widths
        .slice(columnIndex, columnIndex + cell.colSpan)
        .reduce((sum, width) => sum + width, 0);
      columnIndex += cell.colSpan;
      return pdf.splitTextToSize(cell.text, Math.max(cellWidth - cellPadding * 2, 8));
    });
  };

  const getRowHeight = (lines: string[][]) =>
    Math.max(7, Math.max(1, ...lines.map((cellLines) => cellLines.length)) * lineHeight + cellPadding * 2);

  const drawRowSegment = (
    row: PdfRow,
    lines: string[][],
    widths: number[],
    style: PdfRowStyle,
    rowIndex: number,
    fromLine: number,
    lineCount: number,
    height: number,
    footerRowCount: number,
  ) => {
    const lastColumn = widths.length;
    const footerIsFinal = style === 'footer' && rowIndex === footerRowCount - 1;
    const fillColor = style === 'header'
      ? [34, 63, 98]
      : footerIsFinal
        ? [40, 78, 118]
        : style === 'footer'
          ? [83, 101, 122]
          : rowIndex % 2 === 0
            ? [255, 255, 255]
            : [244, 247, 251];
    const textColor = style === 'body' ? [40, 48, 58] : [255, 255, 255];
    let columnIndex = 0;
    let x = margin;

    row.cells.forEach((cell, cellIndex) => {
      const cellWidth = widths
        .slice(columnIndex, columnIndex + cell.colSpan)
        .reduce((sum, width) => sum + width, 0);
      const span = Math.min(cell.colSpan, lastColumn - columnIndex);

      pdf.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
      pdf.setDrawColor(style === 'body' ? 215 : 255, style === 'body' ? 222 : 255, style === 'body' ? 231 : 255);
      pdf.setLineWidth(0.2);
      pdf.rect(x, cursorY, cellWidth, height, 'FD');

      pdf.setFont('helvetica', style === 'body' ? 'normal' : 'bold');
      pdf.setFontSize(style === 'header' ? 7.2 : 7.5);
      pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
      const cellLines = lines[cellIndex] || [];
      const segment = cellLines.slice(fromLine, fromLine + lineCount);
      if (segment.length > 0) {
        pdf.text(segment, x + cellPadding, cursorY + cellPadding + lineHeight * 0.75);
      }

      x += cellWidth;
      columnIndex += span;
    });

    cursorY += height;
  };

  const drawSectionTitle = (sectionTitle: string) => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(34, 63, 98);
    pdf.text(sectionTitle, margin, cursorY + 4);
    pdf.setDrawColor(196, 208, 222);
    pdf.setLineWidth(0.35);
    pdf.line(margin, cursorY + 7, pageWidth - margin, cursorY + 7);
    cursorY += 10;
  };

  drawPageHeader();

  for (const section of tables) {
    const headerRows = section.table.tHead ? readRows([section.table.tHead]) : [];
    const bodyRows = readRows(Array.from(section.table.tBodies));
    const footerRows = section.table.tFoot ? readRows([section.table.tFoot]) : [];
    const allRows = [...headerRows, ...bodyRows, ...footerRows];
    const columnCount = countColumns(allRows);
    const widths = getColumnWidths(section.table, columnCount, contentWidth);
    const headerHeight = headerRows.reduce(
      (height, row) => height + getRowHeight(getCellLines(row, widths, 7.2, 'bold')),
      0,
    );

    const drawTableHeaders = () => {
      headerRows.forEach((row, index) => {
        const lines = getCellLines(row, widths, 7.2, 'bold');
        const height = getRowHeight(lines);
        drawRowSegment(row, lines, widths, 'header', index, 0, height, height, 0);
      });
    };

    const startContinuationPage = () => {
      pdf.addPage();
      drawPageHeader();
      drawSectionTitle(section.title);
      drawTableHeaders();
    };

    if (cursorY + 17 + headerHeight > bottomY) {
      pdf.addPage();
      drawPageHeader();
    }
    drawSectionTitle(section.title);
    drawTableHeaders();

    const drawRows = (rows: PdfRow[], style: 'body' | 'footer') => {
      rows.forEach((row, rowIndex) => {
        const lines = getCellLines(row, widths, 7.5, style === 'body' ? 'normal' : 'bold');
        const rowHeight = getRowHeight(lines);

        if (cursorY + rowHeight > bottomY) {
          startContinuationPage();
        }

        const totalLines = Math.max(1, ...lines.map((cellLines) => cellLines.length));
        let lineIndex = 0;
        while (lineIndex < totalLines) {
          const availableHeight = bottomY - cursorY;
          if (availableHeight < 7) {
            startContinuationPage();
            continue;
          }

          const linesThatFit = Math.max(1, Math.floor((availableHeight - cellPadding * 2) / lineHeight));
          const linesToDraw = Math.min(totalLines - lineIndex, linesThatFit);
          const height = Math.max(7, linesToDraw * lineHeight + cellPadding * 2);
          drawRowSegment(
            row,
            lines,
            widths,
            style,
            rowIndex,
            lineIndex,
            linesToDraw,
            height,
            footerRows.length,
          );
          lineIndex += linesToDraw;

          if (lineIndex < totalLines) {
            startContinuationPage();
          }
        }
      });
    };

    drawRows(bodyRows, 'body');
    drawRows(footerRows, 'footer');
    cursorY += 5;
  }

  for (let page = 1; page <= pdf.getNumberOfPages(); page += 1) {
    pdf.setPage(page);
    drawFooter();
  }

  pdf.save(fileName);
};
