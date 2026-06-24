export interface ReportParams {
  typedate: number;
  sdate: string;
  edate: string;
  month: string;
  hotelCode: string;
  itemcode: string;
  lg: "th" | "en";
  showPrice: boolean;
  startDate: string;
  endDate: string;
}

export interface DateInfo {
  date_str: string;
  day_num: string;
}

export interface ItemInfo {
  item_key: string;
  item_code: string;
  item_name: string;
  unit_price: number;
}

export interface DayCell {
  regular: number;
  pickup: number;
  all_pricefac: number;
}

export type ReportData = Record<string, Record<string, DayCell>>;

export interface SheetMerge {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export interface BuiltSheet {
  title: string;
  values: (string | number)[][];
  merges: SheetMerge[];
  headerRange: SheetMerge | null;
  totalRow: number | null;
  dataStartRow: number;
  dataEndRow: number;
  totalCols: number;
  showPrice: boolean;
  totalColIndexPrice: number | null;
  freezeCol: number;
}
