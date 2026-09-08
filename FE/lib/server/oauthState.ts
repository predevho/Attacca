import 'server-only';
import type { CookieStore } from '@/lib/server/cookies';

export const STATE_COOKIE = 'oauth_state';
export const CONSENT_COOKIE = 'oauth_consent';
const STATE_MAX_AGE = 600; // 10분

/** CSRF state를 생성해 httpOnly 쿠키에 저장하고 그 값을 반환한다. */
export function issueState(store: CookieStore): string {
  const state = crypto.randomUUID();
  store.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: STATE_MAX_AGE,
  });
  return state;
}

/** 쿠키의 state와 콜백 URL의 state가 정확히 일치하면 true. */
export function verifyState(store: CookieStore, urlState: string | null): boolean {
  const cookie = store.get(STATE_COOKIE)?.value;
  return !!cookie && !!urlState && cookie === urlState;
}

/** state 쿠키를 삭제한다(단일 사용). */
export function clearState(store: CookieStore): void {
  store.delete(STATE_COOKIE);
}

/**
 * 카카오로 보내기 전에 받아 둔 동의를 콜백까지 나른다.
 *
 * 최초 가입인지 여부는 인가코드를 교환해 봐야 알 수 있다. 그래서 동의는 미리 받아 두고,
 * BE가 신규 생성 경로에서만 요구한다(DOMAIN-MEMBER-STATUTE §3.4).
 * state와 수명을 맞춘다 — 동의만 남고 state가 사라지는 상태를 만들지 않는다.
 */
export function issueConsent(store: CookieStore): void {
  store.set(CONSENT_COOKIE, '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: STATE_MAX_AGE,
  });
}

export function hasConsent(store: CookieStore): boolean {
  return store.get(CONSENT_COOKIE)?.value === '1';
}

export function clearConsent(store: CookieStore): void {
  store.delete(CONSENT_COOKIE);
}
