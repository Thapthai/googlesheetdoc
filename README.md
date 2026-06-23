# Google Sheet Excel Report

สร้างไฟล์ Excel ผ่าน Google Sheets API ด้วย TypeScript  
รองรับรายงาน **Factory Delivery Clean** (แปลงจาก PHP)

## ความต้องการของระบบ

- Node.js 18+
- npm
- บัญชี Google Cloud
- MySQL (ถ้าต้องการดึงข้อมูลจริง)

---

## ติดตั้งโปรเจกต์

```bash
npm install
```

คัดลอกไฟล์ environment:

```bash
copy .env.example .env
```

---

## ตั้งค่า Google (Sheets + Drive + OAuth)

คู่มือฉบับเต็ม: **[docs/GOOGLE_SETUP.md](docs/GOOGLE_SETUP.md)**

สรุปสั้น ๆ:

1. เปิด **Google Sheets API** และ **Google Drive API** ใน [Google Cloud Console](https://console.cloud.google.com/)
2. สร้าง **Service Account** → วาง `credentials.json` ที่ root โปรเจกต์
3. สร้างโฟลเดอร์ใน **Google Drive** → ใส่ `GOOGLE_DRIVE_FOLDER_ID` ใน `.env`
4. สร้าง **OAuth Client** (Web) → รัน `npm run auth-google` → ใส่ `GOOGLE_OAUTH_REFRESH_TOKEN`
5. ตรวจสอบ: `npm run check-google`

```bash
copy .env.example .env
# แก้ค่าใน .env ตามคู่มือ
```

| ตัวแปรสำคัญ | คำอธิบาย |
|-------------|----------|
| `EXCEL_EXPORT_MODE` | `google` หรือ `local` |
| `GOOGLE_DRIVE_FOLDER_ID` | โฟลเดอร์เก็บ Sheet ใน Drive |
| `GOOGLE_OAUTH_*` | OAuth สำหรับ My Drive (จำเป็นเมื่อมีโฟลเดอร์) |
| `GOOGLE_CREDENTIALS_PATH` | path ไปยัง Service Account JSON |

---

## ตั้งค่า Environment (.env)

ดูตัวอย่างครบใน `.env.example` และอธิบายละเอียดใน [docs/GOOGLE_SETUP.md](docs/GOOGLE_SETUP.md)

---

## วิธีรัน

### เปิด HTTP Server (แนะนำ — ใช้แบบ PHP)

```bash
npm start
```

Server จะรันที่ `http://localhost:4100` (หรือตาม `PORT` ใน `.env`)

### เรียกรายงานผ่าน URL (เหมือน PHP)

```
http://localhost:4100/report_fac_delivery_clean_xls?date=22-06-2026
http://localhost:4100/report_fac_delivery_clean_xls?typedate=2&sdate=01-06-2026&edate=22-06-2026
http://localhost:4100/report_fac_delivery_clean_xls?typedate=0&month=06-2026
http://localhost:4100/report_fac_delivery_clean_xls?date=22-06-2026&price=1
http://localhost:4100/report_fac_delivery_clean_xls?date=22-06-2026&lg=en
```

| Query param | คำอธิบาย |
|-------------|----------|
| `date` | วันเดียว (dd-mm-yyyy) |
| `typedate` | 0=รายเดือน, 1=วันเดียว, 2=ช่วงวันที่ |
| `sdate`, `edate` | วันที่เริ่ม-สิ้นสุด (dd-mm-yyyy) |
| `month` | เดือน-ปี (mm-yyyy) |
| `price` | 1=แสดงราคา |
| `lg` | th หรือ en |
| `itemcode` | รหัสรายการ |

เปิด URL แล้ว browser จะดาวน์โหลดไฟล์ `.xlsx` อัตโนมัติ

### รัน CLI (ไม่ผ่าน browser)

```bash
npm run report:fac-delivery -- --date 22-06-2026
```

### ทดสอบสร้าง Excel ตัวอย่าง

```bash
npm run demo
```

---

## ผลลัพธ์

| รายการ | ตำแหน่ง |
|--------|---------|
| ไฟล์ Excel | `reports/Report_fac_delivery_clean_xls_YYYY-MM-DD_HH_MM_SS.xlsx` |
| Google Sheet | URL แสดงใน console หลังรันสำเร็จ |

---

## โครงสร้างโปรเจกต์

```
googleSheet/
├── credentials.json
├── .env
├── reports/                         # ไฟล์ Excel ที่ export
├── src/
│   ├── server.ts                    # HTTP server (port 999)
│   ├── lib/                         # ใช้ร่วมกันทุกรายงาน
│   └── reports/
│       ├── types.ts                 # interface ReportService
│       ├── registerReports.ts       # ลงทะเบียนรายงานทั้งหมด
│       └── services/
│           └── report_fac_delivery_clean_xls/   # 1 รายงาน = 1 โฟลเดอร์
│               ├── service.ts       # entry point + route
│               ├── parseParams.ts
│               ├── dataService.ts
│               ├── sheetBuilder.ts
│               ├── sheetFormat.ts
│               ├── i18n.ts
│               └── types.ts
└── package.json
```

### เพิ่มรายงานใหม่

1. คัดลอกโฟลเดอร์ `services/report_fac_delivery_clean_xls/` เป็นชื่อใหม่
2. แก้ไข `service.ts` (route, logic สร้างรายงาน)
3. เพิ่ม import ใน `registerReports.ts`

```typescript
import { newReport } from "./services/report_xxx/service";

export const reportServices: ReportService[] = [
  facDeliveryCleanReport,
  newReport,  // เพิ่มตรงนี้
];
```

Server จะสร้าง route อัตโนมัติจาก `registerReports.ts`

---

## คำสั่ง Google

| คำสั่ง | หน้าที่ |
|--------|---------|
| `npm run check-google` | ตรวจสอบ API, quota, สร้าง Sheet ทดสอบ |
| `npm run auth-google` | ขอ OAuth refresh token |
| `npm run cleanup-drive` | ลบไฟล์ใน Drive ของ Service Account |

แก้ปัญหา Google API: ดู [docs/GOOGLE_SETUP.md — แก้ปัญหา](docs/GOOGLE_SETUP.md#แก้ปัญหา-troubleshooting)

### ใช้ข้อมูลตัวอย่างแทน MySQL

- ตั้ง `USE_MOCK_DATA=1` ใน `.env`
- ตั้ง `USE_MOCK_DATA=0` เมื่อต้องการเชื่อม MySQL จริง
