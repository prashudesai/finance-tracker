import { columnsOf } from '../../domain/statement';

/** A statement PDF locked with a password, as many banks send them. */
export class PdfPasswordError extends Error {
  constructor(readonly wrong: boolean) {
    super(wrong ? 'That password didn’t open the statement.' : 'This statement has a password.');
  }
}

interface Piece {
  x: number;
  end: number;
  y: number;
  text: string;
}

/** Pieces closer than this on one line are one cell, such as "Withdrawal" and "Amt.". */
const SAME_CELL_GAP = 2.5;
/** Pieces whose baselines differ by less than this are on one line. */
const SAME_LINE = 2.5;

function toLines(pieces: Piece[]) {
  const sorted = [...pieces].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Piece[][] = [];
  for (const piece of sorted) {
    const line = lines.at(-1);
    if (line && Math.abs((line[0]?.y ?? 0) - piece.y) <= SAME_LINE) line.push(piece);
    else lines.push([piece]);
  }
  return lines.map((line) => {
    const cells: Piece[] = [];
    for (const piece of line.sort((a, b) => a.x - b.x)) {
      const last = cells.at(-1);
      if (last && piece.x - last.end < SAME_CELL_GAP) {
        last.text = `${last.text}${piece.x - last.end > 0.5 ? ' ' : ''}${piece.text}`;
        last.end = Math.max(last.end, piece.end);
      } else cells.push({ ...piece });
    }
    return cells;
  });
}

const overlap = (a: Piece, b: Piece) => Math.min(a.end, b.end) - Math.max(a.x, b.x);
const centre = (piece: Piece) => (piece.x + piece.end) / 2;

/**
 * A statement PDF's table as rows of cells, ready for `readStatement`. Text is grouped into
 * lines by height on the page, and each piece of a line goes under the header column it
 * overlaps most, or the nearest one, so amounts land in the right column even when a
 * description is long. Read on the device; the file goes nowhere.
 */
export async function pdfRows(data: ArrayBuffer, password?: string): Promise<string[][]> {
  // The legacy build runs on older phones too. Both load only when a PDF is chosen.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { default: workerUrl } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({
    data: new Uint8Array(data),
    disableFontFace: true,
    ...(password ? { password } : {}),
  });
  let document;
  try {
    document = await task.promise;
  } catch (error) {
    if (error instanceof Error && error.name === 'PasswordException') {
      throw new PdfPasswordError(Boolean(password));
    }
    throw error;
  }

  const lines: Piece[][] = [];
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number);
    const content = await page.getTextContent();
    const pieces: Piece[] = [];
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const x = Number(item.transform[4]);
      pieces.push({ x, end: x + item.width, y: Number(item.transform[5]), text: item.str.trim() });
    }
    lines.push(...toLines(pieces));
    page.cleanup();
  }
  await task.destroy();

  const headerIndex = lines.findIndex((line) => columnsOf(line.map((cell) => cell.text)));
  const header = lines[headerIndex];
  if (!header) return lines.map((line) => line.map((cell) => cell.text));

  const rows: string[][] = [header.map((cell) => cell.text)];
  for (const line of lines.slice(headerIndex + 1)) {
    const row = header.map(() => '');
    for (const piece of line) {
      let best = 0;
      let bestScore = -Infinity;
      header.forEach((column, index) => {
        const shared = overlap(piece, column);
        const score = shared > 0 ? shared : -Math.abs(centre(piece) - centre(column));
        if (score > bestScore) {
          bestScore = score;
          best = index;
        }
      });
      row[best] = row[best] ? `${row[best]} ${piece.text}` : piece.text;
    }
    rows.push(row);
  }
  return rows;
}
