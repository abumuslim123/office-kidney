import AdmZip from 'adm-zip';
import { join } from 'path';
import { writeFile } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { tmpdir } from 'os';

const MAX_UNCOMPRESSED_SIZE = 50 * 1024 * 1024; // 50 MB

/**
 * Извлекает текст из файла Apple Pages (.pages).
 * .pages — это ZIP-архив. Внутри есть QuickLook/Preview.pdf.
 * Извлекаем PDF во временный файл и возвращаем путь для дальнейшего парсинга.
 */
export async function extractTextFromPages(
  filePath: string,
): Promise<{ type: 'pdf_path'; value: string }> {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();

  const pdfEntry = entries.find(
    (e) =>
      e.entryName === 'QuickLook/Preview.pdf' ||
      e.entryName.endsWith('/Preview.pdf'),
  );

  if (!pdfEntry) {
    throw new Error(
      'Файл .pages не содержит PDF-превью. Откройте файл в Pages и экспортируйте в PDF.',
    );
  }

  if (pdfEntry.header.size > MAX_UNCOMPRESSED_SIZE) {
    throw new Error('PDF-превью внутри .pages слишком большое');
  }

  const tmpPath = join(tmpdir(), `pages_${uuidv4()}.pdf`);
  await writeFile(tmpPath, pdfEntry.getData());
  return { type: 'pdf_path', value: tmpPath };
}
