import { proxyAuthed } from '@/lib/server/bffProxy';
import type { IdParams } from '@/lib/server/routeParams';

export async function GET(_request: Request, { params }: IdParams) {
  const { id } = await params;
  return proxyAuthed(`/api/feed/posts/${id}`);
}

export async function PUT(request: Request, { params }: IdParams) {
  const { id } = await params;
  const body = await request.text();
  return proxyAuthed(`/api/feed/posts/${id}`, { method: 'PUT', body });
}

export async function DELETE(_request: Request, { params }: IdParams) {
  const { id } = await params;
  return proxyAuthed(`/api/feed/posts/${id}`, { method: 'DELETE' });
}
