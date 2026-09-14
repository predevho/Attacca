import { proxyPublic } from '@/lib/server/bffProxy';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; return proxyPublic(`/api/public/notices/${id}`);
}
