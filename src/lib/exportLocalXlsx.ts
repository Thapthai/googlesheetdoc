import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";

export interface LocalSheet {
  title: string;
  values: (string | number)[][];
}

export function exportSheetsToLocalXlsx(
  sheets: LocalSheet[],
  outputPath: string
): void {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.values);
    const title = sheet.title.slice(0, 31) || "Sheet1";
    XLSX.utils.book_append_sheet(workbook, worksheet, title);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  XLSX.writeFile(workbook, outputPath);
}

export function shouldUseLocalExport(): boolean {
  return process.env.EXCEL_EXPORT_MODE === "local";
}

export function isDriveQuotaError(error: unknown): boolean {
  const msg = String(
    (error as { message?: string; cause?: { message?: string } })?.cause
      ?.message ??
      (error as Error)?.message ??
      error
  );
  return (
    msg.includes("storageQuotaExceeded") ||
    msg.includes("storage quota") ||
    msg.includes("Drive ของ Service Account เต็ม") ||
    msg.includes('limit":"0"')
  );
}
