import { proxyAuthed } from '@/lib/server/bffProxy';
import type { IdParams } from '@/lib/server/routeParams';

export async function GET(request: Request, { params }: IdParams) {
  const { id } = await params;
  const search = new URL(request.url).search; // ?page=&size=
  return proxyAuthed(`/api/recruitments/${id}/applications` + search);
}

export async function POST(request: Request, { params }: IdParams) {
  const { id } = await params;
  const body = await request.text();
  return proxyAuthed(`/api/recruitments/${id}/applications`, { method: 'POST', body });
}
