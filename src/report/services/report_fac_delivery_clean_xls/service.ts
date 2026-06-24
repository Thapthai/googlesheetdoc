import * as path from "path";
import { sheets_v4 } from "googleapis";
import { withGoogleRetry } from "../../../lib/googleRetry";
import { formatPrintDateEn, formatPrintDateTh } from "../../../lib/dateTh";
import {
  exportSheetsToLocalXlsx,
  isDriveQuotaError,
  shouldUseLocalExport,
} from "../../../lib/exportLocalXlsx";
import {
  createSpreadsheet,
  exportSpreadsheetToXlsx,
  getGoogleClients,
  getSharedDriveFolderId,
  shouldKeepSheetInDrive,
} from "../../../lib/googleSheets";
import { getUserGoogleClients, hasUserOAuth } from "../../../lib/googleOAuth";
import { ReportResult, ReportService } from "../../types";
import { fetchReportData } from "./dataService";
import { EN, TH } from "./i18n";
import { parseReportParams, parseReportParamsFromQuery } from "./parseParams";
import { buildFormatRequests } from "./sheetFormat";
import {
  buildDailySheet,
  buildOutputFileName,
  buildSummarySheet,
  buildTopic,
} from "./sheetBuilder";
import { ReportParams } from "./types";

const REPORTS_DIR = path.join(__dirname, "..", "..", "..", "..", "reports");
const BATCH_CHUNK_SIZE = 80;

async function batchUpdateInChunks(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  requests: sheets_v4.Schema$Request[],
  label: string
): Promise<void> {
  if (requests.length === 0) return;

  for (let i = 0; i < requests.length; i += BATCH_CHUNK_SIZE) {
    const chunk = requests.slice(i, i + BATCH_CHUNK_SIZE);
    const chunkNo = Math.floor(i / BATCH_CHUNK_SIZE) + 1;
    await withGoogleRetry(
      () =>
        sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: chunk },
        }),
      { label: `${label} batch ${chunkNo}` }
    );
  }
}

function resolveGoogleClients() {
  const folderId = getSharedDriveFolderId();
  if (folderId) {
    if (!hasUserOAuth()) {
      throw new Error(
        "โฟลเดอร์ Drive เป็น My Drive ส่วนตัว — Service Account สร้างไฟล์ไม่ได้\n" +
          "วิธีแก้:\n" +
          "1. สร้าง OAuth Client ใน Google Cloud Console (Web application)\n" +
          "2. Redirect URI: http://localhost:4100/oauth2callback\n" +
          "3. ใส่ GOOGLE_OAUTH_CLIENT_ID และ GOOGLE_OAUTH_CLIENT_SECRET ใน .env\n" +
          "4. รัน npm run auth-google แล้ว login Gmail dragonfried01@gmail.com\n" +
          "5. restart server"
      );
    }
    return getUserGoogleClients();
  }
  return getGoogleClients();
}

async function exportViaGoogle(
  allSheets: ReturnType<typeof buildSummarySheet>[],
  sheetTitles: string[],
  params: ReportParams,
  fileName: string,
  outputPath: string
): Promise<ReportResult> {
  const { sheets, drive } = resolveGoogleClients();
  const { spreadsheetId, sheetIds } = await withGoogleRetry(
    () =>
      createSpreadsheet(
        sheets,
        drive,
        `Report Fac Delivery Clean ${params.startDate}`,
        sheetTitles
      ),
    { label: "create spreadsheet" }
  );

  for (let i = 0; i < allSheets.length; i++) {
    const sheet = allSheets[i];
    const sheetName = sheetTitles[i];

    await withGoogleRetry(
      () =>
        sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'${sheetName}'!A1`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: sheet.values },
        }),
      { label: `values ${sheetName}` }
    );

    await batchUpdateInChunks(
      sheets,
      spreadsheetId,
      buildFormatRequests(sheet, sheetIds[i]),
      sheetName
    );
  }

  await withGoogleRetry(
    () =>
      exportSpreadsheetToXlsx(
        drive,
        spreadsheetId,
        outputPath,
        !shouldKeepSheetInDrive()
      ),
    { label: "export xlsx" }
  );

  return {
    fileName,
    outputPath,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
  };
}

function exportViaLocal(
  allSheets: ReturnType<typeof buildSummarySheet>[],
  fileName: string,
  outputPath: string
): ReportResult {
  exportSheetsToLocalXlsx(
    allSheets.map((s) => ({ title: s.title, values: s.values })),
    outputPath
  );

  return {
    fileName,
    outputPath,
    spreadsheetUrl: "(local xlsx — ไม่ใช้ Google Drive)",
  };
}

async function generate(params: ReportParams): Promise<ReportResult> {
  const language = params.lg === "en" ? EN : TH;
  const nameCol = params.lg === "en" ? "name_en" : "name_th";
  const printDate =
    params.lg === "en" ? formatPrintDateEn() : formatPrintDateTh();
  const topic = buildTopic(params, language);

  const { dates, items, data } = await fetchReportData(params, nameCol);

  const summarySheet = buildSummarySheet({
    language,
    printDate,
    topic,
    dates,
    items,
    data,
    showPrice: params.showPrice,
  });

  const dailySheets = dates.map((dateInfo) =>
    buildDailySheet({
      language,
      printDate,
      topic,
      dateInfo,
      items,
      data,
      showPrice: params.showPrice,
      lg: params.lg,
    })
  );

  const allSheets = [summarySheet, ...dailySheets];
  const sheetTitles = allSheets.map((s) => s.title);
  const fileName = buildOutputFileName();
  const outputPath = path.join(REPORTS_DIR, fileName);

  if (shouldUseLocalExport()) {
    return exportViaLocal(allSheets, fileName, outputPath);
  }

  try {
    return await exportViaGoogle(
      allSheets,
      sheetTitles,
      params,
      fileName,
      outputPath
    );
  } catch (error) {
    if (getSharedDriveFolderId()) {
      throw error;
    }
    if (isDriveQuotaError(error)) {
      console.warn(
        "Google Drive quota = 0 → ใช้ local xlsx แทน"
      );
      return exportViaLocal(allSheets, fileName, outputPath);
    }
    throw error;
  }
}

export const facDeliveryCleanReport: ReportService = {
  id: "report_fac_delivery_clean_xls",
  route: "/report_fac_delivery_clean_xls",
  description: "รายงาน โรงซักส่งออกผ้าสะอาด",
  exampleUrl: "/report_fac_delivery_clean_xls?date=22-06-2026&lg=th&price=0",
  parseParamsFromQuery: (query) => parseReportParamsFromQuery(query),
  parseParamsFromArgv: (argv) => parseReportParams(argv),
  generate: (params) => generate(params as ReportParams),
};

