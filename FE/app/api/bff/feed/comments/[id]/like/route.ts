import { proxyAuthed } from '@/lib/server/bffProxy';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return proxyAuthed(`/api/feed/comments/${id}/like`, { method: 'POST' });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return proxyAuthed(`/api/feed/comments/${id}/like`, { method: 'DELETE' });
}
