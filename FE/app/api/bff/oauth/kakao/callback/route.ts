import { cookies } from 'next/headers';
import { verifyState, clearState, readNext, clearNext } from '@/lib/server/oauthState';
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
  const next = url.searchParams.get('next') ?? readNext(store);
  // state와 원래 목적지는 어느 경로로 끝나든 한 번만 쓴다.
  clearState(store);
  clearNext(store);

  if (kakaoError) return redirectTo('/login?error=kakao_cancelled');
  if (!stateOk) return redirectTo('/login?error=state');
  if (!code) return redirectTo('/login?error=oauth');

  const res = await exchangeCode(code, process.env.KAKAO_REDIRECT_URI ?? '');
  if (!res.ok) {
    return redirectTo('/login?error=oauth');
  }

  const { accessToken, refreshToken, isNewMember } = res.data as {
    accessToken: string; refreshToken: string; isNewMember?: boolean;
  };
  setAuthCookies(store, accessToken, refreshToken);
  const destination = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  if (isNewMember) return redirectTo(`/signup/nickname?next=${encodeURIComponent(destination)}`);
  return redirectTo(destination);
}
