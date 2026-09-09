import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 라이트(:root)와 다크(prefers-color-scheme) 블록은 서로 독립된 목록이라
 * 한쪽에만 토큰을 추가해도 빌드가 통과한다. 다크에서 빠뜨린 토큰은 라이트 값을 그대로
 * 쓰게 되는데, 대개는 "다크 값을 깜빡한 것"이라 이름 집합이 어긋나지 않는지 지킨다.
 * 색 값 자체는 검증 대상이 아니다.
 *
 * 예외는 **일부러 테마와 무관한 토큰**뿐이다. 아래 목록에 근거와 함께 적어야 통과한다 —
 * 그래야 "깜빡한 것"과 "일부러 그런 것"이 구분된다.
 */
const THEME_INVARIANT: Record<string, string> = {
  // 사진 위에 얹는 어둠막과 그 위 글자. 뒤에 있는 것이 페이지 배경이 아니라 사진이라
  // 라이트/다크가 같은 처리를 해야 한다.
  '--scrim': '히어로 사진 위 어둠막',
  '--on-scrim': '히어로 사진 위 글자',
};
const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');

function tokenNamesIn(block: string): string[] {
  return [...block.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]).sort();
}

function lightBlock(): string {
  const start = css.indexOf(':root {');
  return css.slice(start, css.indexOf('}', start));
}

function darkBlock(): string {
  const start = css.indexOf('@media (prefers-color-scheme: dark)');
  const rootStart = css.indexOf(':root {', start);
  return css.slice(rootStart, css.indexOf('}', rootStart));
}

describe('색 토큰', () => {
  it('라이트와 다크가 같은 토큰 집합을 정의한다(의도적 예외 제외)', () => {
    const expected = tokenNamesIn(lightBlock()).filter((n) => !(n in THEME_INVARIANT));
    expect(tokenNamesIn(darkBlock())).toEqual(expected);
  });

  it('테마 무관 예외는 실제로 다크에서 재정의하지 않는다', () => {
    // 목록에만 적어 두고 다크에도 값을 넣으면 예외가 예외가 아니게 된다.
    for (const name of Object.keys(THEME_INVARIANT)) {
      expect(tokenNamesIn(darkBlock())).not.toContain(name);
    }
  });

  it('@theme이 정의된 토큰을 빠짐없이 노출한다', () => {
    const theme = css.slice(css.indexOf('@theme inline'));
    for (const name of tokenNamesIn(lightBlock())) {
      expect(theme).toContain(`var(${name})`);
    }
  });
});
