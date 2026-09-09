import { proxyAuthed } from '@/lib/server/bffProxy';
import type { IdParams } from '@/lib/server/routeParams';

export async function GET(_request: Request, { params }: IdParams) {
  const { id } = await params;
  return proxyAuthed(`/api/chat/rooms/${id}`);
}
