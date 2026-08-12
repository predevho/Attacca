import { proxyAuthed } from '@/lib/server/bffProxy';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params;
  const search = new URL(request.url).search; // ?page=&size=
  return proxyAuthed(`/api/recruitments/${id}/applications` + search);
}

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.text();
  return proxyAuthed(`/api/recruitments/${id}/applications`, { method: 'POST', body });
}
