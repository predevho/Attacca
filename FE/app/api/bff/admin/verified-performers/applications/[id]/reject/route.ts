import { proxyAuthed } from '@/lib/server/bffProxy';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.text();
  return proxyAuthed(`/api/admin/verified-performers/applications/${id}/reject`, { method: 'POST', body });
}
