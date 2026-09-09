'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { slideLabel } from '@/lib/home/logic';
import type { Slide } from '@/lib/home/types';

const ADVANCE_MS = 6000;

/**
 * 홈 히어로. 공연·공지·뉴스를 한 장씩 자동으로 넘긴다.
 *
 * <p>구성이 두 가지 이유로 이렇게 되어 있다.
 * <ul>
 *   <li><b>모든 장을 한 줄에 깔고 밀어서</b> 보여준다(translateX). 한 장만 갈아 끼우면
 *       내용이 툭 바뀌어 무엇이 어디로 갔는지 알기 어렵다. 대신 안 보이는 장이 DOM에
 *       남으므로 `aria-hidden`과 `tabIndex={-1}`로 접근성 트리와 탭 순서에서 뺀다.</li>
 *   <li><b>사진이 주인공</b>이다. 사진을 칸에 가두지 않고 전체를 채운 뒤 글자를 그 위에
 *       얹는다. 사진마다 비율이 달라도 배너 높이는 고정이라 목록이 들쭉날쭉하지 않다
 *       (`object-cover`가 잘라 맞춘다).</li>
 * </ul>
 *
 * <p>슬라이드가 한 장뿐이면 타이머를 걸지 않는다(의미 없는 리렌더 방지).
 */
export function HeroCarousel({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  // 사용자가 한 번이라도 직접 넘기면 자동 전환을 끈다. 읽는 중에 화면이 스스로
  // 바뀌면 방해가 되고, 되돌리려면 다시 쫓아가야 한다. 주도권을 넘긴 뒤엔 돌려받지 않는다.
  const [autoPlay, setAutoPlay] = useState(true);
  const count = slides.length;

  useEffect(() => {
    if (count <= 1 || !autoPlay) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), ADVANCE_MS);
    return () => clearInterval(timer);
  }, [count, autoPlay]);

  if (count === 0) return null;
  // 목록이 짧아지면(재조회 등) 인덱스가 범위를 벗어날 수 있다.
  const active = Math.min(index, count - 1);

  function goTo(next: number) {
    setAutoPlay(false);
    setIndex(((next % count) + count) % count);
  }

  return (
    <section aria-label="주요 소식" className="relative">
      <div className="relative h-76 overflow-hidden rounded-lg border border-line bg-surface-muted sm:h-96">
        <div
          className="flex h-full transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${active * 100}%)` }}
        >
          {slides.map((slide, i) => (
            <article
              key={`${slide.kind}-${slide.id}`}
              aria-hidden={i !== active}
              className="relative h-full w-full shrink-0"
            >
              {slide.imageUrl && (
                <>
                  {/* 공개 홈은 외부 저장소 URL을 그대로 쓴다(next/image 도메인 설정 없이). */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={slide.imageUrl} alt="" className="h-full w-full object-cover" />
                  {/* 사진 아래쪽을 어둡게 깔아 글자를 읽게 한다. */}
                  {/*
                    글이 얹히는 아래쪽은 70% 이상으로 덮는다 — 순백 사진 위에서도 6.6:1이라
                    본문 기준(4.5:1)을 넘는다. 위쪽은 투명하게 두어 사진을 가리지 않는다.
                  */}
                  <div className="absolute inset-0 bg-gradient-to-t from-scrim/90 via-scrim/70 to-transparent" />
                </>
              )}
              {/*
                사진이 없으면 어둠막을 씌우지 않는다 — 씌우면 아무것도 없는 검은 덩어리가 되고
                "이미지를 못 불러왔다"처럼 보인다. 대신 글을 세로 가운데에 두어
                글이 주인공인 장으로 읽히게 한다.
              */}
              <div
                className={
                  slide.imageUrl
                    ? 'absolute inset-x-0 bottom-0 flex flex-col items-start gap-2.5 p-6 text-on-scrim sm:p-8'
                    : 'absolute inset-0 flex flex-col items-start justify-center gap-2.5 p-6 text-ink sm:p-8'
                }
              >
                <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-semibold text-on-brand">
                  {slideLabel(slide.kind)}
                </span>
                {/* 좁은 화면에서 제목이 세 줄로 늘어나면 어둠막 위쪽 밝은 영역까지 올라간다. */}
                <h2 className="line-clamp-2 text-2xl font-bold tracking-tight sm:text-3xl">{slide.title}</h2>
                <p className={slide.imageUrl ? 'text-sm opacity-90' : 'text-sm text-ink-muted'}>
                  {slide.caption}
                </p>
                {/*
                  좁은 화면에서는 본문을 접는다. 제목·일시만으로 무엇인지 알 수 있다.
                  숨김(display)과 줄수 제한(line-clamp도 display를 쓴다)을 한 요소에 같이 걸면
                  서로 덮어써서 제한이 풀린다 — 그래서 감싸는 요소와 나눈다.
                */}
                {slide.body && (
                  <div className="hidden sm:block">
                    <p className={slide.imageUrl
                      ? 'line-clamp-2 max-w-xl text-sm opacity-80'
                      : 'line-clamp-2 max-w-xl text-sm text-ink-muted'}>
                      {slide.body}
                    </p>
                  </div>
                )}
                {slide.href && (
                  <Link
                    href={slide.href}
                    tabIndex={i === active ? undefined : -1}
                    className="mt-1 rounded bg-brand px-5 py-2.5 text-sm font-medium text-on-brand transition-opacity hover:opacity-90"
                  >
                    자세히 보기
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>

        {count > 1 && (
          // 오른쪽 위 한 쌍으로 둔다. 세로 가운데에 두면 아래쪽 제목 위로 겹친다.
          <div className="absolute right-3 top-3 flex gap-2">
            <button
              type="button"
              aria-label="이전 소식"
              onClick={() => goTo(active - 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-scrim/55 text-xl text-on-scrim transition-colors hover:bg-scrim/85"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="다음 소식"
              onClick={() => goTo(active + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-scrim/55 text-xl text-on-scrim transition-colors hover:bg-scrim/85"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {count > 1 && (
        <ul className="flex items-center justify-center gap-2 pt-4">
          {slides.map((slide, i) => (
            <li key={`${slide.kind}-${slide.id}`}>
              <button
                type="button"
                aria-label={`${i + 1}번째 소식 보기`}
                aria-current={i === active ? 'true' : undefined}
                onClick={() => goTo(i)}
                className={
                  i === active
                    ? 'block h-1.5 w-6 rounded-full bg-brand transition-all'
                    : 'block h-1.5 w-1.5 rounded-full bg-line transition-all hover:bg-ink-faint'
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
