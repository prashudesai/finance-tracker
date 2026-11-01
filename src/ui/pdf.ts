export interface PdfColumn {
  label: string;
  width: number;
  numeric?: boolean;
}

const MARGIN = 10;
const ROW_HEIGHT = 6;
const PAGE_BOTTOM = 196;

/** Amounts without a rupee sign, which the standard PDF fonts can't draw. */
export const pdfAmount = (value: number) =>
  value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Builds a landscape table. jsPDF loads only when someone exports. */
export async function downloadTablePdf(options: {
  title: string;
  subtitle: string;
  columns: PdfColumn[];
  rows: string[][];
  file: string;
}) {
  const { jsPDF } = await import('jspdf');
  const { title, subtitle, columns, rows, file } = options;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let y = 0;

  const cell = (text: string, x: number, column: PdfColumn) => {
    const clipped = pdf.splitTextToSize(text, column.width - 2)[0] ?? '';
    if (column.numeric) pdf.text(clipped, x + column.width - 1, y, { align: 'right' });
    else pdf.text(clipped, x + 1, y);
  };

  const header = () => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text(title, MARGIN, 12);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(subtitle, MARGIN, 17);
    const width = columns.reduce((sum, column) => sum + column.width, 0);
    pdf.setFillColor(232, 242, 241);
    pdf.rect(MARGIN, 20, width, 7, 'F');
    pdf.setFont('helvetica', 'bold');
    y = 25;
    let x = MARGIN;
    for (const column of columns) {
      cell(column.label, x, column);
      x += column.width;
    }
    pdf.setFont('helvetica', 'normal');
    y = 32;
  };

  header();
  for (const row of rows) {
    if (y > PAGE_BOTTOM) {
      pdf.addPage();
      header();
    }
    let x = MARGIN;
    columns.forEach((column, index) => {
      cell(row[index] ?? '', x, column);
      x += column.width;
    });
    y += ROW_HEIGHT;
  }

  const pages = pdf.getNumberOfPages();
  pdf.setFontSize(7);
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.text(`${page} / ${pages}`, 287, 205, { align: 'right' });
  }
  pdf.save(file);
}
