import { proxyAuthed } from '@/lib/server/bffProxy';

type Ctx = { params: Promise<{ aid: string }> };

export async function POST(_request: Request, { params }: Ctx) {
  const { aid } = await params;
  return proxyAuthed(`/api/recruitments/applications/${aid}/reject`, { method: 'POST' });
}
