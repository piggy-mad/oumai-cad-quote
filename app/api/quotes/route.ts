import { env } from 'cloudflare:workers';

export const runtime = 'edge';

type DatabaseEnv = { DB?: D1Database };
type QuotePayload = {
  projectCode?: unknown;
  drawingName?: unknown;
  partCount?: unknown;
  matchedCount?: unknown;
  pretaxTotal?: unknown;
  taxAmount?: unknown;
  grandTotal?: unknown;
  status?: unknown;
  [key: string]: unknown;
};

export async function GET() {
  const database = (env as unknown as DatabaseEnv).DB;
  if (!database) return Response.json({ quotes: [] });
  const result = await database
    .prepare(
      `SELECT id, project_code AS projectCode, drawing_name AS drawingName,
              part_count AS partCount, matched_count AS matchedCount,
              grand_total AS grandTotal, status, created_at AS createdAt
       FROM quote_runs ORDER BY created_at DESC LIMIT 20`,
    )
    .all();
  return Response.json({ quotes: result.results });
}

export async function POST(request: Request) {
  const database = (env as unknown as DatabaseEnv).DB;
  if (!database) {
    return Response.json({ saved: false, message: '报价数据库尚未启用。' }, { status: 503 });
  }
  const body = (await request.json()) as QuotePayload;
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await database
    .prepare(
      `INSERT INTO quote_runs
       (id, project_code, drawing_name, part_count, matched_count, pretax_total,
        tax_amount, grand_total, status, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      String(body.projectCode),
      String(body.drawingName),
      Number(body.partCount),
      Number(body.matchedCount),
      Number(body.pretaxTotal),
      Number(body.taxAmount),
      Number(body.grandTotal),
      String(body.status),
      JSON.stringify(body),
      createdAt,
    )
    .run();
  return Response.json({ saved: true, id, createdAt });
}
