import mysql, { RowDataPacket } from "mysql2/promise";
import {
  DateInfo,
  ItemInfo,
  ReportData,
  ReportParams,
} from "./types";

interface QueryRow extends RowDataPacket {
  create_date: string;
  item_code: string;
  item_name: string;
  total_qty_hotel_checksoiled: number;
  total_qty_hotel_deliverysoiled: number;
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

function buildQuery(params: ReportParams, nameCol: string): string {
  const { startDate, endDate, hotelCode } = params;
  const hotel = escapeSql(hotelCode);

  return `
    WITH RECURSIVE date_range AS (
      SELECT DATE('${startDate}') AS d
      UNION ALL
      SELECT DATE_ADD(d, INTERVAL 1 DAY)
      FROM date_range
      WHERE d < '${endDate}'
    ),
    hotel_delivery_soiled_summary AS (
      SELECT
        DATE(hds.create_at) AS create_date,
        hdsd.item_code,
        SUM(hdsd.qty_hotel_checksoiled) AS total_qty_hotel_checksoiled,
        SUM(hdsd.qty_hotel_deliverysoiled) AS total_qty_hotel_deliverysoiled
      FROM hotel_deliverysoiled hds
      INNER JOIN hotel_deliverysoiled_detail hdsd
        ON hds.doc_no = hdsd.doc_no
      WHERE hds.hotel_code = '${hotel}'
        AND DATE(hds.create_at) BETWEEN '${startDate}' AND '${endDate}'
        AND hds.is_status = '1'
      GROUP BY DATE(hds.create_at), hdsd.item_code
    )
    SELECT
      DATE_FORMAT(dr.d, '%Y-%m-%d') AS create_date,
      item.item_code,
      COALESCE(NULLIF(item.short_name_th, ''), item.${nameCol}) AS item_name,
      COALESCE(hdss.total_qty_hotel_checksoiled, 0) AS total_qty_hotel_checksoiled,
      COALESCE(hdss.total_qty_hotel_deliverysoiled, 0) AS total_qty_hotel_deliverysoiled
    FROM date_range dr
    CROSS JOIN item
    LEFT JOIN hotel_delivery_soiled_summary hdss
      ON hdss.create_date = dr.d
      AND hdss.item_code = item.item_code
    ORDER BY dr.d ASC,
      item.order IS NULL,
      item.order ASC,
      COALESCE(NULLIF(item.short_name_th, ''), item.${nameCol}) ASC
  `;
}

function parseYmdParts(ymd: string): { day: string; month: string } {
  const parts = String(ymd).slice(0, 10).split("-");
  return {
    day: parts[2] ?? "01",
    month: parts[1] ?? "01",
  };
}

function processRows(rows: QueryRow[]) {
  const datesMap: Record<string, DateInfo> = {};
  const itemsMap: Record<string, ItemInfo> = {};
  const data: ReportData = {};

  for (const row of rows) {
    const createDate = String(row.create_date).slice(0, 10);
    const itemCode = row.item_code;
    const { day, month } = parseYmdParts(createDate);

    if (!datesMap[createDate]) {
      datesMap[createDate] = {
        date_str: createDate,
        day_num: day,
        month_num: month,
      };
    }

    if (!itemsMap[itemCode]) {
      itemsMap[itemCode] = {
        item_code: itemCode,
        item_name: row.item_name,
      };
    }

    if (!data[itemCode]) data[itemCode] = {};
    data[itemCode][createDate] = {
      check: Number(row.total_qty_hotel_checksoiled),
      delivery: Number(row.total_qty_hotel_deliverysoiled),
    };
  }

  return {
    dates: Object.values(datesMap),
    items: Object.values(itemsMap),
    data,
  };
}

function getMockData(params: ReportParams, nameCol: "name_th" | "name_en") {
  const dates: DateInfo[] = [];
  const start = new Date(`${params.startDate}T12:00:00`);
  const end = new Date(`${params.endDate}T12:00:00`);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dates.push({
      date_str: `${y}-${m}-${day}`,
      day_num: day,
      month_num: m,
    });
  }

  const items: ItemInfo[] = [
    {
      item_code: "TWL",
      item_name: nameCol === "name_th" ? "ผ้าเช็ดตัว" : "Towel",
    },
    {
      item_code: "SHT",
      item_name: nameCol === "name_th" ? "ผ้าปูที่นอน" : "Bed Sheet",
    },
    {
      item_code: "PLW",
      item_name: nameCol === "name_th" ? "ปลอกหมอน" : "Pillowcase",
    },
  ];

  const data: ReportData = {};
  for (const item of items) {
    data[item.item_code] = {};
    for (const date of dates) {
      data[item.item_code][date.date_str] = {
        check: Math.floor(Math.random() * 30),
        delivery: Math.floor(Math.random() * 25),
      };
    }
  }

  return { dates, items, data };
}

export async function fetchReportData(
  params: ReportParams,
  nameCol: "name_th" | "name_en"
) {
  const useMock =
    process.env.USE_MOCK_DATA === "1" ||
    !process.env.DATABASE_HOST ||
    !process.env.DATABASE_USER ||
    !process.env.DATABASE_NAME;

  if (useMock) {
    console.log(
      "ใช้ข้อมูลตัวอย่าง (ตั้งค่า DATABASE_* ใน .env และ USE_MOCK_DATA=0 เพื่อเชื่อม MySQL จริง)"
    );
    return getMockData(params, nameCol);
  }

  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD ?? "",
    database: process.env.DATABASE_NAME,
    timezone: "+07:00",
  });

  try {
    const query = buildQuery(params, nameCol);
    const [rows] = await connection.query<QueryRow[]>(query);
    return processRows(rows);
  } finally {
    await connection.end();
  }
}
