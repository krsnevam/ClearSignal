/**
 * Twilio request validation: base64(HMAC-SHA1(authToken, url + sorted(key+value))).
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
export async function twilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
): Promise<string> {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + params[k], url);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function verifyTwilio(
  authToken: string,
  url: string,
  params: Record<string, string>,
  header: string,
): Promise<boolean> {
  const expected = await twilioSignature(authToken, url, params);
  if (expected.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

export function twiml(message?: string): string {
  const body = message
    ? `<Message>${message.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] ?? c)}</Message>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
}
