import 'server-only';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { beFetch } from '@/lib/server/beClient';
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

/**
 * 인증이 필요 없는 BE 공개 조회를 그대로 전달한다. 쿠키를 읽지도, 붙이지도 않는다 —
 * 비로그인 방문자도 같은 응답을 받아야 하고, 토큰이 있어도 응답이 달라지면 안 되기 때문이다.
 *
 * 읽기 전용으로만 쓴다. BE의 /api/public/** 아래에는 쓰기 엔드포인트가 없다.
 */
export async function proxyPublic(path: string): Promise<NextResponse> {
  const res = await beFetch(path);
  return NextResponse.json(
    { ok: res.ok, data: res.data, message: res.message },
    { status: res.status || 502 },
  );
}
