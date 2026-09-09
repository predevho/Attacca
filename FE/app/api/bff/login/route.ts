import { cookies } from 'next/headers';
import { beFetch } from '@/lib/server/beClient';
import { setAuthCookies } from '@/lib/server/cookies';
import { bffResultJson } from '@/lib/server/bffProxy';

export async function POST(request: Request) {
  const body = await request.text();
  const res = await beFetch('/api/auth/login', { method: 'POST', body });

  if (res.ok) {
    const { accessToken, refreshToken } = res.data as { accessToken: string; refreshToken: string };
    setAuthCookies(await cookies(), accessToken, refreshToken);
  }
  return bffResultJson(res);
}
