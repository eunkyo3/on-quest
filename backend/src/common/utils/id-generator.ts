import { customAlphabet } from 'nanoid';

/**
 * 설계명세서 기준: Quest.id 는 8자리 문자열 식별자.
 * URL-safe 한 대소문자+숫자 조합을 사용한다. (충돌 확률 ~ 1/62^8)
 */
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const nanoid8 = customAlphabet(alphabet, 8);

export function generateQuestId(): string {
  return nanoid8();
}
