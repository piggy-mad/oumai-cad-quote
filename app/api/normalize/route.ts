import { env } from 'cloudflare:workers';
import { browserOpenAiApiKey, validOpenAiApiKey } from '@/lib/openai-key';

export const runtime = 'edge';

type ResponseContent = { type?: string; text?: string };
type ResponseOutput = { content?: ResponseContent[] };

function outputText(response: unknown): string {
  const payload = response as { output?: ResponseOutput[] };
  return (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === 'output_text')
    .map((item) => item.text ?? '')
    .join('');
}

export async function POST(request: Request) {
  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  const browserApiKey = browserOpenAiApiKey(request);
  const apiKey = browserApiKey || runtimeEnv.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { enabled: false, message: 'AI 服务尚未配置，已使用 CAD 结构规则完成自动提取。' },
      { status: 503 },
    );
  }

  if (!validOpenAiApiKey(apiKey)) {
    return Response.json(
      { enabled: false, message: 'OpenAI API Key 格式不正确。' },
      { status: 400 },
    );
  }

  const input = await request.json();
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: runtimeEnv.OPENAI_MODEL || 'gpt-4o-mini',
      store: false,
      instructions:
        '你是机械设备BOM规范化程序。只根据输入字段做名称、型号和材质的规范化，不添加图纸中不存在的零件、型号、数量或材质。无法确定时保留原值。',
      input: JSON.stringify(input),
      text: {
        format: {
          type: 'json_schema',
          name: 'normalized_cad_bom',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              parts: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    row: { type: 'integer' },
                    name: { type: 'string' },
                    specification: { type: 'string' },
                    material: { type: 'string' },
                    quantity: { type: 'number' },
                  },
                  required: ['row', 'name', 'specification', 'material', 'quantity'],
                },
              },
            },
            required: ['parts'],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    return Response.json(
      { enabled: true, message: 'AI 归一化暂时失败，保留 CAD 原始提取结果。' },
      { status: 502 },
    );
  }
  const data = await response.json();
  const text = outputText(data);
  if (!text) return Response.json({ enabled: true, parts: [] });
  return Response.json({ enabled: true, ...JSON.parse(text) });
}
