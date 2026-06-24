import { ReportParams } from "./types";

function parseDmyToYmd(dmy: string): string | null {
  const parts = dmy.split("-");
  if (parts.length !== 3) return null;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function parseQuickDate(raw: string): string | null {
  const trimmed = raw.trim();
  const m = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  return `${m[3]}-${mm}-${dd}`;
}

function firstValue(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function buildReportParams(args: Record<string, string>): ReportParams {
  let typedate = Number(args.typedate ?? 0);
  const sdate = args.sdate ?? "";
  const edate = args.edate ?? "";
  const month = args.month ?? "";
  const lg = args.lg === "en" ? "en" : "th";
  const showPrice = args.price === "1" || args.price === "true";

  let startDate: string | null = null;
  let endDate: string | null = null;

  if (args.date) {
    const quick = parseQuickDate(args.date);
    if (quick) {
      startDate = quick;
      endDate = quick;
      typedate = 1;
    }
  }

  if (startDate === null && typedate === 1 && sdate) {
    startDate = parseDmyToYmd(sdate);
    endDate = startDate;
  }

  if (startDate === null && typedate === 2 && sdate && edate) {
    startDate = parseDmyToYmd(sdate);
    endDate = parseDmyToYmd(edate);
  }

  if (startDate === null && typedate === 0 && month) {
    const dateMonth = month.split("-");
    if (dateMonth.length >= 2 && dateMonth[0] && dateMonth[1]) {
      const sYear = dateMonth[1];
      const sMonth = dateMonth[0];
      startDate = `${sYear}-${sMonth}-01`;
      const lastDay = new Date(Number(sYear), Number(sMonth), 0).getDate();
      endDate = `${sYear}-${sMonth}-${String(lastDay).padStart(2, "0")}`;
    }
  }

  if (!startDate || !endDate) {
    const today = new Date().toISOString().slice(0, 10);
    startDate = today;
    endDate = today;
    typedate = 1;
  }

  return {
    typedate,
    sdate,
    edate,
    month,
    hotelCode: args.hotel_code ?? "MPH",
    itemcode: args.itemcode ?? "",
    lg,
    showPrice,
    startDate,
    endDate,
  };
}

export function parseReportParamsFromQuery(
  query: Record<string, string | string[] | undefined>
): ReportParams {
  const args: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    const v = firstValue(value);
    if (v !== undefined) args[key] = v;
  }
  return buildReportParams(args);
}

export function parseReportParams(argv: string[]): ReportParams {
  const args: Record<string, string> = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = "1";
      }
    }
  }
  return buildReportParams(args);
}
