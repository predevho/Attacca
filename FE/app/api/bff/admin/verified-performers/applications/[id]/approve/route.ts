import { proxyAuthed } from '@/lib/server/bffProxy';
import type { IdParams } from '@/lib/server/routeParams';

export async function POST(_request: Request, { params }: IdParams) {
  const { id } = await params;
  return proxyAuthed(`/api/admin/verified-performers/applications/${id}/approve`, { method: 'POST' });
}
