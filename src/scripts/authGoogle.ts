import "dotenv/config";
import * as readline from "readline";
import { getAuthUrl, exchangeCodeForTokens } from "../lib/googleOAuth";

async function main(): Promise<void> {
  console.log("=== Google OAuth Setup ===\n");
  console.log("1. เปิด URL นี้ใน browser แล้ว login ด้วย Gmail ที่เป็นเจ้าของโฟลเดอร์ Drive:\n");
  console.log(getAuthUrl());
  console.log("\n2. หลังอนุญาต จะ redirect ไป localhost — คัดลอก code จาก URL");
  console.log("   (หรือใช้ http://localhost:4100/oauth2callback?code=... ถ้า server รันอยู่)\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const code = await new Promise<string>((resolve) => {
    rl.question("วาง code ที่นี่: ", (answer) => {
      rl.close();
      const match = answer.match(/[?&]code=([^&]+)/);
      resolve(match ? decodeURIComponent(match[1]) : answer.trim());
    });
  });

  const tokens = await exchangeCodeForTokens(code);

  console.log("\n=== เพิ่มใน .env ===\n");
  if (tokens.refresh_token) {
    console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);
  } else {
    console.log("ไม่ได้ refresh_token — ลอง revoke access แล้วรันใหม่ด้วย prompt=consent");
  }
  console.log("\nแล้ว restart server และรัน npm run check-google");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
