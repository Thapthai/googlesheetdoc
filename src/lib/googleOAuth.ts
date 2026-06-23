import { google, drive_v3, sheets_v4 } from "googleapis";

export function hasUserOAuth(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  );
}

export function createOAuth2Client() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI ?? "http://localhost:4100/oauth2callback";

  if (!clientId || !clientSecret) {
    throw new Error(
      "ตั้ง GOOGLE_OAUTH_CLIENT_ID และ GOOGLE_OAUTH_CLIENT_SECRET ใน .env"
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export type GoogleClients = {
  auth: InstanceType<typeof google.auth.OAuth2>;
  sheets: sheets_v4.Sheets;
  drive: drive_v3.Drive;
};

export function getUserGoogleClients(): GoogleClients {
  if (!hasUserOAuth()) {
    throw new Error(
      "ยังไม่มี OAuth — รัน npm run auth-google เพื่อ login Gmail"
    );
  }

  const oauth2 = createOAuth2Client();
  oauth2.setCredentials({
    refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
  });

  return {
    auth: oauth2,
    sheets: google.sheets({ version: "v4", auth: oauth2 }),
    drive: google.drive({ version: "v3", auth: oauth2 }),
  };
}

export function getAuthUrl(): string {
  const oauth2 = createOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file",
    ],
  });
}

export async function exchangeCodeForTokens(code: string) {
  const oauth2 = createOAuth2Client();
  const { tokens } = await oauth2.getToken(code);
  return tokens;
}
