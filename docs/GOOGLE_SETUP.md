# คู่มือตั้งค่า Google (Sheets + Drive)

คู่มือนี้อธิบายการตั้งค่า Google Cloud, Service Account, OAuth และตัวแปรใน `.env` สำหรับโปรเจกต์ **google-sheet-excel**

---

## ภาพรวม: ระบบทำงานอย่างไร

```
Browser / CLI
     │
     ▼
HTTP Server (Express)
     │
     ▼
Report Service
     │
     ├─ EXCEL_EXPORT_MODE=local  → สร้าง .xlsx ในเครื่อง (ไม่ใช้ Google)
     │
     └─ EXCEL_EXPORT_MODE=google → สร้าง Google Sheet → export .xlsx → เก็บใน reports/
              │
              ├─ มี GOOGLE_DRIVE_FOLDER_ID + OAuth  → ใช้ Gmail ของคุณ (แนะนำ)
              └─ ไม่มีโฟลเดอร์ / ไม่มี OAuth      → ใช้ Service Account
```

| โหมด | ใช้เมื่อ | Sheet อยู่ที่ไหน |
|------|----------|-----------------|
| **google + OAuth + โฟลเดอร์ Drive** | โฟลเดอร์เป็น My Drive ส่วนตัว | โฟลเดอร์ที่ตั้งใน `GOOGLE_DRIVE_FOLDER_ID` |
| **google + Service Account** | โปรเจกต์ GCP ส่วนตัวที่ SA มี quota Drive | Drive ของ Service Account |
| **local** | ไม่ต้องการ Google / SA quota = 0 | ไม่สร้าง Sheet (มีแค่ไฟล์ .xlsx) |

---

## สิ่งที่ต้องเตรียม

- บัญชี Google (Gmail ที่เป็นเจ้าของโฟลเดอร์ Drive)
- โปรเจกต์ [Google Cloud Console](https://console.cloud.google.com/)
- Node.js 18+ และรัน `npm install` แล้ว

---

## ขั้นตอนที่ 1 — เปิด API ใน Google Cloud

### 1.1 สร้างหรือเลือกโปรเจกต์

1. เปิด [Google Cloud Console](https://console.cloud.google.com/)
2. คลิก dropdown โปรเจกต์ด้านบน → **New Project**
3. ตั้งชื่อ เช่น `google-sheet-excel` → **Create**

> **หมายเหตุ:** โปรเจกต์องค์กร (เช่น `infra-mix-*`) อาจจำกัด quota ของ Service Account ให้เป็น `0` — ถ้าเจอปัญหานี้ ให้ใช้โปรเจกต์ส่วนตัว หรือใช้ OAuth แทน

### 1.2 เปิด Google Sheets API

1. ไปที่ **APIs & Services** → **Library**
2. ค้นหา **Google Sheets API** → **Enable**

ลิงก์ตรง: https://console.cloud.google.com/apis/library/sheets.googleapis.com

### 1.3 เปิด Google Drive API

1. กลับไปที่ **Library**
2. ค้นหา **Google Drive API** → **Enable**

ลิงก์ตรง: https://console.cloud.google.com/apis/library/drive.googleapis.com

### 1.4 ตรวจสอบ

ไปที่ **APIs & Services** → **Enabled APIs & services** ต้องเห็นทั้งสองรายการ:

- Google Sheets API
- Google Drive API

---

## ขั้นตอนที่ 2 — สร้าง Service Account

Service Account ใช้สำหรับ:

- รันสคริปต์ `check-google` เพื่อตรวจสอบ API
- สร้าง Sheet โดยตรง (กรณีไม่ใช้โฟลเดอร์ My Drive)
- fallback เมื่อไม่มี OAuth

### 2.1 สร้าง Service Account

1. **APIs & Services** → **Credentials**
2. **+ Create Credentials** → **Service account**
3. ชื่อ เช่น `sheet-excel-bot` → **Create and Continue**
4. Role: **Editor** (หรือข้ามได้) → **Done**

### 2.2 ดาวน์โหลด Key (JSON)

1. คลิก Service Account ที่สร้าง → แท็บ **Keys**
2. **Add Key** → **Create new key** → เลือก **JSON** → **Create**
3. ย้ายไฟล์ที่ดาวน์โหลดมาไว้ที่ root โปรเจกต์:

```
googleSheet/
└── credentials.json
```

### 2.3 อย่า commit ไฟล์นี้

`credentials.json` และ `.env` ต้องอยู่ใน `.gitignore` เสมอ

---

## ขั้นตอนที่ 3 — ตั้งค่าโฟลเดอร์ Google Drive (แนะนำ)

ถ้าต้องการให้ Google Sheet ปรากฏใน Drive ของคุณ (ไม่ใช่ Drive ของ bot):

### 3.1 สร้างโฟลเดอร์ใน Google Drive

1. เปิด [Google Drive](https://drive.google.com/)
2. สร้างโฟลเดอร์ใหม่ เช่น `google sheet Test`

### 3.2 คัดลอก Folder ID

เปิดโฟลเดอร์ → ดู URL:

```
https://drive.google.com/drive/folders/1C3wKD2FlFihAWzML6EaVcGFZVmq3YtI4
                                        └────────── Folder ID ──────────┘
```

นำ ID นี้ไปใส่ใน `.env`:

```env
GOOGLE_DRIVE_FOLDER_ID=1C3wKD2FlFihAWzML6EaVcGFZVmq3YtI4
```

### 3.3 ทำไมต้องใช้ OAuth ด้วย?

โฟลเดอร์ใน **My Drive ส่วนตัว** เป็นของ Gmail คุณ — Service Account **สร้างไฟล์ในโฟลเดอร์นี้โดยตรงไม่ได้** (แม้จะแชร์โฟลเดอร์ให้ SA แล้ว)

ระบบจึงใช้ **OAuth** (login ด้วย Gmail ของคุณ) เมื่อตั้ง `GOOGLE_DRIVE_FOLDER_ID` แล้ว

---

## ขั้นตอนที่ 4 — ตั้งค่า OAuth (สำหรับ My Drive)

### 4.1 ตั้ง OAuth consent screen

1. **APIs & Services** → **OAuth consent screen**
2. User Type: **External** → **Create**
3. กรอก **App name** เช่น `POSE Report`
4. **User support email** และ **Developer contact** → **Save and Continue**
5. **Scopes** → ข้ามได้ (โค้ดขอ scope ตอน login)
6. **Test users** → **Add users** → ใส่ Gmail ที่เป็นเจ้าของโฟลเดอร์ Drive
7. **Save**

> แอปอยู่ในโหมด **Testing** — เฉพาะ Test users ที่เพิ่มไว้เท่านั้นที่ login ได้

### 4.2 สร้าง OAuth Client ID

1. **APIs & Services** → **Credentials**
2. **+ Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: เช่น `google-sheet-report`
5. **Authorized redirect URIs** → เพิ่ม:

```
http://localhost:4100/oauth2callback
```

(เปลี่ยน port ให้ตรงกับ `PORT` ใน `.env`)

6. **Create** → คัดลอก **Client ID** และ **Client secret**

### 4.3 ใส่ค่าใน `.env`

```env
GOOGLE_OAUTH_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-xxxx
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:4100/oauth2callback
```

### 4.4 ขอ Refresh Token

**วิธีที่ 1 — ผ่าน server (แนะนำ)**

```bash
npm start
```

เปิด terminal อีกหน้าต่าง:

```bash
npm run auth-google
```

1. คัดลอก URL ที่แสดง → เปิดใน browser
2. Login ด้วย Gmail เจ้าของโฟลเดอร์ → อนุญาต
3. ถ้า server รันอยู่ หน้า `http://localhost:4100/oauth2callback` จะแสดง `GOOGLE_OAUTH_REFRESH_TOKEN`
4. คัดลอกค่าไปใส่ใน `.env`

**วิธีที่ 2 — วาง code ใน terminal**

หลัง login จะ redirect ไป URL แบบนี้:

```
http://localhost:4100/oauth2callback?code=4/0AeanS...
```

คัดลอก `code=...` ทั้งก้อน หรือ URL เต็ม ไปวางตอน `npm run auth-google` ถาม

### 4.5 เพิ่มใน `.env` แล้ว restart

```env
GOOGLE_OAUTH_REFRESH_TOKEN=1//0gxxxx...
```

```bash
# หยุด server (Ctrl+C) แล้วรันใหม่
npm start
```

---

## ขั้นตอนที่ 5 — ตั้งค่า `.env`

คัดลอกจากตัวอย่าง:

```bash
copy .env.example .env
```

### ตัวแปรที่เกี่ยวกับ Google

| ตัวแปร | บังคับ | คำอธิบาย |
|--------|--------|----------|
| `EXCEL_EXPORT_MODE` | ใช่ | `google` = สร้างผ่าน Google Sheet, `local` = สร้าง xlsx ในเครื่องอย่างเดียว |
| `GOOGLE_CREDENTIALS_PATH` | แนะนำ | path ไปยัง Service Account JSON (ค่าเริ่มต้น `./credentials.json`) |
| `GOOGLE_DRIVE_FOLDER_ID` | ถ้าใช้ Drive | ID โฟลเดอร์ที่ต้องการเก็บ Sheet |
| `GOOGLE_OAUTH_CLIENT_ID` | ถ้ามีโฟลเดอร์ | OAuth Client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | ถ้ามีโฟลเดอร์ | OAuth Client secret |
| `GOOGLE_OAUTH_REDIRECT_URI` | ถ้ามีโฟลเดอร์ | ต้องตรงกับที่ลงทะเบียนใน GCP (default `http://localhost:4100/oauth2callback`) |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | ถ้ามีโฟลเดอร์ | token จากขั้นตอน auth |
| `GOOGLE_KEEP_SHEET` | ไม่ | ตั้ง `1` เพื่อเก็บ Sheet ใน Drive แม้ไม่มี `GOOGLE_DRIVE_FOLDER_ID` |
| `PORT` | ไม่ | port ของ HTTP server (default `999`, แนะนำ `4100`) |

### ตัวอย่าง `.env` แบบครบ (My Drive + OAuth)

```env
USE_MOCK_DATA=1
PORT=4100

EXCEL_EXPORT_MODE=google
GOOGLE_CREDENTIALS_PATH=./credentials.json
GOOGLE_DRIVE_FOLDER_ID=ใส่_folder_id_ของคุณ

GOOGLE_OAUTH_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-xxxx
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:4100/oauth2callback
GOOGLE_OAUTH_REFRESH_TOKEN=1//0gxxxx...
```

### ตัวอย่าง `.env` แบบ local (ไม่ใช้ Google)

```env
EXCEL_EXPORT_MODE=local
```

---

## ขั้นตอนที่ 6 — ตรวจสอบการตั้งค่า

### รันสคริปต์ตรวจสอบ

```bash
npm run check-google
```

ผลลัพธ์ที่ต้องการ:

```
[1/4] Access Token : OK
[2/4] Enabled APIs : OK
[3/5] Drive quota  : (limit ไม่ใช่ 0 หรือใช้ OAuth)
[4/5] Drive API list : OK
[5/5] Sheets create  : OK

=== ทุกอย่างพร้อมใช้งาน ===
```

### ทดสอบรายงาน

```bash
npm start
```

เปิด browser:

```
http://localhost:4100/report_fac_delivery_clean_xls?date=22-06-2026&lg=th&price=0
```

ผลลัพธ์:

| รายการ | ตำแหน่ง |
|--------|---------|
| ไฟล์ `.xlsx` | โฟลเดอร์ `reports/` + browser ดาวน์โหลดอัตโนมัติ |
| Google Sheet | โฟลเดอร์ Drive ที่ตั้งไว้ |
| URL ของ Sheet | HTTP header `X-Spreadsheet-Url` ใน response |

---

## คำสั่งที่เกี่ยวข้อง

| คำสั่ง | หน้าที่ |
|--------|---------|
| `npm run check-google` | ตรวจสอบ credentials, API, quota, สร้าง Sheet ทดสอบ |
| `npm run auth-google` | ขั้นตอน OAuth — ได้ `GOOGLE_OAUTH_REFRESH_TOKEN` |
| `npm run cleanup-drive` | ลบไฟล์ใน Drive ของ Service Account (เมื่อ quota เต็ม) |
| `npm start` | เปิด HTTP server |
| `npm run report:fac-delivery` | รันรายงานผ่าน CLI |

---

## แก้ปัญหา (Troubleshooting)

### ไม่พบ `credentials.json`

```
ไม่พบไฟล์ Google Service Account credentials
```

- วางไฟล์ JSON ที่ root โปรเจกต์ หรือ
- ตั้ง `GOOGLE_CREDENTIALS_PATH` ใน `.env`

---

### `The caller does not have permission` (403)

- ตรวจว่าเปิด **Sheets API** และ **Drive API** ในโปรเจกต์เดียวกับที่สร้าง Service Account
- ตรวจว่า `credentials.json` มาจากโปรเจกต์ที่เปิด API แล้ว
- รอ 1–2 นาทีหลัง Enable API แล้วลองใหม่

---

### Drive quota `limit: 0` (Service Account)

```
limit = 0 → โปรเจกต์ org ไม่อนุญาตให้ SA สร้างไฟล์ใน Drive
```

**ทางเลือก:**

1. ใช้ **OAuth + GOOGLE_DRIVE_FOLDER_ID** (แนะนำ — ใช้ quota ของ Gmail คุณ)
2. ตั้ง `EXCEL_EXPORT_MODE=local` (ไม่สร้าง Sheet)
3. สร้างโปรเจกต์ GCP ส่วนตัวใหม่ + Service Account key ใหม่

---

### โฟลเดอร์ Drive แต่ยังไม่มี OAuth

```
โฟลเดอร์ Drive เป็น My Drive ส่วนตัว — Service Account สร้างไฟล์ไม่ได้
```

ทำตาม [ขั้นตอนที่ 4 — ตั้งค่า OAuth](#ขั้นตอนที่-4--ตั้งค่า-oauth-สำหรับ-my-drive)

---

### `invalid_client` (OAuth)

- ตรวจ `GOOGLE_OAUTH_CLIENT_ID` และ `GOOGLE_OAUTH_CLIENT_SECRET` ใน `.env` ว่าไม่ใช่ placeholder `xxxx`
- ตรวจว่า Client เป็น type **Web application**

---

### `access_denied` (OAuth)

- แอปอยู่โหมด **Testing** — เพิ่ม Gmail ของคุณใน **OAuth consent screen** → **Test users**
- Login ด้วย Gmail คนเดียวกับที่เป็นเจ้าของโฟลเดอร์ Drive

---

### ดาวน์โหลดได้แต่ไม่มี Sheet ใน Drive

- ตรวจ `EXCEL_EXPORT_MODE` ว่าเป็น `google` ไม่ใช่ `local`
- restart server หลังแก้ `.env`
- ตรวจว่ามี `GOOGLE_OAUTH_REFRESH_TOKEN` ครบถ้วน

---

### `updateSheetProperties: จะตรึงคอลัมน์ที่มีเฉพาะบางส่วนของเซลล์ที่ผสานไม่ได้`

Google Sheets API ไม่รองรับ freeze คอลัมน์ที่ตัดผ่าน merged cells — โค้ดปัจจุบัน freeze **แถว** อย่างเดียว (`frozenColumnCount: 0`) หากยังเจอ error นี้ ให้ `npm run build` แล้ว restart server

---

### Refresh token หมดอายุ / ถูก revoke

1. ไปที่ https://myaccount.google.com/permissions
2. ลบสิทธิ์แอป `POSE Report` (หรือชื่อที่ตั้งไว้)
3. รัน `npm run auth-google` ใหม่

---

## ความปลอดภัย

| รายการ | แนวทาง |
|--------|--------|
| `credentials.json` | อย่า commit, อย่าแชร์ publicly |
| `.env` | อย่า commit — มี OAuth secret และ refresh token |
| OAuth Client Secret | เก็บใน `.env` เท่านั้น |
| Test users | จำกัดเฉพาะ Gmail ที่จำเป็น |
| Production | ต้อง verify OAuth app กับ Google ก่อนเปิดให้คนทั่วไปใช้ |

---

## สรุป flow ที่แนะนำ

```
1. เปิด Sheets API + Drive API ใน GCP
2. สร้าง Service Account → วาง credentials.json
3. สร้างโฟลเดอร์ Drive → ใส่ GOOGLE_DRIVE_FOLDER_ID
4. สร้าง OAuth Client → ใส่ CLIENT_ID / SECRET ใน .env
5. npm start → npm run auth-google → ใส่ REFRESH_TOKEN
6. npm run check-google → ต้องผ่านทุกขั้น
7. เปิด URL รายงาน → ได้ทั้ง .xlsx และ Sheet ใน Drive
```
