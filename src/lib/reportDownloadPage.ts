import { Response } from "express";
import { ReportResult } from "../report/types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildReportSuccessHtml(
  result: ReportResult,
  downloadUrl: string
): string {
  const sheetUrl = escapeHtml(result.spreadsheetUrl);
  const fileName = escapeHtml(result.fileName);
  const download = escapeHtml(downloadUrl);

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>สร้างรายงานสำเร็จ</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 36rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.5; }
    a { color: #1a73e8; }
    .actions { margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .btn {
      display: inline-block; padding: 0.6rem 1rem; border-radius: 6px;
      background: #1a73e8; color: #fff !important; text-decoration: none; text-align: center;
    }
    .btn.secondary { background: #fff; color: #1a73e8 !important; border: 1px solid #dadce0; }
  </style>
</head>
<body>
  <h1>สร้างรายงานสำเร็จ</h1>
  <p>กำลังเปิด Google Sheet ในแท็บใหม่ — กดปุ่มด้านล่างเพื่อดาวน์โหลดไฟล์ Excel</p>
  <div class="actions">
    <a class="btn" id="open-sheet" href="${sheetUrl}" target="_blank" rel="noopener noreferrer">เปิด Google Sheet</a>
    <a class="btn secondary" href="${download}" download="${fileName}">ดาวน์โหลด ${fileName}</a>
  </div>
  <p style="margin-top:2rem;color:#5f6368;font-size:0.9rem">
    ถ้าแท็บ Google Sheet ไม่เปิดอัตโนมัติ (browser บล็อก popup) ให้คลิกปุ่ม "เปิด Google Sheet"
  </p>
  <script>
    (function () {
      var sheet = document.getElementById("open-sheet");
      if (sheet) sheet.click();
    })();
  </script>
</body>
</html>`;
}

export function sendReportResponse(
  res: Response,
  result: ReportResult,
  downloadUrl: string
): void {
  if (result.spreadsheetUrl.startsWith("http")) {
    res.setHeader("X-Spreadsheet-Url", result.spreadsheetUrl);
    res.type("html").send(buildReportSuccessHtml(result, downloadUrl));
    return;
  }

  res.download(result.outputPath, result.fileName, (err) => {
    if (err && !res.headersSent) {
      res.status(500).json({
        error: "ไม่สามารถส่งไฟล์ได้",
        detail: String(err),
      });
    }
  });
}
