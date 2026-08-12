import { proxyAuthed } from '@/lib/server/bffProxy';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params;
  const search = new URL(request.url).search; // ?cursor=&size=
  return proxyAuthed(`/api/chat/rooms/${id}/messages` + search);
}
