import { google, drive_v3, sheets_v4 } from "googleapis";
import * as fs from "fs";
import * as path from "path";

const PROJECT_ROOT = path.join(__dirname, "..", "..");
const DEFAULT_CREDENTIALS_PATH = path.join(PROJECT_ROOT, "credentials.json");

export function resolveCredentialsPath(): string {
  const fromEnv =
    process.env.GOOGLE_CREDENTIALS_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;

  const candidates = [
    fromEnv ? path.resolve(fromEnv) : null,
    DEFAULT_CREDENTIALS_PATH,
  ].filter((p): p is string => Boolean(p));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const expectedPath = fromEnv
    ? path.resolve(fromEnv)
    : DEFAULT_CREDENTIALS_PATH;

  throw new Error(
    [
      "ไม่พบไฟล์ Google Service Account credentials",
      "",
      "วาง Service Account key ที่:",
      `   ${expectedPath}`,
    ].join("\n")
  );
}

export function getSharedDriveFolderId(): string | undefined {
  const id = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  return id || undefined;
}

export function shouldKeepSheetInDrive(): boolean {
  return (
    Boolean(getSharedDriveFolderId()) || process.env.GOOGLE_KEEP_SHEET === "1"
  );
}

export function getGoogleClients() {
  const credentialsPath = resolveCredentialsPath();

  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });

  return {
    auth,
    sheets: google.sheets({ version: "v4", auth }),
    drive: google.drive({ version: "v3", auth }),
  };
}

function extractApiMessage(error: unknown): string {
  const err = error as {
    message?: string;
    cause?: { message?: string };
    response?: { data?: { error?: { message?: string } } };
  };
  return (
    err.response?.data?.error?.message ??
    err.cause?.message ??
    err.message ??
    String(error)
  );
}

async function configureSheetTabs(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetTitles: string[]
): Promise<number[]> {
  if (sheetTitles.length > 1) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: sheetTitles.slice(1).map((t, i) => ({
          addSheet: { properties: { title: t, index: i + 1 } },
        })),
      },
    });
  }

  if (sheetTitles[0]) {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const firstSheet = meta.data.sheets?.[0];
    if (firstSheet?.properties?.sheetId != null) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId: firstSheet.properties.sheetId,
                  title: sheetTitles[0],
                },
                fields: "title",
              },
            },
          ],
        },
      });
    }
  }

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  return meta.data.sheets?.map((s) => s.properties?.sheetId ?? 0) ?? [];
}

async function createViaDrive(
  sheets: sheets_v4.Sheets,
  drive: drive_v3.Drive,
  title: string,
  sheetTitles: string[],
  folderId?: string
): Promise<{ spreadsheetId: string; sheetIds: number[] }> {
  const driveFile = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: "application/vnd.google-apps.spreadsheet",
      ...(folderId ? { parents: [folderId] } : {}),
    },
    fields: "id",
    supportsAllDrives: true,
  });

  const spreadsheetId = driveFile.data.id;
  if (!spreadsheetId) {
    throw new Error("ไม่สามารถสร้าง Google Sheet ใน Drive ได้");
  }

  const sheetIds = await configureSheetTabs(sheets, spreadsheetId, sheetTitles);
  return { spreadsheetId, sheetIds };
}

export async function createSpreadsheet(
  sheets: sheets_v4.Sheets,
  drive: drive_v3.Drive,
  title: string,
  sheetTitles: string[]
): Promise<{ spreadsheetId: string; sheetIds: number[] }> {
  const folderId = getSharedDriveFolderId();

  // โฟลเดอร์ที่แชร์ → สร้างผ่าน Drive API ในโฟลเดอร์นั้น (ใช้ quota ของเจ้าของโฟลเดอร์)
  if (folderId) {
    try {
      return await createViaDrive(sheets, drive, title, sheetTitles, folderId);
    } catch (driveError) {
      const msg = extractApiMessage(driveError);
      if (
        msg.includes("storageQuotaExceeded") ||
        msg.includes("storage quota")
      ) {
        throw new Error(
          `สร้าง Sheet ในโฟลเดอร์ไม่ได้: ${msg}\n` +
            "ตรวจสอบว่าแชร์โฟลเดอร์ให้ Service Account เป็น Editor แล้ว:\n" +
            "  sheet-excel-bot@infra-mix-500203-u4.iam.gserviceaccount.com"
        );
      }
      if (msg.includes("notFound") || msg.includes("File not found")) {
        throw new Error(
          `ไม่พบโฟลเดอร์ GOOGLE_DRIVE_FOLDER_ID=${folderId}\n` +
            "แชร์โฟลเดอร์ให้ Service Account เป็น Editor"
        );
      }
      throw driveError;
    }
  }

  try {
    const createResponse = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title },
        sheets: sheetTitles.map((sheetTitle) => ({
          properties: { title: sheetTitle },
        })),
      },
    });

    const spreadsheetId = createResponse.data.spreadsheetId;
    if (!spreadsheetId) {
      throw new Error("ไม่สามารถสร้าง Google Sheet ได้");
    }

    const sheetIds =
      createResponse.data.sheets?.map((s) => s.properties?.sheetId ?? 0) ?? [];

    return { spreadsheetId, sheetIds };
  } catch (sheetsError) {
    try {
      return await createViaDrive(sheets, drive, title, sheetTitles);
    } catch (driveError) {
      const msg = extractApiMessage(driveError);
      if (
        msg.includes("storageQuotaExceeded") ||
        msg.includes("storage quota")
      ) {
        throw new Error(
          "Service Account ไม่มีพื้นที่ Drive — ตั้ง GOOGLE_DRIVE_FOLDER_ID โฟลเดอร์ที่แชร์แล้ว หรือใช้ EXCEL_EXPORT_MODE=local"
        );
      }
      throw driveError;
    }
  }
}

export async function deleteSpreadsheet(
  drive: drive_v3.Drive,
  spreadsheetId: string
): Promise<void> {
  await drive.files.delete({
    fileId: spreadsheetId,
    supportsAllDrives: true,
  });
}

export async function exportSpreadsheetToXlsx(
  drive: drive_v3.Drive,
  spreadsheetId: string,
  outputPath: string,
  deleteAfterExport?: boolean
): Promise<void> {
  const shouldDelete =
    deleteAfterExport ?? !shouldKeepSheetInDrive();

  const exportResponse = await drive.files.export(
    {
      fileId: spreadsheetId,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
    { responseType: "arraybuffer" }
  );

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.from(exportResponse.data as ArrayBuffer));

  if (shouldDelete) {
    try {
      await deleteSpreadsheet(drive, spreadsheetId);
    } catch {
      // export สำเร็จแล้ว — ลบ Sheet ไม่ได้ไม่เป็นไร
    }
  }
}

export async function listDriveFiles(drive: drive_v3.Drive) {
  const files: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      pageSize: 100,
      pageToken,
      fields: "nextPageToken,files(id,name,mimeType,createdTime)",
      q: "trashed=false",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    if (res.data.files) files.push(...res.data.files);
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}

export async function getDriveStorageQuota(drive: drive_v3.Drive) {
  const about = await drive.about.get({ fields: "storageQuota" });
  return about.data.storageQuota;
}
