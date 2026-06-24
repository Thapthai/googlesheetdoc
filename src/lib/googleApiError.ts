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

function stripHtmlError(msg: string): string {
  if (!msg.includes("<!DOCTYPE") && !msg.includes("<html")) {
    return msg;
  }
  const title = msg.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();
  if (title) return title;
  return "Google server error";
}

export function formatGoogleApiError(error: unknown): string {
  const err = error as {
    code?: number;
    message?: string;
    cause?: { message?: string; code?: number; status?: string };
  };

  const code = err.code ?? err.cause?.code;
  const rawMsg = err.cause?.message ?? err.message ?? String(error);
  const responseMsg = (error as { response?: { data?: { error?: { message?: string; errors?: Array<{ reason?: string }> } } } })
    .response?.data?.error?.message;
  const msg = stripHtmlError(responseMsg ?? rawMsg);

  if (
    code === 502 ||
    msg.includes("502") ||
    msg.includes("Error 502")
  ) {
    return (
      "Google API ขัดข้องชั่วคราว (502)\n\n" +
      "เซิร์ฟเวอร์ของ Google ตอบกลับไม่สำเร็จชั่วคราว — ลองรีเฟรชหรือเรียก URL อีกครั้งใน 30 วินาที\n" +
      "(ระบบจะ retry อัตโนมัติสูงสุด 4 ครั้งแล้ว)"
    );
  }

  if (code === 503 || msg.includes("503") || msg.includes("Error 503")) {
    return (
      "Google API ไม่พร้อมให้บริการชั่วคราว (503) — ลองใหม่อีกครั้งในสักครู่"
    );
  }

  if (code === 429 || msg.includes("429") || msg.includes("Rate Limit")) {
    return "Google API ถูกจำกัดความถี่ (429) — รอสักครู่แล้วลองใหม่";
  }

  if (
    msg.includes("storageQuotaExceeded") ||
    msg.includes("storage quota")
  ) {
    return (
      `Drive ของ Service Account เต็มแล้ว\n\n` +
      `${msg}\n\n` +
      "วิธีแก้:\n" +
      "1. รัน npm run cleanup-drive เพื่อลบ Google Sheet เก่าใน Drive ของ Service Account\n" +
      "2. ลอง npm run check-google อีกครั้ง\n\n" +
      "หมายเหตุ: โค้ดจะลบ Sheet อัตโนมัติหลัง export Excel แล้ว (ไม่สะสมใน Drive)"
    );
  }

  if (
    code === 403 ||
    msg.includes("permission") ||
    msg.includes("PERMISSION_DENIED")
  ) {
    const projectId = readProjectId();
    const projectLine = projectId
      ? `โปรเจกต์: ${projectId}\n\n`
      : "";

    return (
      `Google API ไม่มีสิทธิ์ (403): ${msg}\n\n` +
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
