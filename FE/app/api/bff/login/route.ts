import { cookies } from 'next/headers';
import { beFetch } from '@/lib/server/beClient';
import { setAuthCookies } from '@/lib/server/cookies';
import { bffResultJson } from '@/lib/server/bffProxy';

export async function POST(request: Request) {
  const body = await request.text();
  const res = await beFetch('/api/auth/login', { method: 'POST', body });

  if (res.ok) {
    const { accessToken, refreshSession } = res.data as { accessToken: string; refreshSession: string };
    setAuthCookies(await cookies(), accessToken, refreshSession);
  }
  return bffResultJson(res);
}
