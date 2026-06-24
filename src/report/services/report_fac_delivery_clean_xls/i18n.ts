export interface ReportLanguage {
  topic: string;
  date: string;
  item: string;
  date_laundry: string;
  quantity: string;
  between_date: string;
  to: string;
  month: string;
  print_date: string;
  create_date: string;
  total: string;
  no_image: string;
  regular: string;
  pickup_soiled_general: string;
  factory_delivery_clean: string;
  sheet_summary: string;
  unit_price: string;
  all_pricefac: string;
}

export const TH: ReportLanguage = {
  topic: "รายงาน โรงซักส่งออกผ้าสะอาด ",
  date: "วันที่",
  item: "รายการ",
  date_laundry: "วันที่ลงข้อมูลจากโรงซัก",
  quantity: "จำนวน (ชิ้น)",
  between_date: "ระหว่างวันที่",
  to: "ถึง",
  month: "เดือน",
  print_date: "วันที่พิมพ์รายงาน",
  create_date: "วันที่สร้างเอกสาร",
  total: "รวม",
  no_image: "ไม่มีรูปภาพ",
  regular: "โรงซักส่งออก",
  pickup_soiled_general: "โรงซักรับเข้า",
  factory_delivery_clean: "โรงซักส่งออกผ้าสะอาด",
  sheet_summary: "สรุปรวม",
  unit_price: "ราคาต่อหน่วย",
  all_pricefac: "ราคารวม",
};

export const EN: ReportLanguage = {
  topic: "Factory Delivery Clean Report",
  date: "Date",
  item: "Item",
  date_laundry: "Date of data entry from laundry",
  quantity: "Quantity (pcs)",
  between_date: "Between Date",
  to: "to",
  month: "Month",
  print_date: "Print Date",
  create_date: "Create Date",
  total: "Total",
  no_image: "No Image",
  regular: "Factory delivery",
  pickup_soiled_general: "Factory Pickup",
  factory_delivery_clean: "Factory Delivery ",
  sheet_summary: "Summary",
  unit_price: "Unit Price",
  all_pricefac: "Total Price",
};
