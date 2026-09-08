import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { issueState, issueConsent } from '@/lib/server/oauthState';
import { buildAuthorizeUrl } from '@/lib/server/kakao';
import { redirectTo } from '@/lib/server/redirect';

export async function GET(request: Request) {
  if (!process.env.KAKAO_CLIENT_ID) {
    return redirectTo('/login?error=oauth_config');
  }

  // 최초 가입인지는 인가코드를 교환해 봐야 안다. 그래서 동의를 여기서 받아 두고
  // 콜백까지 나른다(DOMAIN-MEMBER-STATUTE §3.4). 화면이 보내지 않았으면 거절한다 —
  // 동의 없이 가입되는 경로를 남기지 않기 위해서다.
  if (new URL(request.url).searchParams.get('consent') !== '1') {
    return redirectTo('/login?error=consent');
  }

  const store = await cookies();
  const state = issueState(store);
  issueConsent(store);
  // 카카오로 나가는 것은 외부 절대 주소라 그대로 둔다.
  return NextResponse.redirect(buildAuthorizeUrl(state));
}
