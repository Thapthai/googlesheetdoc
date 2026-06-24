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
  total_qty_regular_export: number;
  total_pickup_soiled: number;
  unit_price?: number;
  all_pricefac?: number;
}

function buildQuery(params: ReportParams, nameCol: string): string {
  const { startDate, endDate, showPrice } = params;

  if (showPrice) {
    return `
      WITH RECURSIVE date_range AS (
        SELECT DATE('${startDate}') AS d
        UNION ALL
        SELECT DATE_ADD(d, INTERVAL 1 DAY)
        FROM date_range
        WHERE d < '${endDate}'
      ),
      fac_delivery_daily AS (
        SELECT
          DATE(fc.create_at) AS create_date,
          fcd.item_code,
          COALESCE(fcd.unit_price, 0) AS unit_price,
          SUM(COALESCE(fcd.qty_fac_pickupsoiled, 0)) AS total_pickup_soiled,
          SUM(COALESCE(rnd.rnd_non_hrc, 0)) AS total_qty_regular_export,
          SUM(ROUND(COALESCE(fcd.unit_price, 0) * COALESCE(rnd.rnd_non_hrc, 0), 2)) AS all_pricefac
        FROM fac_deliveryclean fc
        INNER JOIN fac_deliveryclean_detail fcd ON fc.doc_no = fcd.doc_no
        LEFT JOIN (
          SELECT row_id,
            COUNT(DISTINCT CASE
              WHEN (remark != 'HRC' OR remark IS NULL) THEN id
            END) AS rnd_non_hrc
          FROM fac_deliveryclean_detail_round
          GROUP BY row_id
        ) rnd ON rnd.row_id = fcd.id
        WHERE DATE(fc.create_at) BETWEEN '${startDate}' AND '${endDate}'
          AND fc.is_status = '1'
        GROUP BY DATE(fc.create_at), fcd.item_code, COALESCE(fcd.unit_price, 0)
      )
      SELECT
        DATE_FORMAT(dr.d, '%Y-%m-%d') AS create_date,
        i.item_code,
        i.${nameCol} AS item_name,
        COALESCE(fd.unit_price, 0) AS unit_price,
        COALESCE(fd.total_qty_regular_export, 0) AS total_qty_regular_export,
        COALESCE(fd.total_pickup_soiled, 0) AS total_pickup_soiled,
        COALESCE(fd.all_pricefac, 0) AS all_pricefac
      FROM date_range dr
      CROSS JOIN item i
      LEFT JOIN fac_delivery_daily fd
        ON fd.create_date = dr.d AND fd.item_code = i.item_code
      ORDER BY dr.d ASC, i.${nameCol} ASC, unit_price ASC`;
  }

  return `
    WITH RECURSIVE date_range AS (
      SELECT DATE('${startDate}') AS d
      UNION ALL
      SELECT DATE_ADD(d, INTERVAL 1 DAY)
      FROM date_range
      WHERE d < '${endDate}'
    ),
    pickup_soiled_sum AS (
      SELECT
        DATE(fc.create_at) AS create_date,
        fcd.item_code,
        SUM(COALESCE(fcd.qty_fac_pickupsoiled, 0)) AS total_pickup_soiled
      FROM fac_deliveryclean fc
      INNER JOIN fac_deliveryclean_detail fcd ON fc.doc_no = fcd.doc_no
      WHERE DATE(fc.create_at) BETWEEN '${startDate}' AND '${endDate}'
        AND fc.is_status = '1'
      GROUP BY DATE(fc.create_at), fcd.item_code
    ),
    regular_export_sum AS (
      SELECT
        DATE(fc.create_at) AS create_date,
        fcd.item_code,
        COUNT(DISTINCT CASE
          WHEN (r.remark != 'HRC' OR r.remark IS NULL)
          THEN r.id
        END) AS total_qty_regular_export
      FROM fac_deliveryclean fc
      INNER JOIN fac_deliveryclean_detail fcd ON fc.doc_no = fcd.doc_no
      LEFT JOIN fac_deliveryclean_detail_round r ON r.row_id = fcd.id
      WHERE DATE(fc.create_at) BETWEEN '${startDate}' AND '${endDate}'
        AND fc.is_status = '1'
      GROUP BY DATE(fc.create_at), fcd.item_code
    )
    SELECT
      DATE_FORMAT(dr.d, '%Y-%m-%d') AS create_date,
      i.item_code,
      i.${nameCol} AS item_name,
      COALESCE(re.total_qty_regular_export, 0) AS total_qty_regular_export,
      COALESCE(ps.total_pickup_soiled, 0) AS total_pickup_soiled
    FROM date_range dr
    CROSS JOIN item i
    LEFT JOIN regular_export_sum re
      ON re.create_date = dr.d AND re.item_code = i.item_code
    LEFT JOIN pickup_soiled_sum ps
      ON ps.create_date = dr.d AND ps.item_code = i.item_code
    ORDER BY dr.d ASC, i.${nameCol} ASC`;
}

function processRows(rows: QueryRow[], showPrice: boolean) {
  const datesMap: Record<string, DateInfo> = {};
  const itemsMap: Record<string, ItemInfo> = {};
  const data: ReportData = {};

  for (const row of rows) {
    const createDate = row.create_date;
    const itemCode = row.item_code;
    const unitPriceVal = showPrice
      ? Math.round(Number(row.unit_price ?? 0) * 100) / 100
      : 0;
    const allPricefacVal = showPrice
      ? Math.round(Number(row.all_pricefac ?? 0) * 100) / 100
      : 0;
    const itemKey = showPrice
      ? `${itemCode}|${unitPriceVal}`
      : itemCode;

    if (!datesMap[createDate]) {
      datesMap[createDate] = {
        date_str: createDate,
        day_num: String(new Date(createDate).getDate()).padStart(2, "0"),
      };
    }

    if (!itemsMap[itemKey]) {
      itemsMap[itemKey] = {
        item_key: itemKey,
        item_code: itemCode,
        item_name: row.item_name,
        unit_price: showPrice ? unitPriceVal : 0,
      };
    }

    if (!data[itemKey]) data[itemKey] = {};
    if (data[itemKey][createDate]) {
      data[itemKey][createDate].regular += Number(row.total_qty_regular_export);
      data[itemKey][createDate].pickup += Number(row.total_pickup_soiled);
      if (showPrice) {
        data[itemKey][createDate].all_pricefac += allPricefacVal;
      }
    } else {
      data[itemKey][createDate] = {
        regular: Number(row.total_qty_regular_export),
        pickup: Number(row.total_pickup_soiled),
        all_pricefac: showPrice ? allPricefacVal : 0,
      };
    }
  }

  let items = Object.values(itemsMap);

  if (showPrice) {
    items = items.filter((item) => {
      const days = data[item.item_key] ?? {};
      let sumP = 0;
      let sumR = 0;
      for (const day of Object.values(days)) {
        sumP += day.pickup;
        sumR += day.regular;
      }
      return !(sumP === 0 && sumR === 0);
    });

    items.sort((a, b) => {
      const byName = a.item_name.localeCompare(b.item_name);
      if (byName !== 0) return byName;
      const byCode = a.item_code.localeCompare(b.item_code);
      if (byCode !== 0) return byCode;
      return Math.round((a.unit_price - b.unit_price) * 100);
    });
  }

  return {
    dates: Object.values(datesMap),
    items,
    data,
  };
}

function getMockData(params: ReportParams, nameCol: "name_th" | "name_en") {
  const dates: DateInfo[] = [];
  const start = new Date(params.startDate);
  const end = new Date(params.endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    dates.push({
      date_str: dateStr,
      day_num: String(d.getDate()).padStart(2, "0"),
    });
  }

  const items: ItemInfo[] = [
    {
      item_key: params.showPrice ? "TWL|15" : "TWL",
      item_code: "TWL",
      item_name: nameCol === "name_th" ? "ผ้าเช็ดตัว" : "Towel",
      unit_price: params.showPrice ? 15 : 0,
    },
    {
      item_key: params.showPrice ? "SHT|25" : "SHT",
      item_code: "SHT",
      item_name: nameCol === "name_th" ? "ผ้าปูที่นอน" : "Bed Sheet",
      unit_price: params.showPrice ? 25 : 0,
    },
  ];

  const data: ReportData = {};
  for (const item of items) {
    data[item.item_key] = {};
    for (const date of dates) {
      const regular = Math.floor(Math.random() * 20);
      const pickup = Math.floor(Math.random() * 25);
      data[item.item_key][date.date_str] = {
        regular,
        pickup,
        all_pricefac: params.showPrice
          ? Math.round(item.unit_price * regular * 100) / 100
          : 0,
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
    return processRows(rows, params.showPrice);
  } finally {
    await connection.end();
  }
}
