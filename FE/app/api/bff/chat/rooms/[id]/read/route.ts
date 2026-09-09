import { proxyAuthed } from '@/lib/server/bffProxy';
import type { IdParams } from '@/lib/server/routeParams';

export async function POST(request: Request, { params }: IdParams) {
  const { id } = await params;
  const body = await request.text();
  return proxyAuthed(`/api/chat/rooms/${id}/read`, { method: 'POST', body });
}
