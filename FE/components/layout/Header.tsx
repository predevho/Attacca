'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getBff, postBff } from '@/lib/api';
import { NAV_ITEMS, isActive, shouldShowHeader } from '@/lib/layout/header';
import type { Me } from '@/lib/feed/types';
import { ThemeControl } from '@/components/theme/ThemeControl';

/** 신원 상태: undefined=아직 모름, null=비로그인, Me=로그인. */
type Identity = Me | null | undefined;

/**
 * 전역 헤더. 루트 레이아웃에 배치하며 회원가입 화면만 렌더를 건너뛴다.
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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // 헤더가 보이는 공개/로그인 화면에서 신원 상태를 확인한다.
    if (!visible) return;
    let cancelled = false;
    // 네트워크 레벨 reject까지 삼킨다. 헤더 때문에 페이지 전체가 죽으면 안 된다.
    getBff<Me>('/api/bff/me/identity')
      .then((res) => { if (!cancelled) setMe(res.ok ? (res.data as Me) : null); })
      .catch(() => { if (!cancelled) setMe(null); });
    return () => { cancelled = true; };
  }, [visible, pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  async function onLogout() {
    await postBff('/api/bff/logout');
    setMenuOpen(false);
    setMe(null);
    router.replace('/login');
    router.refresh();
  }

  if (!visible) return null;

  const navLinks = NAV_ITEMS.map((item) => {
    const active = isActive(pathname, item.href);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={active ? 'page' : undefined}
          onClick={() => setMenuOpen(false)}
          className={active ? 'border-b-2 border-current pb-0.5 font-semibold' : 'opacity-80'}
        >
          {item.label}
        </Link>
      </li>
    );
  });

  const accountLinks = me === null ? (
    <>
      <Link href="/login" onClick={() => setMenuOpen(false)} className="opacity-80">로그인</Link>
      <Link href="/signup" onClick={() => setMenuOpen(false)} className="rounded bg-on-header px-2.5 py-1 font-semibold text-header">
        회원가입
      </Link>
    </>
  ) : me ? (
    <>
      <Link href="/profile" onClick={() => setMenuOpen(false)} className="inline-flex items-center gap-1.5 font-semibold">
        {me.nickname}
        {me.verified && <span className="rounded-full bg-on-header px-1.5 py-0.5 text-xs font-semibold text-header">인증</span>}
      </Link>
      {me.role === 'ADMIN' && (
        <>
          <Link href="/admin/notices" onClick={() => setMenuOpen(false)} className="opacity-80">공지</Link>
          <Link href="/admin/verified-performers" onClick={() => setMenuOpen(false)} className="opacity-80">인증심사</Link>
        </>
      )}
      <button type="button" onClick={onLogout}
        className="text-left opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">로그아웃</button>
    </>
  ) : null;

  return (
    <header className="bg-header text-on-header">
      <nav className="mx-auto max-w-5xl px-4 py-3">
        <div className="flex min-h-8 items-center gap-4">
        <Link href="/" className="text-lg font-bold tracking-tight">Attacca</Link>
        <ul className="hidden items-center gap-4 text-sm md:flex">{navLinks}</ul>

        <div className="ml-auto flex items-center gap-3 text-sm">
          <ThemeControl />
          <div className="hidden items-center gap-3 md:flex">{accountLinks}</div>
          <button
            type="button"
            aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex size-8 items-center justify-center rounded border border-on-header/40 text-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:hidden"
          >
            <span aria-hidden="true">{menuOpen ? '×' : '☰'}</span>
          </button>
        </div>
        </div>

        <div id="mobile-navigation" hidden={!menuOpen} className="mt-3 border-t border-on-header/20 pt-3 md:hidden">
          <ul className="grid gap-3 text-sm">{navLinks}</ul>
          {me !== undefined && <div className="mt-3 flex flex-wrap gap-3 border-t border-on-header/20 pt-3 text-sm">{accountLinks}</div>}
        </div>
      </nav>
    </header>
  );
}
