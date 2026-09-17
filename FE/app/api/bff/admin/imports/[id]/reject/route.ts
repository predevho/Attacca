import { proxyAuthed } from '@/lib/server/bffProxy';
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; return proxyAuthed(`/api/admin/imports/${id}/reject`, { method: 'POST' });
}
