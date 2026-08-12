import { proxyAuthed } from '@/lib/server/bffProxy';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return proxyAuthed(`/api/admin/verified-performers/applications/${id}/approve`, { method: 'POST' });
}
