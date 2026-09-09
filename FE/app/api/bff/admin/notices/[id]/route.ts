import { proxyAuthed } from '@/lib/server/bffProxy';
import type { IdParams } from '@/lib/server/routeParams';

const path = (id: string) => `/api/admin/notices/${encodeURIComponent(id)}`;

export async function GET(_request: Request, { params }: IdParams) {
  return proxyAuthed(path((await params).id));
}

export async function PUT(request: Request, { params }: IdParams) {
  const { id } = await params;
  return proxyAuthed(path(id), { method: 'PUT', body: await request.text() });
}

export async function DELETE(_request: Request, { params }: IdParams) {
  return proxyAuthed(path((await params).id), { method: 'DELETE' });
}
