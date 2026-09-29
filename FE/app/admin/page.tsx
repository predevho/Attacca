'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBff } from '@/lib/api';
import { AdminPageFrame } from '@/components/admin/AdminPageFrame';
import type { Me } from '@/lib/feed/types';

const ADMIN_MENUS = [
  {
    href: '/admin/notices',
    title: '공지 관리',
    description: '공지와 운영 일정을 등록하고 관리합니다.',
  },
  {
    href: '/admin/verified-performers',
    title: '인증 심사',
    description: '인증 연주자 신청을 검토하고 처리합니다.',
  },
] as const;

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getBff<Me>('/api/bff/me/identity')
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          router.push('/login');
          return;
        }
        if ((result.data as Me).role !== 'ADMIN') {
          router.push('/');
          return;
        }
        setAuthorized(true);
      })
      .catch(() => {
        if (!cancelled) router.push('/login');
      });

    return () => { cancelled = true; };
  }, [router]);

  if (!authorized) {
    return (
      <AdminPageFrame title="관리" className="text-sm text-ink-faint">
        권한을 확인하는 중...
      </AdminPageFrame>
    );
  }

  return (
    <AdminPageFrame title="관리" description="운영 업무를 선택하고 처리합니다.">
      <nav aria-label="관리 메뉴" className="mt-6 divide-y divide-line border-b border-line">
        {ADMIN_MENUS.map((menu) => (
          <Link
            key={menu.href}
            href={menu.href}
            aria-label={menu.title}
            className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-1 py-5 transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:px-3"
          >
            <span className="min-w-0">
              <span className="block font-semibold">{menu.title}</span>
              <span className="mt-1 block text-sm text-ink-muted">{menu.description}</span>
            </span>
            <span aria-hidden="true" className="text-ink-faint transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        ))}
      </nav>
    </AdminPageFrame>
  );
}
