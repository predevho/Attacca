import 'server-only';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { authedBeFetch } from '@/lib/server/session';

/**
 * 인증이 필요한 BE 호출을 same-origin BFF 응답으로 감싼다.
 * status가 0(BE 연결 실패)이면 502로 응답한다 — 신규 라우트는 이 헬퍼만 사용한다.
 */
export async function proxyAuthed(path: string, init?: RequestInit): Promise<NextResponse> {
  const res = await authedBeFetch(await cookies(), path, init);
  return NextResponse.json(
    { ok: res.ok, data: res.data, message: res.message },
    { status: res.status || 502 },
  );
}
