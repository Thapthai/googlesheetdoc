import "dotenv/config";
import { google } from "googleapis";
import * as fs from "fs";
import * as path from "path";
import {
  createSpreadsheet,
  getDriveStorageQuota,
  getGoogleClients,
  getSharedDriveFolderId,
} from "../lib/googleSheets";
import { getUserGoogleClients, hasUserOAuth } from "../lib/googleOAuth";

function printGoogleError(label: string, err: unknown): void {
  const e = err as {
    code?: number;
    message?: string;
    response?: { data?: unknown };
    errors?: Array<{ reason?: string; message?: string; domain?: string }>;
    cause?: { message?: string; errors?: unknown };
  };

  console.log(`\n[${label}] FAIL`);
  console.log("  code:", e.code ?? "(none)");
  console.log("  message:", e.cause?.message ?? e.message);

  const data = e.response?.data ?? e.cause;
  if (data) {
    console.log("  detail:", JSON.stringify(data, null, 2));
  }
}

async function main(): Promise<void> {
  const credPath = path.join(__dirname, "..", "..", "credentials.json");
  const cred = JSON.parse(fs.readFileSync(credPath, "utf8")) as {
    project_id: string;
    client_email: string;
    private_key_id: string;
  };

  console.log("=== Google API Diagnostic ===\n");
  console.log("Project ID     :", cred.project_id);
  console.log("Service Account:", cred.client_email);
  console.log("Key ID         :", cred.private_key_id);
  const folderId = getSharedDriveFolderId();
  if (folderId) {
    console.log("Drive Folder   :", folderId);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: credPath,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/cloud-platform",
    ],
  });

  // 1) Auth token
  try {
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    console.log("\n[1/4] Access Token : OK");
    console.log("  token length:", token.token?.length ?? 0);
  } catch (err) {
    printGoogleError("1/4 Access Token", err);
    console.error("\n→ credentials.json อาจเสียหาย หรือ key ถูก revoke แล้ว");
    console.error("→ สร้าง Service Account key ใหม่ใน Google Cloud Console");
    process.exit(1);
  }

  const { sheets, drive } =
    folderId && hasUserOAuth() ? getUserGoogleClients() : getGoogleClients();
  const serviceUsage = google.serviceusage({ version: "v1", auth });

  // 2) Enabled APIs
  try {
    const apis = await serviceUsage.services.list({
      parent: `projects/${cred.project_id}`,
      filter: "state:ENABLED",
      pageSize: 200,
    });
    const names =
      apis.data.services?.map((s) => s.config?.name?.replace("services/", "")) ??
      [];
    const hasSheets = names.includes("sheets.googleapis.com");
    const hasDrive = names.includes("drive.googleapis.com");

    console.log("\n[2/4] Enabled APIs : OK");
    console.log("  sheets.googleapis.com:", hasSheets ? "ENABLED" : "NOT FOUND");
    console.log("  drive.googleapis.com :", hasDrive ? "ENABLED" : "NOT FOUND");

    if (!hasSheets || !hasDrive) {
      console.log("\n  ⚠ API ยังไม่เปิดครบ — Enable ที่:");
      if (!hasSheets) {
        console.log(
          `  https://console.cloud.google.com/apis/library/sheets.googleapis.com?project=${cred.project_id}`
        );
      }
      if (!hasDrive) {
        console.log(
          `  https://console.cloud.google.com/apis/library/drive.googleapis.com?project=${cred.project_id}`
        );
      }
    }
  } catch (err) {
    printGoogleError("2/4 Enabled APIs", err);
    console.log("\n  (ข้ามได้ — ต้องเปิด Service Usage API หรือสิทธิ์ viewer บนโปรเจกต์)");
  }

  // 3) Drive quota
  let quotaLimit = -1;
  try {
    const quota = await getDriveStorageQuota(drive);
    quotaLimit = Number(quota?.limit ?? -1);
    console.log("\n[3/5] Drive quota");
    console.log(" ", JSON.stringify(quota));

    if (quotaLimit === 0) {
      console.log("\n  ⚠ limit = 0 → โปรเจกต์ org ไม่อนุญาตให้ SA สร้างไฟล์ใน Drive");
      console.log("  → ใช้ EXCEL_EXPORT_MODE=local ใน .env (สร้าง xlsx ในเครื่อง)");
      console.log("  → หรือสร้างโปรเจกต์ GCP ใหม่ + credentials.json ใหม่");
    }
  } catch (err) {
    printGoogleError("3/5 Drive quota", err);
  }

  // 4) Drive list
  try {
    await drive.files.list({ pageSize: 1, fields: "files(id,name)" });
    console.log("\n[4/5] Drive API list : OK");
  } catch (err) {
    printGoogleError("4/5 Drive API list", err);
  }

  // 5) Create spreadsheet
  if (folderId && !hasUserOAuth()) {
    console.log("\n[5/5] Sheets create  : ต้องใช้ OAuth");
    console.log("\n=== สรุป ===");
    console.log("โฟลเดอร์เป็น My Drive ส่วนตัว — Service Account สร้างไฟล์ไม่ได้");
    console.log("1. สร้าง OAuth Client ใน Google Cloud Console");
    console.log("2. Redirect URI: http://localhost:4100/oauth2callback");
    console.log("3. ใส่ GOOGLE_OAUTH_CLIENT_ID / SECRET ใน .env");
    console.log("4. รัน: npm run auth-google");
    return;
  }

  if (quotaLimit === 0 && !folderId) {
    console.log("\n[5/5] Sheets create  : ข้าม (Drive quota = 0)");
    console.log("\n=== สรุป ===");
    console.log("Google API เชื่อมต่อได้ แต่สร้าง Sheet ใน Drive ไม่ได้");
    console.log("รายงานยังใช้ได้ด้วย EXCEL_EXPORT_MODE=local ใน .env");
    console.log("จากนั้น restart server แล้วเปิด:");
    console.log("  http://localhost:" + (process.env.PORT ?? 999) + "/report_fac_delivery_clean_xls?date=22-06-2026");
    return;
  }

  try {
    const res = await createSpreadsheet(
      sheets,
      drive,
      "API Test " + Date.now(),
      ["Test"]
    );
    console.log("\n[5/5] Sheets create  : OK");
    console.log("  spreadsheetId:", res.spreadsheetId);
    if (res.spreadsheetId) {
      console.log(
        `  url: https://docs.google.com/spreadsheets/d/${res.spreadsheetId}`
      );
      await drive.files.delete({ fileId: res.spreadsheetId });
      console.log("  (ลบ test sheet แล้ว)");
    }
    console.log("\n=== ทุกอย่างพร้อมใช้งาน ===");
  } catch (err) {
    printGoogleError("5/5 Sheets create", err);
    const msg = String(err);
    if (quotaLimit === 0 || msg.includes("quota")) {
      console.log("\n→ ตั้ง EXCEL_EXPORT_MODE=local ใน .env แล้ว restart server");
    } else if (msg.includes("เต็ม")) {
      console.log("\n→ รัน: npm run cleanup-drive");
    }
    console.log("\n=== แนวทางแก้เพิ่มเติม ===");
    console.log(
      "1. ตรวจ Billing: https://console.cloud.google.com/billing/linkedaccount?project=" +
        cred.project_id
    );
    console.log(
      "2. ตรวจ Enabled APIs: https://console.cloud.google.com/apis/dashboard?project=" +
        cred.project_id
    );
    console.log(
      "3. โปรเจกต์ infra-mix-* อาจเป็นโปรเจกต์ org ที่จำกัดสิทธิ์"
    );
    console.log("   → แนะนำสร้างโปรเจกต์ GCP ใหม่ (personal) แล้วสร้าง Service Account + key ใหม่");
    console.log("4. สร้าง key ใหม่: IAM → Service Accounts → sheet-excel-bot → Keys → Add key → JSON");
    console.log("5. ถ้ายังไม่ได้ — อาจต้องให้ Admin org เปิดสิทธิ์ Service Account ใช้ Drive/Sheets");
    process.exit(1);
  }
}

main();
