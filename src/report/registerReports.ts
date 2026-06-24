import { ReportService } from "./types";
import { facDeliveryCleanReport } from "./services/report_fac_delivery_clean_xls/service";

/** เพิ่มรายงานใหม่ที่นี่ — 1 รายงาน = 1 service */
export const reportServices: ReportService[] = [
  facDeliveryCleanReport,
];

export function findReportByRoute(route: string): ReportService | undefined {
  return reportServices.find((s) => s.route === route);
}
