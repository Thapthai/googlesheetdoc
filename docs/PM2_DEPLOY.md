# คู่มือ Deploy ด้วย PM2

รัน HTTP server รายงาน Excel (`google-sheet-report`) แบบ background process ด้วย [PM2](https://pm2.keymetrics.io/) — auto-restart เมื่อ crash และจัดการ log ได้สะดวก

---

## ความต้องการ

| รายการ | หมายเหตุ |
|--------|----------|
| Node.js 18+ | `node -v` |
| npm | มากับ Node.js |
| PM2 | ติดตั้งในโปรเจกต์แล้ว (`npm install`) หรือ global: `npm install -g pm2` |
| `.env` | คัดลอกจาก `.env.example` |
| `credentials.json` | Service Account key (ดู [GOOGLE_SETUP.md](GOOGLE_SETUP.md)) |

---

## โครงสร้างที่เกี่ยวข้อง

```
googleSheet/
├── ecosystem.config.cjs    # คอนฟิก PM2
├── dist/server.js          # entry point (สร้างจาก npm run build)
├── .env
├── credentials.json
├── logs/                   # PM2 logs (สร้างอัตโนมัติ)
│   ├── pm2-out.log
│   └── pm2-error.log
└── reports/                # ไฟล์ xlsx ที่ export
```

---

## ขั้นตอน Deploy ครั้งแรก

### 1. ติดตั้ง dependencies

```bash
cd /path/to/googleSheet
npm install
```

### 2. ตั้งค่า environment

```bash
# Windows
copy .env.example .env

# Linux / macOS
cp .env.example .env
```

แก้ไข `.env` ตามต้องการ — โดยเฉพาะ:

```env
PORT=4100
EXCEL_EXPORT_MODE=google
GOOGLE_DRIVE_FOLDER_ID=...
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REFRESH_TOKEN=...
```

คู่มือ Google ฉบับเต็ม: [GOOGLE_SETUP.md](GOOGLE_SETUP.md)

### 3. วาง credentials

วาง `credentials.json` ที่ root โปรเจกต์ (หรือตั้ง `GOOGLE_CREDENTIALS_PATH` ใน `.env`)

### 4. สร้างโฟลเดอร์ log (ถ้ายังไม่มี)

```bash
mkdir logs
mkdir reports
```

### 5. Build และตรวจสอบ Google API (แนะนำ)

```bash
npm run check-google
```

### 6. เริ่ม PM2

```bash
npm run pm2:start
```

คำสั่งนี้จะ `npm run build` แล้ว `pm2 start ecosystem.config.cjs`

### 7. ตรวจสอบสถานะ

```bash
npm run pm2:status
```

หรือ

```bash
npx pm2 status
```

ควรเห็น `google-sheet-report` สถานะ **online**

### 8. ทดสอบ

เปิด browser:

```
http://localhost:4100/
http://localhost:4100/report_fac_delivery_clean_xls?date=22-06-2026&lg=th&price=0
```

(เปลี่ยน port ตาม `PORT` ใน `.env`)

---

## คำสั่ง PM2 ที่ใช้บ่อย

| คำสั่ง | หน้าที่ |
|--------|---------|
| `npm run pm2:start` | build + เริ่ม process ครั้งแรก |
| `npm run deploy` | build + restart (อัปเดตโค้ดหลัง pull) |
| `npm run pm2:restart` | build + restart + โหลด `.env` ใหม่ |
| `npm run pm2:stop` | หยุดชั่วคราว |
| `npm run pm2:delete` | ลบออกจาก PM2 |
| `npm run pm2:logs` | ดู log แบบ realtime |
| `npm run pm2:status` | ดูสถานะ process |

ใช้ `npx pm2` แทน `pm2` ได้ถ้าไม่ได้ติดตั้ง global

---

## อัปเดตโค้ดหลัง Deploy แล้ว

```bash
git pull          # หรือ copy ไฟล์ใหม่
npm install       # ถ้ามี dependency เปลี่ยน
npm run deploy    # build + restart
```

ถ้าแก้เฉพาะ `.env` (ไม่แก้โค้ด):

```bash
npx pm2 restart google-sheet-report --update-env
```

---

## ให้ PM2 รันอัตโนมัติเมื่อ reboot เครื่อง

### Linux

```bash
npx pm2 startup
# รันคำสั่งที่ PM2 แสดง (sudo env PATH=...)
npx pm2 save
```

ครั้งถัดไปที่ reboot เครื่อง PM2 จะ restore process `google-sheet-report` ให้เอง

### Windows

ใช้ [pm2-installer](https://github.com/jessety/pm2-installer) หรือ Task Scheduler — PM2 `startup` บน Windows รองรับจำกัดกว่า Linux

### macOS

```bash
npx pm2 startup
npx pm2 save
```

---

## Reverse Proxy (Nginx) — ถ้า deploy บน server จริง

ตัวอย่าง proxy ไป port 4100:

```nginx
server {
    listen 80;
    server_name report.example.com;

    location / {
        proxy_pass http://127.0.0.1:4100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }
}
```

รายงานอาจใช้เวลาสร้าง Google Sheet นาน — ตั้ง `proxy_read_timeout` ให้เพียงพอ (เช่น 300 วินาที)

ถ้าใช้ HTTPS + domain จริง ต้องเพิ่ม redirect URI ใน Google OAuth:

```
https://report.example.com/oauth2callback
```

---

## ไฟล์ `ecosystem.config.cjs`

```js
// สรุปค่าหลัก
name: "google-sheet-report"
script: "dist/server.js"
instances: 1          // ไม่ควร scale หลาย instance — state อยู่ที่ Google/Drive
max_memory_restart: "512M"
logs: logs/pm2-*.log
```

แอปโหลด `.env` ผ่าน `dotenv` ใน `server.ts` อัตโนมัติ — ไม่ต้องใส่ secret ใน ecosystem file

---

## Log

| ไฟล์ | เนื้อหา |
|------|---------|
| `logs/pm2-out.log` | stdout (เช่น "Server running at...") |
| `logs/pm2-error.log` | stderr / error |
| `npm run pm2:logs` | tail แบบ realtime |

ล้าง log เก่า:

```bash
npx pm2 flush google-sheet-report
```

---

## แก้ปัญหา

### PM2 สถานะ `errored` หรือ restart วน

```bash
npm run pm2:logs
```

สาเหตุที่พบบ่อย:

- ไม่มี `dist/server.js` → รัน `npm run build`
- ไม่มี `.env` หรือ `credentials.json`
- port ถูกใช้งานแล้ว → เปลี่ยน `PORT` ใน `.env`

### `npm run deploy` บอกว่า process ไม่พบ

ยังไม่เคย start — รัน `npm run pm2:start` ก่อน

### แก้ `.env` แล้วไม่มีผล

```bash
npx pm2 restart google-sheet-report --update-env
```

(แอปอ่าน `.env` ตอน start — ต้อง restart)

### Google OAuth redirect ไม่ทำงานบน server

- `GOOGLE_OAUTH_REDIRECT_URI` ต้องตรงกับ URL จริง (รวม port / https)
- เพิ่ม URI ใน Google Cloud Console → OAuth Client
- รัน `npm run auth-google` บนเครื่องที่เข้าถึง redirect ได้

### 502 จาก Google API

ดู [GOOGLE_SETUP.md — แก้ปัญหา](GOOGLE_SETUP.md#แก้ปัญหา-troubleshooting) — ระบบมี retry อัตโนมัติแล้ว ลองเรียก URL อีกครั้ง

---

## Checklist ก่อน production

- [ ] `USE_MOCK_DATA=0` และตั้ง `DATABASE_*` ถูกต้อง
- [ ] `EXCEL_EXPORT_MODE=google` (หรือ `local` ถ้าไม่ใช้ Google)
- [ ] OAuth refresh token ยังใช้ได้
- [ ] `npm run check-google` ผ่าน
- [ ] `npm run pm2:start` แล้ว status เป็น online
- [ ] ทดสอบ URL รายงานจาก browser / client จริง
- [ ] ตั้ง firewall เปิดเฉพาะ port ที่จำเป็น
- [ ] ไม่ commit `.env` และ `credentials.json`

---

## สรุปคำสั่ง deploy

```bash
# ครั้งแรก
npm install
copy .env.example .env    # แก้ค่า
# วาง credentials.json
npm run check-google
npm run pm2:start

# อัปเดตครั้งถัดไป
git pull
npm install
npm run deploy
```
