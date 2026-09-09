import { beFetch } from '@/lib/server/beClient';
import { bffResultJson } from '@/lib/server/bffProxy';

export async function POST(request: Request) {
  const body = await request.text();
  const res = await beFetch('/api/auth/signup', { method: 'POST', body });
  return bffResultJson(res);
}
