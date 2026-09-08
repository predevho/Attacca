import { cookies } from 'next/headers';
import { verifyState, clearState, hasConsent, clearConsent } from '@/lib/server/oauthState';
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
  const agreed = hasConsent(store);
  // 단일 사용: 어느 경로로 끝나든 삭제한다. 동의 표시가 남아 다음 시도에 재사용되면
  // 동의를 받지 않은 가입이 생길 수 있다.
  clearState(store);
  clearConsent(store);

  if (kakaoError) return redirectTo('/login?error=kakao_cancelled');
  if (!stateOk) return redirectTo('/login?error=state');
  if (!code) return redirectTo('/login?error=oauth');

  const res = await exchangeCode(code, process.env.KAKAO_REDIRECT_URI ?? '', agreed);
  if (!res.ok) {
    // 400-04: 신규 가입인데 동의가 없다. 사용자가 무엇을 해야 하는지 구분해 알린다.
    return redirectTo(res.status === 400 ? '/login?error=consent' : '/login?error=oauth');
  }

  const { accessToken, refreshToken } = res.data as { accessToken: string; refreshToken: string };
  setAuthCookies(store, accessToken, refreshToken);
  return redirectTo('/feed');
}
