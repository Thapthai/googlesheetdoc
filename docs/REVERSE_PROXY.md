# Reverse Proxy (Apache / Nginx)

คู่มือตั้ง reverse proxy ให้เข้าถึง Node report server จาก URL ภายนอก

ตัวอย่าง path แนะนำ (แยกตามไซต์ ภายใต้ `/demo-googledoc/`):

```
http://<apache-host>/demo-googledoc/mph/report_fac_delivery_clean_xls
```

โครงสร้างนี้เผื่อมีไซต์อื่นภายหลัง เช่น `/demo-googledoc/gnk/`, `/demo-googledoc/xxx/`  
แต่ละ path ชี้ไป backend คนละตัวหรือคนละ port ได้

Backend ตัวอย่างในคู่มือนี้ (MPH): `http://10.11.9.3:7001`  
(เปลี่ยน IP / port ให้ตรงกับเครื่องที่รันแอป — ค่า `PORT` ใน `.env`)

---

## สิ่งที่ต้องเตรียม


| รายการ                 | ตัวอย่าง                                           |
| ---------------------- | -------------------------------------------------- |
| Node + PM2 รันอยู่แล้ว | [PM2_DEPLOY.md](PM2_DEPLOY.md)                     |
| `PORT` ใน `.env`       | `7001`                                             |
| เปิด port ภายใน        | `10.11.9.3:7001` เข้าถึงได้จาก Apache/Nginx        |
| โมดูล Apache           | `proxy`, `proxy_http` (`a2enmod proxy proxy_http`) |


ทดสอบ backend ตรง ๆ ก่อน:

```
http://10.11.9.3:7001/report_fac_delivery_clean_xls?date=22-06-2026
```

---



## แบบที่แนะนำ — path prefix `/demo-googledoc/mph/`

เป้าหมาย:

```
http://<host>/demo-googledoc/mph/report_fac_delivery_clean_xls?...
        ↓ Apache ตัด prefix ออก
http://10.11.9.3:7001/report_fac_delivery_clean_xls?...
```

**สำคัญ:** ต้องมี `/` ท้ายทั้งฝั่ง path และฝั่ง backend  
ถ้าไม่มี slash ด้านหลัง Apache อาจส่ง path ผิด หรือต่อ URL ผิดรูป

### Apache (`httpd` / `httpd.conf` / vhost)

```apache
ProxyRequests Off
ProxyPreserveHost On
# รายงานสร้าง Google Sheet อาจช้า — หน่วยเป็นวินาที
ProxyTimeout 300

# MPH
ProxyPass        /demo-googledoc/mph/ http://10.11.9.3:7001/
ProxyPassReverse /demo-googledoc/mph/ http://10.11.9.3:7001/

# ตัวอย่างไซต์อื่นในอนาคต (เปลี่ยน IP/port ให้ตรง)
# ProxyPass        /demo-googledoc/gnk/ http://10.11.9.4:7001/
# ProxyPassReverse /demo-googledoc/gnk/ http://10.11.9.4:7001/
```

แบบ `<Location>` (เทียบเท่า):

```apache
<Location "/demo-googledoc/mph/">
    ProxyPreserveHost On
    ProxyPass         "http://10.11.9.3:7001/"
    ProxyPassReverse   "http://10.11.9.3:7001/"
</Location>
```

อย่าใช้แบบนี้ (ไม่มี `/` ท้าย backend — path จะเพี้ยน):

```apache
# ❌ ผิด
ProxyPass /demo-googledoc/mph/ http://10.11.9.3:7001
```

หลังแก้ config — ตรวจแล้ว reload / restart:

```bash
# ตรวจ syntax ก่อนเสมอ
sudo apachectl configtest
# หรือบน Debian/Ubuntu
sudo apache2ctl configtest
```

| Distro | reload (แนะนำ) | restart |
|--------|----------------|---------|
| RHEL / CentOS / Alma / Rocky | `sudo systemctl reload httpd` | `sudo systemctl restart httpd` |
| Debian / Ubuntu | `sudo systemctl reload apache2` | `sudo systemctl restart apache2` |

```bash
# ตัวอย่าง RHEL/CentOS
sudo apachectl configtest
sudo systemctl reload httpd

# ตัวอย่าง Debian/Ubuntu
sudo apache2ctl configtest
sudo systemctl reload apache2
```

- **reload** — โหลด config ใหม่ โดยพยายามไม่ตัด connection ที่เปิดอยู่ (พอหลังแก้ ProxyPass)
- **restart** — หยุดแล้วเปิด Apache ใหม่ ใช้เมื่อ reload ไม่พอ หรือ service ค้าง



### Nginx

```nginx
# MPH
location /demo-googledoc/mph/ {
    proxy_pass http://10.11.9.3:7001/;   # ต้องมี / ท้าย
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;
    proxy_connect_timeout 60s;
}

# ตัวอย่างไซต์อื่นในอนาคต
# location /demo-googledoc/gnk/ {
#     proxy_pass http://10.11.9.4:7001/;
#     ...
# }
```

---



## URL ที่เรียกใช้


| หน้าที่        | URL ผ่าน proxy                                                                      |
| -------------- | ----------------------------------------------------------------------------------- |
| รายงาน         | `http://<host>/demo-googledoc/mph/report_fac_delivery_clean_xls?date=22-06-2026`    |
| Hotel soiled   | `http://<host>/demo-googledoc/mph/report_hotel_delivery_soiled_xls?date=22-06-2026` |
| หน้าแรก API    | `http://<host>/demo-googledoc/mph/`                                                 |
| OAuth callback | `http://<host>/demo-googledoc/mph/oauth2callback`                                   |


ตัวอย่าง query เดิมยังใช้ได้เหมือนตอนเรียกตรง:

```
/demo-googledoc/mph/report_fac_delivery_clean_xls?typedate=2&sdate=01-06-2026&edate=22-06-2026
/demo-googledoc/mph/report_fac_delivery_clean_xls?typedate=0&month=06-2026&price=1&lg=en
/demo-googledoc/mph/report_hotel_delivery_soiled_xls?typedate=0&month=06-2026&hotel_code=GNK
```

---



## แบบ root path (ไม่มี prefix)

ถ้า map ทั้งโดเมนไปที่ Node (เช่น `http://report.example.com/...`):

### Apache

```apache
ProxyRequests Off
ProxyPreserveHost On
ProxyTimeout 300

ProxyPass        / http://10.11.9.3:7001/
ProxyPassReverse / http://10.11.9.3:7001/
```



### Nginx

```nginx
server {
    listen 80;
    server_name report.example.com;

    location / {
        proxy_pass http://10.11.9.3:7001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
```

แบบนี้ลิงก์ดาวน์โหลด `/reports/...` ทำงานครบโดยไม่ต้องตั้งค่าเพิ่ม

---



## ลิงก์ดาวน์โหลด Excel หลังสร้างรายงาน

แอปสร้างลิงก์ดาวน์โหลดเป็น path แบบ absolute จาก root:

```
/reports/<ชื่อไฟล์>.xlsx
```


| วิธี proxy                          | ผลกับปุ่มดาวน์โหลด                                                       |
| ----------------------------------- | ------------------------------------------------------------------------ |
| **Root** (`/`)                      | ใช้ได้ปกติ                                                               |
| **Prefix** (`/demo-googledoc/mph/`) | ปุ่มดาวน์โหลดชี้ไป `/reports/...` ที่ **นอก** prefix → อาจ 404 บน Apache |


ทางเลือกเมื่อใช้ prefix:

1. **เพิ่ม proxy เฉพาะโฟลเดอร์ reports** (แก้เร็ว ไม่แก้โค้ด):

```apache
ProxyPass        /reports/ http://10.11.9.3:7001/reports/
ProxyPassReverse /reports/ http://10.11.9.3:7001/reports/
```

```nginx
location /reports/ {
    proxy_pass http://10.11.9.3:7001/reports/;
    proxy_read_timeout 300s;
}
```

1. เรียกดาวน์โหลดผ่าน prefix ด้วยมือ (ถ้ามีไฟล์แล้ว):

```
http://<host>/demo-googledoc/mph/reports/<ชื่อไฟล์>.xlsx
```

1. ใช้ปุ่ม **เปิด Google Sheet** เป็นหลัก (ไม่พึ่ง `/reports/`)

---



## OAuth ผ่าน reverse proxy

ถ้าทำ OAuth จาก URL ภายนอก (ไม่ใช่ `localhost`):

1. ตั้งใน `.env`:

```env
GOOGLE_OAUTH_REDIRECT_URI=http://<host>/demo-googledoc/mph/oauth2callback
```

(ใช้ `https://` ถ้ามี TLS)

1. เพิ่ม URI เดียวกันใน Google Cloud Console → OAuth client → **Authorized redirect URIs**
2. รัน `npm run auth-google` ใหม่ แล้วอัปเดต `GOOGLE_OAUTH_REFRESH_TOKEN`
3. `npx pm2 restart google-sheet-report --update-env`

รายละเอียด OAuth: [GOOGLE_SETUP.md](GOOGLE_SETUP.md)

---



## Checklist

- [ ] Backend ตอบที่ `http://10.11.9.3:7001/` โดยตรง
- [ ] `ProxyPass` / `proxy_pass` มี `/` ท้ายครบทั้งสองฝั่งเมื่อใช้ prefix
- [ ] `ProxyTimeout` / `proxy_read_timeout` ≥ 300 วินาที
- [ ] เปิด URL ผ่าน proxy แล้วได้รายงาน
- [ ] (ถ้าใช้ prefix) มี proxy สำหรับ `/reports/` หรือยอมรับว่าดาวน์โหลด xlsx จากหน้า success อาจพัง
- [ ] (ถ้า OAuth ผ่าน proxy) redirect URI ใน `.env` และ GCP ตรงกับ URL ภายนอก

---



## แก้ปัญหา



### 404 บน Apache แต่ตรง backend ได้

- ตรวจว่า path เป็น `/demo-googledoc/mph/...` (มี slash หลังชื่อ prefix)
- ตรวจ `ProxyPass` มี `/` ท้าย backend
- reload Apache หลังแก้ config



### 502 Bad Gateway

- Node/PM2 ไม่รัน หรือ port ไม่ใช่ `7001`
- Firewall บล็อกจากเครื่อง Apache → `10.11.9.3:7001`
- ดู `npm run pm2:logs`



### 504 / timeout

เพิ่ม `ProxyTimeout 300` (Apache) หรือ `proxy_read_timeout 300s` (Nginx)

### หน้า success แต่กดดาวน์โหลด 404

ใช้ prefix แล้วลิงก์ไป `/reports/` นอก Location — เพิ่ม `ProxyPass /reports/` ตามด้านบน

### `invalid_grant` หลังย้ายไป proxy

Refresh token / redirect URI ยังชี้ `localhost` — ตั้ง OAuth ใหม่ตามหัวข้อ OAuth