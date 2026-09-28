import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { beFetch } from '@/lib/server/beClient';
import { REFRESH_COOKIE, clearAuthCookies } from '@/lib/server/cookies';

/**
 * 로그아웃. 브라우저 쿠키는 항상 지우고, 서버 세션 철회 실패는 호출자에게 알린다.
 */
export async function POST() {
  const store = await cookies();
  const refreshSession = store.get(REFRESH_COOKIE)?.value;
  let backendDiagnostic = 'not-called';
  let revocationFailed = false;

  if (refreshSession) {
    try {
      const result = await beFetch('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshSession }),
      });
      backendDiagnostic = `status-${result.status}`;
      revocationFailed = !result.ok;
    } catch {
      backendDiagnostic = 'network-error';
      revocationFailed = true;
    }
  }

  const diagnosticHeaders = {
    'x-attacca-refresh-session': refreshSession ? 'present' : 'absent',
    'x-attacca-logout-be': backendDiagnostic,
  };

  clearAuthCookies(store);
  if (revocationFailed) {
    return NextResponse.json(
      { ok: false, message: '서버 세션 철회를 확인하지 못했습니다.' },
      { status: 503, headers: diagnosticHeaders },
    );
  }
  return NextResponse.json({ ok: true, message: null }, { headers: diagnosticHeaders });
}
