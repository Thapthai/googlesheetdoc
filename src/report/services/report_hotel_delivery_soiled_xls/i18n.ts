export interface ReportLanguage {
  hotel_delivery_soiled_report: string;
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
  hotel_check_qty: string;
  hotel_delivery_qty: string;
}

export const TH: ReportLanguage = {
  hotel_delivery_soiled_report: "โรงแรมส่งผ้าเปื้อน ",
  topic: "รายงาน โรงแรมส่งผ้าเปื้อน ",
  date: "วันที่",
  item: "รายการ",
  date_laundry: "วันที่ลงข้อมูลจากส่งผ้าเปื้อน",
  quantity: "จำนวน (ชิ้น)",
  between_date: "ระหว่างวันที่",
  to: "ถึง",
  month: "เดือน",
  print_date: "วันที่พิมพ์รายงาน",
  create_date: "วันที่สร้างเอกสาร",
  total: "รวม",
  no_image: "ไม่มีรูปภาพ",
  hotel_check_qty: "จำนวนผ้าตรวจสอบ",
  hotel_delivery_qty: "จำนวนผ้าส่งซัก",
};

export const EN: ReportLanguage = {
  hotel_delivery_soiled_report: "Hotel Delivery Soiled",
  topic: "Hotel Delivery Soiled Report",
  date: "Date",
  item: "Item",
  date_laundry: "Date of data entry from hotel delivery soiled",
  quantity: "Quantity (pcs)",
  between_date: "Between Date",
  to: "to",
  month: "Month",
  print_date: "Print Date",
  create_date: "Create Date",
  total: "Total",
  no_image: "No Image",
  hotel_check_qty: "Hotel Check Qty",
  hotel_delivery_qty: "Hotel Delivery Qty",
};
