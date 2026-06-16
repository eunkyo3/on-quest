import { stableStringify } from './n8n.service';

/**
 * 핵심 불변식: 백엔드가 서명하는 문자열은
 *  (1) 항상 유효한 JSON 이어야 하고,
 *  (2) n8n 이 본문을 JSON 파싱 후 동일 규칙으로 재직렬화한 값과 바이트 단위로 같아야 한다.
 * → stableStringify(x) === stableStringify(JSON.parse(stableStringify(x)))
 */
describe('stableStringify', () => {
  const cases: unknown[] = [
    { event: 'quest.created', timestamp: '2026-06-16T00:00:00.000Z', data: { id: 'abc', title: '온보딩' } },
    { data: { assigneeName: null, publisherName: null } },
    { data: { a: undefined, b: 1 } }, // undefined 키는 생략돼야 한다
    { list: ['x', undefined, null] }, // 배열 undefined → null
    { emoji: '🎉 환영합니다', nested: { ko: '한글', n: 0 } },
    { z: 1, a: 2, m: { y: 1, b: 2 } }, // 키 정렬
  ];

  it('출력은 항상 유효한 JSON 이다', () => {
    for (const c of cases) {
      expect(() => JSON.parse(stableStringify(c))).not.toThrow();
    }
  });

  it('JSON 왕복(파싱 후 재직렬화) 에 대해 안정적이다', () => {
    for (const c of cases) {
      const once = stableStringify(c);
      const twice = stableStringify(JSON.parse(once));
      expect(twice).toBe(once);
    }
  });

  it('undefined 객체 키를 생략하고 배열 undefined 를 null 로 만든다', () => {
    expect(stableStringify({ a: undefined, b: 1 })).toBe('{"b":1}');
    expect(stableStringify(['x', undefined])).toBe('["x",null]');
  });

  it('객체 키를 정렬한다', () => {
    expect(stableStringify({ z: 1, a: 2 })).toBe('{"a":2,"z":1}');
  });
});
