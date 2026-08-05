export interface ReportParams {
  typedate: number;
  sdate: string;
  edate: string;
  month: string;
  hotelCode: string;
  itemcode: string;
  lg: "th" | "en";
  startDate: string;
  endDate: string;
}

export interface DateInfo {
  date_str: string;
  day_num: string;
  month_num: string;
}

export interface ItemInfo {
  item_code: string;
  item_name: string;
}

export interface DayCell {
  check: number;
  delivery: number;
}

export type ReportData = Record<string, Record<string, DayCell>>;

export interface SheetMerge {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export type SheetLayout = "summary" | "daily";

export interface BuiltSheet {
  title: string;
  layout: SheetLayout;
  values: (string | number)[][];
  merges: SheetMerge[];
  headerRange: SheetMerge | null;
  totalRow: number | null;
  dataStartRow: number;
  dataEndRow: number;
  totalCols: number;
  freezeRowCount: number;
}
