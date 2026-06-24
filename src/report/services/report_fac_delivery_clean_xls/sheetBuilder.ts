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
  const start = new Date(params.startDate);
  const end = new Date(params.endDate);
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
  showPrice: boolean;
}): BuiltSheet {
  const { language, printDate, topic, dates, items, data, showPrice } = input;
  const grid = new SheetGrid();
  const merges: SheetMerge[] = [];

  const colsPerDate = 2;
  const leadCols = showPrice ? 2 : 1;
  const totalBlockCols = showPrice ? 3 : 2;
  const totalCols = leadCols + dates.length * colsPerDate + totalBlockCols;

  grid.set(6, 0, `${language.print_date}: ${printDate}`);
  grid.set(0, 3, language.topic);
  grid.set(0, 4, topic);

  addMerge(merges, { startRow: 3, endRow: 3, startCol: 0, endCol: 6 });
  addMerge(merges, { startRow: 4, endRow: 4, startCol: 0, endCol: 6 });
  addMerge(merges, { startRow: 5, endRow: 5, startCol: 0, endCol: 6 });

  grid.set(0, 6, language.item);
  if (showPrice) {
    grid.set(1, 6, language.unit_price);
    addMerge(merges, { startRow: 6, endRow: 7, startCol: 1, endCol: 1 });
  }

  let colIndex = showPrice ? 2 : 1;
  const dateColumns: Record<string, { pickup: number; regular: number }> = {};

  for (const dateInfo of dates) {
    const month = String(new Date(dateInfo.date_str).getMonth() + 1).padStart(
      2,
      "0"
    );
    const lastDayCol = colIndex + colsPerDate - 1;

    addMerge(merges, {
      startRow: 6,
      endRow: 6,
      startCol: colIndex,
      endCol: lastDayCol,
    });
    grid.set(colIndex, 6, `${dateInfo.day_num}/${month}`);
    grid.set(colIndex, 7, language.pickup_soiled_general);
    grid.set(colIndex + 1, 7, language.regular);

    dateColumns[dateInfo.date_str] = {
      pickup: colIndex,
      regular: colIndex + 1,
    };
    colIndex += colsPerDate;
  }

  const totalColIndexPickup = colIndex;
  const totalColIndexRegular = colIndex + 1;
  const totalColIndexPrice = showPrice ? colIndex + 2 : null;
  const mergeTotalEnd = showPrice ? totalColIndexPrice! : totalColIndexRegular;

  addMerge(merges, {
    startRow: 6,
    endRow: 6,
    startCol: totalColIndexPickup,
    endCol: mergeTotalEnd,
  });
  grid.set(totalColIndexPickup, 6, language.total);
  grid.set(totalColIndexPickup, 7, language.pickup_soiled_general);
  grid.set(totalColIndexRegular, 7, language.regular);
  if (showPrice && totalColIndexPrice !== null) {
    grid.set(totalColIndexPrice, 7, language.all_pricefac);
  }

  addMerge(merges, { startRow: 6, endRow: 7, startCol: 0, endCol: 0 });

  let currentRow = 8;

  for (const item of items) {
    const itemKey = item.item_key;
    grid.set(0, currentRow, item.item_name);

    let rowTotalRegular = 0;
    let rowTotalPickup = 0;
    let rowTotalPrice = 0;

    for (const dateInfo of dates) {
      const dateStr = dateInfo.date_str;
      const cell = data[itemKey]?.[dateStr];
      const qtyRegular = cell?.regular ?? 0;
      const qtyPickup = cell?.pickup ?? 0;
      const dayPrice = showPrice && cell ? cell.all_pricefac : 0;

      const colRegular = dateColumns[dateStr].regular;
      const colPickup = dateColumns[dateStr].pickup;

      grid.set(colRegular, currentRow, qtyRegular);
      grid.set(colPickup, currentRow, qtyPickup);

      rowTotalRegular += qtyRegular;
      rowTotalPickup += qtyPickup;
      rowTotalPrice += dayPrice;
    }

    if (showPrice) {
      grid.set(1, currentRow, item.unit_price);
    }

    grid.set(totalColIndexPickup, currentRow, rowTotalPickup);
    grid.set(totalColIndexRegular, currentRow, rowTotalRegular);
    if (showPrice && totalColIndexPrice !== null) {
      grid.set(totalColIndexPrice, currentRow, rowTotalPrice);
    }

    currentRow++;
  }

  grid.set(0, currentRow, language.total);

  let grandTotalRegular = 0;
  let grandTotalPickup = 0;
  let grandTotalPrice = 0;

  for (const dateInfo of dates) {
    const dateStr = dateInfo.date_str;
    let columnTotalRegular = 0;
    let columnTotalPickup = 0;
    let columnTotalPrice = 0;

    for (const item of items) {
      const cell = data[item.item_key]?.[dateStr];
      columnTotalRegular += cell?.regular ?? 0;
      columnTotalPickup += cell?.pickup ?? 0;
      if (showPrice) {
        columnTotalPrice += cell?.all_pricefac ?? 0;
      }
    }

    const colRegular = dateColumns[dateStr].regular;
    const colPickup = dateColumns[dateStr].pickup;

    grid.set(colRegular, currentRow, columnTotalRegular);
    grid.set(colPickup, currentRow, columnTotalPickup);

    grandTotalRegular += columnTotalRegular;
    grandTotalPickup += columnTotalPickup;
    grandTotalPrice += columnTotalPrice;
  }

  grid.set(totalColIndexPickup, currentRow, grandTotalPickup);
  grid.set(totalColIndexRegular, currentRow, grandTotalRegular);
  if (showPrice && totalColIndexPrice !== null) {
    grid.set(totalColIndexPrice, currentRow, grandTotalPrice);
  }

  return {
    title: sanitizeSheetTitle(language.sheet_summary),
    values: grid.toValues(),
    merges,
    headerRange: { startRow: 6, endRow: 7, startCol: 0, endCol: totalCols - 1 },
    totalRow: currentRow,
    dataStartRow: 8,
    dataEndRow: currentRow,
    totalCols,
    showPrice,
    totalColIndexPrice,
    freezeCol: showPrice ? 2 : 1,
  };
}

export function buildDailySheet(input: {
  language: ReportLanguage;
  printDate: string;
  topic: string;
  dateInfo: DateInfo;
  items: ItemInfo[];
  data: ReportData;
  showPrice: boolean;
  lg: "th" | "en";
}): BuiltSheet {
  const { language, printDate, topic, dateInfo, items, data, showPrice, lg } =
    input;
  const grid = new SheetGrid();
  const merges: SheetMerge[] = [];
  const dateStr = dateInfo.date_str;
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const dayHeader = `${dateInfo.day_num}/${month}`;

  let dayLine: string;
  if (lg === "en") {
    dayLine = `${language.date} ${d.getDate()} ${d.toLocaleString("en-US", { month: "long" })} ${d.getFullYear()}`;
  } else {
    dayLine = `${language.date} ${d.getDate()} ${getTHmonth(d.toLocaleString("en-US", { month: "long" }))} ${getTHyear(d.getFullYear())}`;
  }

  const totalCols = showPrice ? 5 : 3;
  const dLastCol = showPrice ? 4 : 2;

  grid.set(6, 0, `${language.print_date}: ${printDate}`);
  grid.set(0, 3, language.topic);
  grid.set(0, 4, dayLine);

  addMerge(merges, { startRow: 3, endRow: 3, startCol: 0, endCol: 6 });
  addMerge(merges, { startRow: 4, endRow: 4, startCol: 0, endCol: 6 });
  addMerge(merges, { startRow: 5, endRow: 5, startCol: 0, endCol: 6 });

  grid.set(0, 6, language.item);
  addMerge(merges, { startRow: 6, endRow: 7, startCol: 0, endCol: 0 });

  if (showPrice) {
    grid.set(1, 6, language.unit_price);
    addMerge(merges, { startRow: 6, endRow: 7, startCol: 1, endCol: 1 });
    addMerge(merges, { startRow: 6, endRow: 6, startCol: 2, endCol: 3 });
    grid.set(2, 6, dayHeader);
    grid.set(2, 7, language.pickup_soiled_general);
    grid.set(3, 7, language.regular);
    grid.set(4, 6, language.all_pricefac);
    addMerge(merges, { startRow: 6, endRow: 7, startCol: 4, endCol: 4 });
  } else {
    addMerge(merges, { startRow: 6, endRow: 6, startCol: 1, endCol: 2 });
    grid.set(1, 6, dayHeader);
    grid.set(1, 7, language.pickup_soiled_general);
    grid.set(2, 7, language.regular);
  }

  let dr = 8;
  for (const item of items) {
    const cell = data[item.item_key]?.[dateStr];
    const qtyRegular = cell?.regular ?? 0;
    const qtyPickup = cell?.pickup ?? 0;
    const dayPrice = showPrice && cell ? cell.all_pricefac : 0;

    grid.set(0, dr, item.item_name);
    if (showPrice) {
      grid.set(1, dr, item.unit_price);
      grid.set(2, dr, qtyPickup);
      grid.set(3, dr, qtyRegular);
      grid.set(4, dr, dayPrice);
    } else {
      grid.set(1, dr, qtyPickup);
      grid.set(2, dr, qtyRegular);
    }
    dr++;
  }

  let sumR = 0;
  let sumP = 0;
  let sumPrice = 0;
  for (const item of items) {
    const cell = data[item.item_key]?.[dateStr];
    sumR += cell?.regular ?? 0;
    sumP += cell?.pickup ?? 0;
    if (showPrice) sumPrice += cell?.all_pricefac ?? 0;
  }

  grid.set(0, dr, language.total);
  if (showPrice) {
    grid.set(2, dr, sumP);
    grid.set(3, dr, sumR);
    grid.set(4, dr, sumPrice);
  } else {
    grid.set(1, dr, sumP);
    grid.set(2, dr, sumR);
  }

  let sheetTitle: string;
  if (lg === "en") {
    sheetTitle = `${d.getDate()} ${d.toLocaleString("en-US", { month: "long" })}`;
  } else {
    sheetTitle = `${d.getDate()} ${getTHmonth(d.toLocaleString("en-US", { month: "long" }))}`;
  }

  return {
    title: sanitizeSheetTitle(sheetTitle),
    values: grid.toValues(),
    merges,
    headerRange: { startRow: 6, endRow: 7, startCol: 0, endCol: dLastCol },
    totalRow: dr,
    dataStartRow: 8,
    dataEndRow: dr,
    totalCols,
    showPrice,
    totalColIndexPrice: showPrice ? 4 : null,
    freezeCol: showPrice ? 2 : 1,
  };
}

export function buildOutputFileName(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const h = String(now.getHours()).padStart(2, "0");
  const i = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `Report_fac_delivery_clean_xls_${date}_${h}_${i}_${s}.xlsx`;
}
