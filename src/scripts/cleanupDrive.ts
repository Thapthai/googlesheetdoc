import "dotenv/config";
import {
  getGoogleClients,
  listDriveFiles,
  deleteSpreadsheet,
  getDriveStorageQuota,
} from "../lib/googleSheets";

async function main(): Promise<void> {
  const { drive } = getGoogleClients();

  const quota = await getDriveStorageQuota(drive);
  console.log("Drive storage quota:", quota);

  const files = await listDriveFiles(drive);
  console.log(`พบไฟล์ทั้งหมด: ${files.length} รายการ\n`);

  if (files.length === 0) {
    console.log("ไม่มีไฟล์ให้ลบ");
    return;
  }

  let deleted = 0;
  for (const file of files) {
    if (!file.id) continue;
    try {
      await deleteSpreadsheet(drive, file.id);
      console.log("ลบแล้ว:", file.name ?? file.id);
      deleted++;
    } catch (err) {
      console.error("ลบไม่ได้:", file.name, err);
    }
  }

  console.log(`\nลบสำเร็จ ${deleted}/${files.length} ไฟล์`);
  console.log("ลองรัน: npm run check-google");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
