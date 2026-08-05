import { getTHmonth, getTHyear } from "../../../lib/dateTh";
import { ReportLanguage } from "./i18n";
import {
  BuiltSheet,
  DateInfo,
  ItemInfo,
  ReportData,
  SheetMerge,
} from "./types";
import { SheetGrid, sanitizeSheetTitle } from "./sheetFormat";

const TH_SHORT_MONTH: Record<string, string> = {
  January: "มกรา",
  February: "กุมภา",
  March: "มีนา",
  April: "เมษา",
  May: "พฤษภา",
  June: "มิถุนา",
  July: "กรกฎา",
  August: "สิงหา",
  September: "กันยา",
  October: "ตุลา",
  November: "พฤศจิกา",
  December: "ธันวา",
};

function addMerge(merges: SheetMerge[], merge: SheetMerge): void {
  merges.push(merge);
}

export function buildTopic(
  params: {
    typedate: number;
    startDate: string;
    endDate: string;
    lg: "th" | "en";
  },
  language: ReportLanguage
): string {
  const start = new Date(`${params.startDate}T12:00:00`);
  const end = new Date(`${params.endDate}T12:00:00`);
  const startMonthEn = start.toLocaleString("en-US", { month: "long" });
  const endMonthEn = end.toLocaleString("en-US", { month: "long" });
  const startMonth =
    params.lg === "en" ? startMonthEn : getTHmonth(startMonthEn);
  const endMonth = params.lg === "en" ? endMonthEn : getTHmonth(endMonthEn);
  const startYear =
    params.lg === "en"
      ? String(start.getFullYear())
      : getTHyear(start.getFullYear());
  const endYear =
    params.lg === "en"
      ? String(end.getFullYear())
      : getTHyear(end.getFullYear());

  if (params.typedate === 0) {
    return `${language.month} ${startMonth} ${startYear}`;
  }

  if (params.startDate === params.endDate) {
    return `${language.date} ${start.getDate()} ${startMonth} ${startYear}`;
  }

  return `${language.between_date} ${start.getDate()} ${startMonth} ${startYear} ${language.to} ${end.getDate()} ${endMonth} ${endYear}`;
}

export function buildSummarySheet(input: {
  language: ReportLanguage;
  printDate: string;
  topic: string;
  dates: DateInfo[];
  items: ItemInfo[];
  data: ReportData;
}): BuiltSheet {
  const { language, printDate, topic, dates, items, data } = input;
  const grid = new SheetGrid();
  const merges: SheetMerge[] = [];

  const totalCols = 1 + dates.length * 2 + 2;

  grid.set(6, 0, `${language.print_date}: ${printDate}`);
  grid.set(0, 3, language.topic);
  grid.set(0, 4, topic);

  addMerge(merges, { startRow: 3, endRow: 3, startCol: 0, endCol: 6 });
  addMerge(merges, { startRow: 4, endRow: 4, startCol: 0, endCol: 6 });
  if (totalCols > 1) {
    addMerge(merges, {
      startRow: 5,
      endRow: 5,
      startCol: 0,
      endCol: totalCols - 1,
    });
  }

  grid.set(0, 6, language.item);

  let colIndex = 1;
  const dateColumns: Record<string, { check: number; delivery: number }> = {};

  for (const dateInfo of dates) {
    addMerge(merges, {
      startRow: 6,
      endRow: 6,
      startCol: colIndex,
      endCol: colIndex + 1,
    });
    grid.set(colIndex, 6, `${dateInfo.day_num}/${dateInfo.month_num}`);
    grid.set(colIndex, 7, language.hotel_check_qty);
    grid.set(colIndex + 1, 7, language.hotel_delivery_qty);
    dateColumns[dateInfo.date_str] = {
      check: colIndex,
      delivery: colIndex + 1,
    };
    colIndex += 2;
  }

  const totalColIndex = colIndex;
  addMerge(merges, {
    startRow: 6,
    endRow: 6,
    startCol: totalColIndex,
    endCol: totalColIndex + 1,
  });
  grid.set(totalColIndex, 6, language.total);
  grid.set(totalColIndex, 7, language.hotel_check_qty);
  grid.set(totalColIndex + 1, 7, language.hotel_delivery_qty);
  addMerge(merges, { startRow: 6, endRow: 7, startCol: 0, endCol: 0 });

  let currentRow = 8;

  for (const item of items) {
    grid.set(0, currentRow, item.item_name);
    let rowTotalCheck = 0;
    let rowTotalDelivery = 0;

    for (const dateInfo of dates) {
      const dateStr = dateInfo.date_str;
      const cell = data[item.item_code]?.[dateStr];
      const qtyCheck = cell?.check ?? 0;
      const qtyDelivery = cell?.delivery ?? 0;
      grid.set(dateColumns[dateStr].check, currentRow, qtyCheck);
      grid.set(dateColumns[dateStr].delivery, currentRow, qtyDelivery);
      rowTotalCheck += qtyCheck;
      rowTotalDelivery += qtyDelivery;
    }

    grid.set(totalColIndex, currentRow, rowTotalCheck);
    grid.set(totalColIndex + 1, currentRow, rowTotalDelivery);
    currentRow++;
  }

  grid.set(0, currentRow, language.total);
  let grandTotalCheck = 0;
  let grandTotalDelivery = 0;

  for (const dateInfo of dates) {
    const dateStr = dateInfo.date_str;
    let columnTotalCheck = 0;
    let columnTotalDelivery = 0;
    for (const item of items) {
      const cell = data[item.item_code]?.[dateStr];
      columnTotalCheck += cell?.check ?? 0;
      columnTotalDelivery += cell?.delivery ?? 0;
    }
    grid.set(dateColumns[dateStr].check, currentRow, columnTotalCheck);
    grid.set(dateColumns[dateStr].delivery, currentRow, columnTotalDelivery);
    grandTotalCheck += columnTotalCheck;
    grandTotalDelivery += columnTotalDelivery;
  }

  grid.set(totalColIndex, currentRow, grandTotalCheck);
  grid.set(totalColIndex + 1, currentRow, grandTotalDelivery);

  return {
    title: sanitizeSheetTitle(language.hotel_delivery_soiled_report),
    layout: "summary",
    values: grid.toValues(),
    merges,
    headerRange: {
      startRow: 6,
      endRow: 7,
      startCol: 0,
      endCol: totalCols - 1,
    },
    totalRow: currentRow,
    dataStartRow: 8,
    dataEndRow: currentRow,
    totalCols,
    freezeRowCount: 8,
  };
}

export function buildDailySheet(input: {
  language: ReportLanguage;
  dateInfo: DateInfo;
  items: ItemInfo[];
  data: ReportData;
  lg: "th" | "en";
}): BuiltSheet {
  const { language, dateInfo, items, data, lg } = input;
  const grid = new SheetGrid();
  const merges: SheetMerge[] = [];
  const dateStr = dateInfo.date_str;
  const d = new Date(`${dateStr}T12:00:00`);
  const day = Number(dateInfo.day_num);
  const monthEn = d.toLocaleString("en-US", { month: "long" });

  let topicDateStr: string;
  if (lg === "en") {
    topicDateStr = `${language.date} ${day} ${language.month} ${monthEn} ${d.getFullYear()}`;
  } else {
    topicDateStr = `${language.date} ${day} ${language.month} ${getTHmonth(monthEn)} ${getTHyear(d.getFullYear())}`;
  }

  grid.set(1, 0, language.topic);
  grid.set(1, 1, topicDateStr);
  addMerge(merges, { startRow: 0, endRow: 0, startCol: 1, endCol: 2 });
  addMerge(merges, { startRow: 1, endRow: 1, startCol: 1, endCol: 2 });

  grid.set(0, 3, language.item);
  grid.set(1, 3, `${dateInfo.day_num}/${dateInfo.month_num}`);
  addMerge(merges, { startRow: 3, endRow: 3, startCol: 1, endCol: 2 });
  grid.set(1, 4, language.hotel_check_qty);
  grid.set(2, 4, language.hotel_delivery_qty);
  addMerge(merges, { startRow: 3, endRow: 4, startCol: 0, endCol: 0 });

  let r = 5;
  let sumCheck = 0;
  let sumDelivery = 0;

  for (const item of items) {
    const cell = data[item.item_code]?.[dateStr];
    const qtyCheck = cell?.check ?? 0;
    const qtyDelivery = cell?.delivery ?? 0;
    grid.set(0, r, item.item_name);
    grid.set(1, r, qtyCheck);
    grid.set(2, r, qtyDelivery);
    sumCheck += qtyCheck;
    sumDelivery += qtyDelivery;
    r++;
  }

  grid.set(0, r, language.total);
  grid.set(1, r, sumCheck);
  grid.set(2, r, sumDelivery);

  let sheetTitle: string;
  if (lg === "en") {
    sheetTitle = d.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
    });
  } else {
    const shortMonth = TH_SHORT_MONTH[monthEn] ?? getTHmonth(monthEn);
    sheetTitle = `${day} ${shortMonth}`;
  }

  return {
    title: sanitizeSheetTitle(sheetTitle),
    layout: "daily",
    values: grid.toValues(),
    merges,
    headerRange: { startRow: 3, endRow: 4, startCol: 0, endCol: 2 },
    totalRow: r,
    dataStartRow: 5,
    dataEndRow: r,
    totalCols: 3,
    freezeRowCount: 0,
  };
}

export function buildOutputFileName(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const h = String(now.getHours()).padStart(2, "0");
  const i = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `Report_hotel_delivery_soiled_xls_${date}_${h}_${i}_${s}.xlsx`;
}
