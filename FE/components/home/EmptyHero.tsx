import Link from 'next/link';

/**
 * 히어로에 태울 것이 하나도 없을 때 대신 놓는 카드.
 *
 * 예전에는 아무것도 없으면 히어로가 통째로 사라져 홈 위쪽이 텅 비었다(2026-09-09).
 * 빈 화면보다는 여기가 무엇을 하는 곳인지 알려 주고 다음 걸음을 주는 편이 낫다.
 */
export function EmptyHero() {
  return (
    <section aria-label="주요 소식" className="rounded-lg border border-line bg-surface p-8 sm:p-11">
      <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">클래식 연주자들의 자리</h2>
      <p className="mt-3 text-ink-muted">
        공연을 알리고, 함께 연주할 사람을 찾고, 이야기를 나누는 곳입니다.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/performances"
          className="rounded bg-brand px-4 py-2 text-sm text-on-brand">공연 둘러보기</Link>
        <Link href="/signup"
          className="rounded border border-line px-4 py-2 text-sm">회원가입</Link>
      </div>
    </section>
  );
}
