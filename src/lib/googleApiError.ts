import * as fs from "fs";
import * as path from "path";

function readProjectId(): string | null {
  try {
    const credPath = path.join(__dirname, "..", "..", "credentials.json");
    const cred = JSON.parse(fs.readFileSync(credPath, "utf8")) as {
      project_id?: string;
    };
    return cred.project_id ?? null;
  } catch {
    return null;
  }
}

export function formatGoogleApiError(error: unknown): string {
  const err = error as {
    code?: number;
    message?: string;
    cause?: { message?: string; code?: number; status?: string };
  };

  const code = err.code ?? err.cause?.code;
  const msg = err.cause?.message ?? err.message ?? String(error);
  const responseMsg = (error as { response?: { data?: { error?: { message?: string; errors?: Array<{ reason?: string }> } } } })
    .response?.data?.error?.message;
  const fullMsg = responseMsg ?? msg;

  if (
    fullMsg.includes("storageQuotaExceeded") ||
    fullMsg.includes("storage quota")
  ) {
    return (
      `Drive ของ Service Account เต็มแล้ว\n\n` +
      `${fullMsg}\n\n` +
      "วิธีแก้:\n" +
      "1. รัน npm run cleanup-drive เพื่อลบ Google Sheet เก่าใน Drive ของ Service Account\n" +
      "2. ลอง npm run check-google อีกครั้ง\n\n" +
      "หมายเหตุ: โค้ดจะลบ Sheet อัตโนมัติหลัง export Excel แล้ว (ไม่สะสมใน Drive)"
    );
  }

  if (
    code === 403 ||
    fullMsg.includes("permission") ||
    fullMsg.includes("PERMISSION_DENIED")
  ) {
    const projectId = readProjectId();
    const projectLine = projectId
      ? `โปรเจกต์: ${projectId}\n\n`
      : "";

    return (
      `Google API ไม่มีสิทธิ์ (403): ${fullMsg}\n\n` +
      projectLine +
      "วิธีแก้:\n" +
      (projectId
        ? `1. เปิด Google Sheets API:\n   https://console.cloud.google.com/apis/library/sheets.googleapis.com?project=${projectId}\n   → กด Enable\n\n` +
          `2. เปิด Google Drive API:\n   https://console.cloud.google.com/apis/library/drive.googleapis.com?project=${projectId}\n   → กด Enable\n\n`
        : "1. เปิด Google Sheets API และ Google Drive API ใน Google Cloud Console\n\n") +
      "3. ตรวจว่า credentials.json มาจากโปรเจกต์เดียวกัน\n" +
      "4. รอ 1–2 นาที แล้วรัน: npm run check-google"
    );
  }

  return msg;
}
