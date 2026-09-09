import { proxyAuthed } from '@/lib/server/bffProxy';
import type { IdParams } from '@/lib/server/routeParams';

/** 방 나가기(soft leave). 본인만 가능하다. */
export async function DELETE(_request: Request, { params }: IdParams) {
  const { id } = await params;
  return proxyAuthed(`/api/chat/rooms/${encodeURIComponent(id)}/participants/me`,
    { method: 'DELETE' });
}
