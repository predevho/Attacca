'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getBff, postBff } from '@/lib/api';
import { NAV_ITEMS, isActive, shouldShowHeader } from '@/lib/layout/header';
import type { Me } from '@/lib/feed/types';

/**
 * 전역 헤더. 루트 레이아웃에 배치하되 인증 화면에서는 스스로 렌더를 건너뛴다.
 * 신원을 못 얻으면(비로그인·조회 실패) 헤더를 그리지 않는다 — 빈 껍데기를 노출하지 않기 위함.
 */
export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const visible = shouldShowHeader(pathname);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    // 인증 화면에서는 신원을 조회하지 않는다. 이전 신원이 남아 있어도
    // 아래에서 visible로 렌더를 막으므로 굳이 상태를 비우지 않는다
    // (effect 안의 동기 setState는 연쇄 렌더를 부른다).
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

  if (!visible || !me) return null;

  return (
    <header className="bg-header text-on-header">
      <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        <Link href="/feed" className="text-lg font-bold tracking-tight">Attaca</Link>

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
        </div>
      </nav>
    </header>
  );
}
