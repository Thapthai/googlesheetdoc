import "dotenv/config";
import * as path from "path";
import {
  createSpreadsheet,
  exportSpreadsheetToXlsx,
  getGoogleClients,
} from "./lib/googleSheets";

const OUTPUT_DIR = path.join(__dirname, "..", "output");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "report.xlsx");

const SAMPLE_DATA = [
  ["ชื่อ", "อายุ", "เมือง"],
  ["สมชาย", 30, "กรุงเทพฯ"],
  ["สมหญิง", 25, "เชียงใหม่"],
  ["สมศักดิ์", 28, "ภูเก็ต"],
];

async function createExcelFromGoogleSheet(): Promise<void> {
  const { sheets, drive } = getGoogleClients();

  console.log("กำลังสร้าง Google Sheet...");
  const { spreadsheetId } = await createSpreadsheet(
    sheets,
    drive,
    `Report ${new Date().toISOString().slice(0, 10)}`,
    ["Data"]
  );

  console.log("กำลังเขียนข้อมูล...");
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Data!A1",
    valueInputOption: "RAW",
    requestBody: { values: SAMPLE_DATA },
  });

  console.log("กำลัง export เป็นไฟล์ Excel...");
  await exportSpreadsheetToXlsx(drive, spreadsheetId, OUTPUT_FILE, true);

  console.log("\nสำเร็จ!");
  console.log(`ไฟล์ Excel: ${OUTPUT_FILE}`);
  console.log(
    `Google Sheet: https://docs.google.com/spreadsheets/d/${spreadsheetId}`
  );
}

createExcelFromGoogleSheet().catch((error: unknown) => {
  console.error("เกิดข้อผิดพลาด:", error);
  process.exit(1);
});
