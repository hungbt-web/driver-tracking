import { google } from "googleapis";

type SheetRow = Record<string, string | number | boolean | null>;

type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
  [key: string]: unknown;
};

function getGoogleErrorMessage(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const anyErr = err as {
    message?: unknown;
    response?: { data?: unknown };
  };

  const data = anyErr.response?.data as unknown;
  const anyData = data as
    | {
        error?: unknown;
        error_description?: unknown;
        message?: unknown;
      }
    | null;

  const errorMessageFromErrorField = (() => {
    const errorField = anyData?.error;
    if (!errorField || typeof errorField !== "object") return null;
    const msg = (errorField as { message?: unknown }).message;
    return typeof msg === "string" ? msg : null;
  })();

  const apiMessage =
    errorMessageFromErrorField ??
    (typeof anyData?.error_description === "string"
      ? anyData.error_description
      : null) ??
    (typeof anyData?.message === "string" ? anyData.message : null);
  if (typeof apiMessage === "string" && apiMessage.trim()) return apiMessage;

  if (typeof anyErr.message === "string" && anyErr.message.trim()) {
    return anyErr.message;
  }
  return null;
}

function parseServiceAccountEnv(): object | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // Allow storing JSON in env with escaped newlines etc; try a light normalization
    try {
      return JSON.parse(raw.replace(/\\n/g, "\n"));
    } catch {
      return null;
    }
  }
}

async function getSheetsClient() {
  const authJson = parseServiceAccountEnv();
  if (authJson) {
    const credentials = authJson as ServiceAccountCredentials;
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    return google.sheets({ version: "v4", auth });
  }

  // Fallback for public sheets: use API key (no OAuth).
  // Note: This only works if the sheet is shared publicly or accessible via API key.
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing auth: set GOOGLE_SERVICE_ACCOUNT_JSON (recommended) or GOOGLE_SHEETS_API_KEY for public sheets",
    );
  }
  return google.sheets({ version: "v4", auth: apiKey });
}

function coerceValue(v: string): string | number | boolean | null {
  const trimmed = v.trim();
  if (trimmed === "") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  // number (int/float) detection
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    if (!Number.isNaN(n)) return n;
  }
  return v;
}

function valuesToObjects(values: string[][]): SheetRow[] {
  if (!values?.length) return [];
  const headers = values[0].map((h) => h.trim()).filter(Boolean);
  const rows = values.slice(1);
  return rows
    .filter((r) => r.some((c) => (c ?? "").toString().trim() !== ""))
    .map((r) => {
      const obj: SheetRow = {};
      headers.forEach((h, idx) => {
        obj[h] = coerceValue((r[idx] ?? "").toString());
      });
      return obj;
    });
}

export async function readSheetObjects(opts: {
  spreadsheetId: string;
  range: string; // e.g. "Accounts!A1:Z"
}): Promise<SheetRow[]> {
  const sheets = await getSheetsClient();
  let res;
  try {
    res = await sheets.spreadsheets.values.get({
      spreadsheetId: opts.spreadsheetId,
      range: opts.range,
    });
  } catch (err) {
    const msg = getGoogleErrorMessage(err) ?? "Google Sheets API error";
    throw new Error(msg);
  }

  const values = (res.data.values ?? []) as string[][];
  return valuesToObjects(values);
}

