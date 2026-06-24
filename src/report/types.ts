export interface ReportResult {
  fileName: string;
  outputPath: string;
  spreadsheetUrl: string;
}

export type QueryParams = Record<string, string | string[] | undefined>;

export interface ReportService {
  id: string;
  route: string;
  description: string;
  exampleUrl: string;
  parseParamsFromQuery(query: QueryParams): unknown;
  parseParamsFromArgv(argv: string[]): unknown;
  generate(params: unknown): Promise<ReportResult>;
}
