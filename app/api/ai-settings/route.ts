import { env } from 'cloudflare:workers';
import {
  browserOpenAiApiKey,
  clearOpenAiKeyCookie,
  openAiKeyCookie,
  validOpenAiApiKey,
} from '@/lib/openai-key';

export const runtime = 'edge';

function serverHasKey(): boolean {
  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  return Boolean(runtimeEnv.OPENAI_API_KEY);
}

export async function GET(request: Request) {
  const browserConfigured = Boolean(browserOpenAiApiKey(request));
  return Response.json(
    {
      configured: browserConfigured || serverHasKey(),
      source: browserConfigured ? 'browser' : serverHasKey() ? 'server' : null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request) {
  const body = (await request.json()) as { apiKey?: unknown };
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  if (!validOpenAiApiKey(apiKey)) {
    return Response.json(
      { configured: false, message: 'OpenAI API Key 格式不正确。' },
      { status: 400 },
    );
  }
  return Response.json(
    { configured: true, source: 'browser' },
    {
      headers: {
        'Cache-Control': 'no-store',
        'Set-Cookie': openAiKeyCookie(request, apiKey),
      },
    },
  );
}

export async function DELETE(request: Request) {
  return Response.json(
    { configured: serverHasKey(), source: serverHasKey() ? 'server' : null },
    {
      headers: {
        'Cache-Control': 'no-store',
        'Set-Cookie': clearOpenAiKeyCookie(request),
      },
    },
  );
}
