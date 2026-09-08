'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getBff, postBff } from '@/lib/api';
import { NAV_ITEMS, isActive, shouldShowHeader } from '@/lib/layout/header';
import type { Me } from '@/lib/feed/types';

/** 신원 상태: undefined=아직 모름, null=비로그인, Me=로그인. */
type Identity = Me | null | undefined;

/**
 * 전역 헤더. 루트 레이아웃에 배치하되 인증 화면에서는 스스로 렌더를 건너뛴다.
 *
 * 홈이 공개 랜딩이 되면서 **비로그인 방문자에게도 헤더를 보여준다**(로그인·회원가입 버튼).
 * 이전에는 신원을 못 얻으면 아무것도 그리지 않았는데, 그러면 공개 홈에 헤더가 사라져
 * 방문자가 로그인할 방법이 없다.
 *
 * 신원을 아직 모르는 동안에는 오른쪽만 비워 둔다 — 로그인/로그아웃 상태가 번갈아 번쩍이지 않게.
 */
export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const visible = shouldShowHeader(pathname);
  const [me, setMe] = useState<Identity>(undefined);

  useEffect(() => {
    // 인증 화면에서는 신원을 조회하지 않는다.
    if (!visible) return;
    let cancelled = false;
    // 네트워크 레벨 reject까지 삼킨다. 헤더 때문에 페이지 전체가 죽으면 안 된다.
    getBff<Me>('/api/bff/me/identity')
      .then((res) => { if (!cancelled) setMe(res.ok ? (res.data as Me) : null); })
      .catch(() => { if (!cancelled) setMe(null); });
    return () => { cancelled = true; };
  }, [visible]);

  async function onLogout() {
    await postBff('/api/bff/logout');
    router.push('/login');
  }

  if (!visible) return null;

  return (
    <header className="bg-header text-on-header">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">Attacca</Link>

        <ul className="flex flex-wrap items-center gap-4 text-sm">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={active ? 'border-b-2 border-current pb-0.5 font-semibold' : 'opacity-75'}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
          {me === null && (
            <>
              <Link href="/login" className="opacity-75">로그인</Link>
              <Link
                href="/signup"
                className="rounded bg-on-header px-2.5 py-1 font-semibold text-header"
              >
                회원가입
              </Link>
            </>
          )}
          {me && (
            <>
              <Link href="/profile" className="inline-flex items-center gap-1.5 font-semibold">
                {me.nickname}
                {me.verified && (
                  <span className="rounded-full bg-on-header px-1.5 py-0.5 text-[10px] font-semibold text-header">인증</span>
                )}
              </Link>
              {me.role === 'ADMIN' && (
                <Link href="/admin/verified-performers" className="opacity-75">어드민</Link>
              )}
              <button type="button" onClick={onLogout} className="opacity-75">로그아웃</button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
