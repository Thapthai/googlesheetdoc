import { sheets_v4 } from "googleapis";
import { colLetter } from "../../../lib/columnLetters";
import { BuiltSheet, SheetMerge } from "./types";

const HEADER_COLOR = { red: 185 / 255, green: 227 / 255, blue: 230 / 255 };

function mergeToA1(merge: SheetMerge): string {
  const start = `${colLetter(merge.startCol)}${merge.startRow + 1}`;
  const end = `${colLetter(merge.endCol)}${merge.endRow + 1}`;
  return `${start}:${end}`;
}

function rangeA1(
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): string {
  return mergeToA1({ startRow, endRow, startCol, endCol });
}

export class SheetGrid {
  private cells = new Map<string, string | number>();
  maxRow = 0;
  maxCol = 0;

  set(col: number, row: number, value: string | number): void {
    this.cells.set(`${col},${row}`, value);
    this.maxRow = Math.max(this.maxRow, row);
    this.maxCol = Math.max(this.maxCol, col);
  }

  get(col: number, row: number): string | number {
    return this.cells.get(`${col},${row}`) ?? "";
  }

  toValues(): (string | number)[][] {
    const rows: (string | number)[][] = [];
    for (let r = 0; r <= this.maxRow; r++) {
      const row: (string | number)[] = [];
      for (let c = 0; c <= this.maxCol; c++) {
        row.push(this.get(c, r));
      }
      rows.push(row);
    }
    return rows;
  }
}

export function sanitizeSheetTitle(name: string): string {
  return name.replace(/[\\/*?[\]:]/g, "-").slice(0, 31);
}

export function buildFormatRequests(
  sheet: BuiltSheet,
  sheetId: number
): sheets_v4.Schema$Request[] {
  const requests: sheets_v4.Schema$Request[] = [];

  for (const merge of sheet.merges) {
    requests.push({
      mergeCells: {
        range: {
          sheetId,
          startRowIndex: merge.startRow,
          endRowIndex: merge.endRow + 1,
          startColumnIndex: merge.startCol,
          endColumnIndex: merge.endCol + 1,
        },
        mergeType: "MERGE_ALL",
      },
    });
  }

  const borderStyle = {
    style: "SOLID",
    width: 1,
    color: { red: 1 / 255, green: 2 / 255, blue: 3 / 255 },
  };

  if (sheet.dataEndRow >= sheet.dataStartRow) {
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: sheet.dataStartRow,
          endRowIndex: sheet.dataEndRow + 1,
          startColumnIndex: 0,
          endColumnIndex: sheet.totalCols,
        },
        cell: {
          userEnteredFormat: {
            borders: {
              top: borderStyle,
              bottom: borderStyle,
              left: borderStyle,
              right: borderStyle,
            },
            verticalAlignment: "MIDDLE",
          },
        },
        fields:
          "userEnteredFormat(borders,verticalAlignment)",
      },
    });
  }

  if (sheet.headerRange) {
    const hr = sheet.headerRange;
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: hr.startRow,
          endRowIndex: hr.endRow + 1,
          startColumnIndex: hr.startCol,
          endColumnIndex: hr.endCol + 1,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: HEADER_COLOR,
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
            textFormat: { bold: true, fontSize: 8 },
          },
        },
        fields:
          "userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)",
      },
    });
  }

  if (sheet.totalRow !== null) {
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: sheet.totalRow,
          endRowIndex: sheet.totalRow + 1,
          startColumnIndex: 0,
          endColumnIndex: sheet.totalCols,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: HEADER_COLOR,
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
            textFormat: { bold: true, fontSize: 8 },
          },
        },
        fields:
          "userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)",
      },
    });
  }

  requests.push({
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: 3,
        endRowIndex: 6,
        startColumnIndex: 0,
        endColumnIndex: 7,
      },
      cell: {
        userEnteredFormat: {
          textFormat: { fontSize: 16 },
          verticalAlignment: "MIDDLE",
        },
      },
      fields: "userEnteredFormat(textFormat,verticalAlignment)",
    },
  });

  requests.push({
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: 0,
        endRowIndex: 1,
        startColumnIndex: 6,
        endColumnIndex: 7,
      },
      cell: {
        userEnteredFormat: {
          horizontalAlignment: "RIGHT",
          verticalAlignment: "MIDDLE",
        },
      },
      fields: "userEnteredFormat(horizontalAlignment,verticalAlignment)",
    },
  });

  if (sheet.showPrice) {
    const qtyStartCol = 2;
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 8,
          endRowIndex: sheet.dataEndRow + 1,
          startColumnIndex: qtyStartCol,
          endColumnIndex: sheet.totalCols,
        },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: "NUMBER", pattern: "#,##0" },
          },
        },
        fields: "userEnteredFormat.numberFormat",
      },
    });

    if (sheet.dataEndRow > 8) {
      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 8,
            endRowIndex: sheet.dataEndRow,
            startColumnIndex: 1,
            endColumnIndex: 2,
          },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: "NUMBER", pattern: "#,##0.00" },
            },
          },
          fields: "userEnteredFormat.numberFormat",
        },
      });
    }

    if (sheet.totalColIndexPrice !== null) {
      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 8,
            endRowIndex: sheet.dataEndRow + 1,
            startColumnIndex: sheet.totalColIndexPrice,
            endColumnIndex: sheet.totalColIndexPrice + 1,
          },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: "NUMBER", pattern: "#,##0.00" },
            },
          },
          fields: "userEnteredFormat.numberFormat",
        },
      });
    }
  } else {
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 8,
          endRowIndex: sheet.dataEndRow + 1,
          startColumnIndex: 1,
          endColumnIndex: sheet.totalCols,
        },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: "NUMBER", pattern: "#,##0" },
          },
        },
        fields: "userEnteredFormat.numberFormat",
      },
    });
  }

  requests.push({
    updateDimensionProperties: {
      range: {
        sheetId,
        dimension: "COLUMNS",
        startIndex: 0,
        endIndex: 1,
      },
      properties: { pixelSize: 280 },
      fields: "pixelSize",
    },
  });

  if (sheet.totalCols > 1) {
    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: "COLUMNS",
          startIndex: 1,
          endIndex: sheet.totalCols,
        },
        properties: { pixelSize: 84 },
        fields: "pixelSize",
      },
    });
  }

  // Google Sheets ไม่รองรับ freeze คอลัมน์ที่ตัดผ่าน merged cells (เช่น A4:G4)
  // PHP ใช้ freezePane B9/C9 ได้ แต่ API ต้อง freeze แถวอย่างเดียว
  requests.push({
    updateSheetProperties: {
      properties: {
        sheetId,
        gridProperties: {
          frozenRowCount: sheet.dataStartRow,
          frozenColumnCount: 0,
        },
      },
      fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
    },
  });

  return requests;
}

export function gridRangeA1(sheet: BuiltSheet): string {
  return rangeA1(6, 0, sheet.dataEndRow, sheet.totalCols - 1);
}
