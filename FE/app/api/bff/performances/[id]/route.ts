import { proxyAuthed } from '@/lib/server/bffProxy';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return proxyAuthed(`/api/performances/${id}`);
}

export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.text();
  return proxyAuthed(`/api/performances/${id}`, { method: 'PUT', body });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return proxyAuthed(`/api/performances/${id}`, { method: 'DELETE' });
}
