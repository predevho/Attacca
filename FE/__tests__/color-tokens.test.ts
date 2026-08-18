import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 라이트(:root)와 다크(prefers-color-scheme) 블록은 서로 독립된 목록이라
 * 한쪽에만 토큰을 추가해도 빌드가 통과한다. 빠진 쪽은 폴백 없이 미정의가 되므로
 * 이름 집합이 어긋나지 않는지만 지킨다. 색 값 자체는 검증 대상이 아니다.
 */
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
  it('라이트와 다크가 같은 토큰 집합을 정의한다', () => {
    expect(tokenNamesIn(darkBlock())).toEqual(tokenNamesIn(lightBlock()));
  });

  it('@theme이 정의된 토큰을 빠짐없이 노출한다', () => {
    const theme = css.slice(css.indexOf('@theme inline'));
    for (const name of tokenNamesIn(lightBlock())) {
      expect(theme).toContain(`var(${name})`);
    }
  });
});
