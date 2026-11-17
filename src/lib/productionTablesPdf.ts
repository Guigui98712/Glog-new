import html2canvas from 'html2canvas';
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
  const margin = 10;
  const contentTop = 29;
  const imageWidth = pageWidth - margin * 2;
  const imageHeightPerPage = pageHeight - contentTop - margin;
  let hasPage = false;

  for (const section of tables) {
    const canvas = await html2canvas(section.table, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
    });
    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error('Não foi possível capturar uma das tabelas para o PDF.');
    }

    const sliceHeightLimit = imageHeightPerPage * canvas.width / imageWidth;
    let offsetY = 0;

    while (offsetY < canvas.height) {
      if (hasPage) {
        pdf.addPage();
      }

      pdf.setTextColor(34, 63, 98);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text(title, margin, 10);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text(subtitle, margin, 16);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text(section.title, margin, 24);

      const sliceHeight = Math.min(Math.ceil(sliceHeightLimit), canvas.height - offsetY);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      const context = pageCanvas.getContext('2d');
      if (!context) {
        throw new Error('Não foi possível preparar as tabelas para o PDF.');
      }
      context.drawImage(canvas, 0, offsetY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

      const renderedHeight = sliceHeight * imageWidth / canvas.width;
      pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', margin, contentTop, imageWidth, renderedHeight);
      offsetY += sliceHeight;
      hasPage = true;
    }
  }

  pdf.save(fileName);
};
