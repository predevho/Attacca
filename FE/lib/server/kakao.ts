import 'server-only';
import { beFetch, type BeResult } from '@/lib/server/beClient';

const KAKAO_AUTHORIZE_URL = 'https://kauth.kakao.com/oauth/authorize';

/** 카카오 authorize URL을 구성한다. client_id/redirect_uri는 서버 env. */
export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.KAKAO_CLIENT_ID ?? '',
    redirect_uri: process.env.KAKAO_REDIRECT_URI ?? '',
    response_type: 'code',
    state,
  });
  return `${KAKAO_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * BE에 인가코드를 넘겨 토큰으로 교환한다. redirectUri는 authorize와 동일해야 한다.
 *
 * `agreed`는 카카오로 보내기 전에 받아 둔 동의다. BE는 **신규 가입일 때만** 이 값을
 * 요구한다 — 이미 있는 회원의 로그인은 막지 않는다.
 */
export function exchangeCode(code: string, redirectUri: string, agreed = false): Promise<BeResult> {
  return beFetch('/api/auth/oauth/kakao', {
    method: 'POST',
    body: JSON.stringify({ code, redirectUri, agreedTerms: agreed, agreedPrivacy: agreed }),
  });
}
