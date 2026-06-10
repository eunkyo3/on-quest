import {
  createProofShareToken,
  verifyProofShareToken,
} from './proof-share-token';

const SECRET = 'test-secret';
const Q = 'abc12345';

describe('proof-share-token', () => {
  it('정상 토큰은 같은 questId·secret 으로 검증 통과', () => {
    const token = createProofShareToken(Q, SECRET, 3600);
    expect(verifyProofShareToken(token, Q, SECRET)).toBe(true);
  });

  it('다른 questId 면 거부', () => {
    const token = createProofShareToken(Q, SECRET, 3600);
    expect(verifyProofShareToken(token, 'other999', SECRET)).toBe(false);
  });

  it('다른 secret 이면 거부', () => {
    const token = createProofShareToken(Q, SECRET, 3600);
    expect(verifyProofShareToken(token, Q, 'wrong-secret')).toBe(false);
  });

  it('서명이 변조되면 거부', () => {
    const token = createProofShareToken(Q, SECRET, 3600);
    const [body] = token.split('.');
    const tampered = `${body}.deadbeef`;
    expect(verifyProofShareToken(tampered, Q, SECRET)).toBe(false);
  });

  it('본문(payload)이 변조되면 거부', () => {
    const token = createProofShareToken(Q, SECRET, 3600);
    const [, sig] = token.split('.');
    const forgedBody = Buffer.from(
      JSON.stringify({ q: Q, e: Math.floor(Date.now() / 1000) + 9999 }),
    ).toString('base64url');
    expect(verifyProofShareToken(`${forgedBody}.${sig}`, Q, SECRET)).toBe(false);
  });

  it('만료된 토큰은 거부', () => {
    const expired = createProofShareToken(Q, SECRET, -10);
    expect(verifyProofShareToken(expired, Q, SECRET)).toBe(false);
  });

  it('형식이 잘못된 토큰은 거부', () => {
    expect(verifyProofShareToken('no-dot-token', Q, SECRET)).toBe(false);
    expect(verifyProofShareToken('', Q, SECRET)).toBe(false);
  });
});
