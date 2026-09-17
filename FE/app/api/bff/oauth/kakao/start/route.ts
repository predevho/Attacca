import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { issueState, issueNext } from '@/lib/server/oauthState';
import { buildAuthorizeUrl } from '@/lib/server/kakao';
import { redirectTo } from '@/lib/server/redirect';

export async function GET(request: Request) {
  if (!process.env.KAKAO_CLIENT_ID) {
    return redirectTo('/login?error=oauth_config');
  }

  const store = await cookies();
  const state = issueState(store);
  issueNext(store, new URL(request.url).searchParams.get('next'));
  // 카카오로 나가는 것은 외부 절대 주소라 그대로 둔다.
  return NextResponse.redirect(buildAuthorizeUrl(state));
}
