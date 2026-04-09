import { readSheetObjects } from "@/lib/googleSheets";

export const runtime = "nodejs";

export async function GET() {
  const spreadsheetId =
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID_MISSIONS ??
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    return Response.json(
      {
        error:
          "Missing env GOOGLE_SHEETS_SPREADSHEET_ID_MISSIONS (or fallback GOOGLE_SHEETS_SPREADSHEET_ID)",
      },
      { status: 500 },
    );
  }

  try {
    const range = process.env.GOOGLE_SHEETS_RANGE_MISSIONS ?? "missions!A1:Z";
    const data = await readSheetObjects({ spreadsheetId, range });
    return Response.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

