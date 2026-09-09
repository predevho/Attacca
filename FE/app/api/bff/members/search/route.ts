import { proxyAuthed } from '@/lib/server/bffProxy';

/** 닉네임으로 회원 찾기(인증 필요). 질의는 BE로 그대로 넘긴다. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q') ?? '';
  return proxyAuthed(`/api/members/search?q=${encodeURIComponent(q)}`);
}
