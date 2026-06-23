import "dotenv/config";
import express, { Request, Response } from "express";
import { formatGoogleApiError } from "./lib/googleApiError";
import { exchangeCodeForTokens } from "./lib/googleOAuth";
import { reportServices } from "./reports/registerReports";
import { QueryParams } from "./reports/types";

const app = express();
const PORT = Number(process.env.PORT ?? 4100);

function queryToRecord(query: Request["query"]): QueryParams {
  const result: QueryParams = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" || Array.isArray(value)) {
      result[key] = value as string | string[];
    } else {
      result[key] = String(value);
    }
  }
  return result;
}

app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "Google Sheet Excel Report Server",
    reports: Object.fromEntries(
      reportServices.map((s) => [s.id, `GET ${s.exampleUrl}`])
    ),
  });
});

app.get("/oauth2callback", async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  if (!code) {
    res.status(400).send("ไม่พบ code — ลอง npm run auth-google");
    return;
  }
  try {
    const tokens = await exchangeCodeForTokens(code);
    res.send(
      `<h2>OAuth สำเร็จ</h2>` +
        `<p>เพิ่มใน .env:</p>` +
        `<pre>GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token ?? "(ไม่มี — ลอง auth ใหม่)"}</pre>` +
        `<p>แล้ว restart server</p>`
    );
  } catch (error: unknown) {
    res.status(500).send(String(error));
  }
});

for (const report of reportServices) {
  app.get(report.route, async (req: Request, res: Response) => {
    try {
      const params = report.parseParamsFromQuery(queryToRecord(req.query));
      const result = await report.generate(params);

      if (result.spreadsheetUrl.startsWith("http")) {
        res.setHeader("X-Spreadsheet-Url", result.spreadsheetUrl);
      }

      res.download(result.outputPath, result.fileName, (err) => {
        if (err && !res.headersSent) {
          res.status(500).json({
            error: "ไม่สามารถส่งไฟล์ได้",
            detail: String(err),
          });
        }
      });
    } catch (error: unknown) {
      const message = formatGoogleApiError(error);
      res.status(500).json({ error: message });
    }
  });
}

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  for (const report of reportServices) {
    console.log(`  ${report.route}`);
  }
});
