import { proxyAuthed } from '@/lib/server/bffProxy';
import type { IdParams } from '@/lib/server/routeParams';

export async function GET(request: Request, { params }: IdParams) {
  const { id } = await params;
  const search = new URL(request.url).search; // ?cursor=&size=
  return proxyAuthed(`/api/chat/rooms/${id}/messages` + search);
}
