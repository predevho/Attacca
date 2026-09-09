import { proxyAuthed } from '@/lib/server/bffProxy';
import type { IdParams } from '@/lib/server/routeParams';

export async function DELETE(_request: Request, { params }: IdParams) {
  const { id } = await params;
  return proxyAuthed(`/api/feed/comments/${id}`, { method: 'DELETE' });
}
