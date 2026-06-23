const EN_TO_TH_MONTH: Record<string, string> = {
  January: "มกราคม",
  February: "กุมภาพันธ์",
  March: "มีนาคม",
  April: "เมษายน",
  May: "พฤษภาคม",
  June: "มิถุนายน",
  July: "กรกฎาคม",
  August: "สิงหาคม",
  September: "กันยายน",
  October: "ตุลาคม",
  November: "พฤศจิกายน",
  December: "ธันวาคม",
};

export function getTHmonth(monthEn: string): string {
  return EN_TO_TH_MONTH[monthEn] ?? monthEn;
}

export function getTHyear(year: number): string {
  return String(year + 543);
}

export function formatPrintDateTh(): string {
  const now = new Date();
  const day = now.getDate();
  const month = getTHmonth(
    now.toLocaleString("en-US", { month: "long", timeZone: "Asia/Bangkok" })
  );
  const year = getTHyear(
    Number(now.toLocaleString("en-US", { year: "numeric", timeZone: "Asia/Bangkok" }))
  );
  return `${day} ${month}  ${year}`;
}

export function formatPrintDateEn(): string {
  const now = new Date();
  const day = now.getDate();
  const month = now.toLocaleString("en-US", {
    month: "long",
    timeZone: "Asia/Bangkok",
  });
  const year = now.toLocaleString("en-US", {
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
  return `${day} ${month}  ${year}`;
}
