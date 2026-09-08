'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { slideLabel } from '@/lib/home/logic';
import type { Slide } from '@/lib/home/types';

const ADVANCE_MS = 6000;

/**
 * 홈 히어로. 공연·공지·뉴스를 한 장씩 자동으로 넘긴다.
 * 슬라이드가 한 장뿐이면 타이머를 걸지 않는다(의미 없는 리렌더 방지).
 */
export function HeroCarousel({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  const count = slides.length;

  useEffect(() => {
    if (count <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), ADVANCE_MS);
    return () => clearInterval(timer);
  }, [count]);

  // 목록이 짧아지면(재조회 등) 인덱스가 범위를 벗어날 수 있다.
  const current = slides[Math.min(index, count - 1)];
  if (!current) return null;

  function move(delta: number) {
    setIndex((i) => (i + delta + count) % count);
  }

  return (
    <section aria-label="주요 소식" className="relative">
      <article className="grid grid-cols-1 overflow-hidden rounded-lg border border-line bg-surface sm:grid-cols-[1fr_280px]">
        <div className="flex flex-col justify-center gap-4 p-8 sm:p-11">
          <span className="w-fit rounded-full bg-brand px-2.5 py-0.5 text-xs font-semibold text-on-brand">
            {slideLabel(current.kind)}
          </span>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{current.title}</h2>
          <p className="text-ink-muted">{current.caption}</p>
          {current.body && (
            <p className="line-clamp-2 max-w-lg text-sm text-ink-muted">{current.body}</p>
          )}
          {current.href && (
            <Link
              href={current.href}
              className="mt-1 w-fit rounded bg-brand px-5 py-2.5 text-sm font-medium text-on-brand"
            >
              자세히 보기
            </Link>
          )}
        </div>
        <div className="order-first flex h-40 items-center justify-center bg-surface-muted text-xs text-ink-faint sm:order-none sm:h-auto">
          {current.imageUrl ? (
            // 공개 홈은 외부 저장소 URL을 그대로 쓴다(next/image 도메인 설정 없이).
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span>이미지 없음</span>
          )}
        </div>
      </article>

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="이전 소식"
            onClick={() => move(-1)}
            className="absolute left-0 top-1/2 -ml-4 -mt-5 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-ink-muted"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="다음 소식"
            onClick={() => move(1)}
            className="absolute right-0 top-1/2 -mr-4 -mt-5 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-ink-muted"
          >
            ›
          </button>
          <ul className="flex items-center justify-center gap-2 pt-4">
            {slides.map((slide, i) => (
              <li key={slide.kind + slide.id}>
                <button
                  type="button"
                  aria-label={`${i + 1}번째 소식 보기`}
                  aria-current={i === index ? 'true' : undefined}
                  onClick={() => setIndex(i)}
                  className={
                    i === index
                      ? 'block h-1.5 w-6 rounded-full bg-brand'
                      : 'block h-1.5 w-1.5 rounded-full bg-line'
                  }
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
