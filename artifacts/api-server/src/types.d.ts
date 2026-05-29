declare module "pdf-parse/lib/pdf-parse.js" {
  function pdfParse(
    dataBuffer: Buffer | Uint8Array,
    options?: Record<string, unknown>
  ): Promise<{ text: string; numpages: number; info: unknown; metadata: unknown; version: string }>;
  export = pdfParse;
}
