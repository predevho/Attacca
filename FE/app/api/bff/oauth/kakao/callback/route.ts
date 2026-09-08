import { cookies } from 'next/headers';
import { verifyState, clearState } from '@/lib/server/oauthState';
import { exchangeCode } from '@/lib/server/kakao';
import { setAuthCookies } from '@/lib/server/cookies';
import { redirectTo } from '@/lib/server/redirect';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const store = await cookies();

  const kakaoError = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  const urlState = url.searchParams.get('state');

  const stateOk = verifyState(store, urlState);
  clearState(store); // 단일 사용: 어느 경로로 끝나든 삭제

  if (kakaoError) return redirectTo('/login?error=kakao_cancelled');
  if (!stateOk) return redirectTo('/login?error=state');
  if (!code) return redirectTo('/login?error=oauth');

  const res = await exchangeCode(code, process.env.KAKAO_REDIRECT_URI ?? '');
  if (!res.ok) return redirectTo('/login?error=oauth');

  const { accessToken, refreshToken } = res.data as { accessToken: string; refreshToken: string };
  setAuthCookies(store, accessToken, refreshToken);
  return redirectTo('/feed');
}
