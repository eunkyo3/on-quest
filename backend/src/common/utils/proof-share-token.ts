import * as crypto from 'crypto';

interface ProofSharePayload {
  q: string;
  e: number;
}

function signBody(bodyB64: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(bodyB64).digest('hex');
}

export function createProofShareToken(
  questId: string,
  secret: string,
  ttlSeconds: number,
): string {
  const payload: ProofSharePayload = {
    q: questId,
    e: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const bodyB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${bodyB64}.${signBody(bodyB64, secret)}`;
}

export function verifyProofShareToken(
  token: string,
  questId: string,
  secret: string,
): boolean {
  const dot = token.indexOf('.');
  if (dot <= 0) return false;

  const bodyB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = signBody(bodyB64, secret);

  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;

  try {
    const { q, e } = JSON.parse(
      Buffer.from(bodyB64, 'base64url').toString('utf8'),
    ) as ProofSharePayload;
    if (q !== questId) return false;
    if (Math.floor(Date.now() / 1000) > e) return false;
    return true;
  } catch {
    return false;
  }
}
