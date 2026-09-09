import { proxyAuthed } from '@/lib/server/bffProxy';
import type { IdParams } from '@/lib/server/routeParams';

/** 그룹방 참여자 초대. 그 방의 활성 참여자 누구나 할 수 있다(DOMAIN-CHAT-STATUTE §130). */
export async function POST(request: Request, { params }: IdParams) {
  const { id } = await params;
  return proxyAuthed(`/api/chat/rooms/${encodeURIComponent(id)}/participants`,
    { method: 'POST', body: await request.text() });
}
