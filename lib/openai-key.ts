const OPENAI_KEY_COOKIE = 'oumai_openai_api_key';

function cookieValue(request: Request, name: string): string {
  const cookies = request.headers.get('cookie') ?? '';
  for (const item of cookies.split(';')) {
    const [key, ...valueParts] = item.trim().split('=');
    if (key === name) return decodeURIComponent(valueParts.join('='));
  }
  return '';
}

export function browserOpenAiApiKey(request: Request): string {
  return cookieValue(request, OPENAI_KEY_COOKIE).trim();
}

export function openAiKeyCookie(request: Request, apiKey: string): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${OPENAI_KEY_COOKIE}=${encodeURIComponent(apiKey)}; Path=/; HttpOnly; SameSite=Strict${secure}`;
}

export function clearOpenAiKeyCookie(request: Request): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${OPENAI_KEY_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export function validOpenAiApiKey(apiKey: string): boolean {
  return apiKey.startsWith('sk-') && apiKey.length <= 512;
}
