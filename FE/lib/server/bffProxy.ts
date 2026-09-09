import 'server-only';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { beFetch, type BeResult } from '@/lib/server/beClient';
import { authedBeFetch } from '@/lib/server/session';

/**
 * BE 결과를 BFF 응답으로 만든다. **data 는 싣지 않는다.**
 *
 * 로그인·비밀번호 변경 응답의 `data`에는 access/refresh 토큰이 들어 있다. 그대로 내보내면
 * 브라우저 JS가 토큰을 만지게 되어 BFF 3계층 격리(토큰은 httpOnly 쿠키에만)가 무너진다.
 * 쿠키를 직접 손대는 라우트들이 응답을 스스로 만들던 것을 여기로 모으되, 그 성질은 유지한다.
 */
export function bffResultJson(res: BeResult): NextResponse {
  return NextResponse.json({ ok: res.ok, message: res.message }, { status: res.status || 502 });
}

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
