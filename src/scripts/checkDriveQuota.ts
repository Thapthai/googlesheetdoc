import { google } from "googleapis";

const auth = new google.auth.GoogleAuth({
  keyFile: "credentials.json",
  scopes: ["https://www.googleapis.com/auth/drive"],
});

async function main() {
  const drive = google.drive({ version: "v3", auth });
  const about = await drive.about.get({ fields: "storageQuota,user" });
  console.log("Storage quota:", JSON.stringify(about.data.storageQuota, null, 2));

  let pageToken: string | undefined;
  let count = 0;
  do {
    const r = await drive.files.list({
      pageSize: 100,
      pageToken,
      fields: "nextPageToken,files(id,name,mimeType)",
      q: "trashed=false",
    });
    count += r.data.files?.length ?? 0;
    pageToken = r.data.nextPageToken ?? undefined;
  } while (pageToken);

  console.log("Total files in SA Drive:", count);
}

main().catch(console.error);
