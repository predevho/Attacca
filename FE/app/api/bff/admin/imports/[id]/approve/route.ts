import { proxyAuthed } from '@/lib/server/bffProxy';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyAuthed(`/api/admin/imports/${id}/approve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: await request.text() });
}
