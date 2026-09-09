import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 색 토큰의 명암비를 지킨다.
 *
 * 2026-09-08 목업 검토에서 `--ink-faint`가 3.3:1(기준 4.5:1 미달)인 것을 발견했는데,
 * 이런 건 화면을 봐서는 "좀 흐리네" 정도로만 보여 그냥 지나간다. 값으로 지켜야 한다.
 * WCAG 2.1 AA 본문 기준 4.5:1.
 */

const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');

/** `:root { ... }` 블록에서 토큰을 읽는다. 다크는 미디어쿼리 안의 두 번째 블록. */
function tokens(theme: 'light' | 'dark'): Record<string, string> {
  const blocks = [...css.matchAll(/:root\s*\{([^}]*)\}/g)].map((m) => m[1]);
  const block = theme === 'light' ? blocks[0] : blocks[1];
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2];
  return out;
}

const channel = (c: number) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
/** opacity가 걸린 글자의 실효 색. 헤더 비활성 링크가 이 경우다. */
function blend(fg: string, bg: string, alpha: number): string {
  const mix = (i: number) => Math.round(
    parseInt(fg.slice(i, i + 2), 16) * alpha + parseInt(bg.slice(i, i + 2), 16) * (1 - alpha),
  );
  return '#' + [1, 3, 5].map((i) => mix(i).toString(16).padStart(2, '0')).join('');
}

const AA = 4.5;
// 글자 토큰이 실제로 얹히는 배경들. 새 조합을 쓰기 시작하면 여기에 추가한다.
const BACKGROUNDS = ['paper', 'surface', 'surface-muted'] as const;
const TEXT = ['ink', 'ink-muted', 'ink-faint'] as const;

describe.each(['light', 'dark'] as const)('색 대비 (%s)', (theme) => {
  const t = tokens(theme);

  it.each(TEXT)('%s 는 모든 배경에서 AA를 넘는다', (name) => {
    for (const bg of BACKGROUNDS) {
      const r = contrast(t[name], t[bg]);
      expect(r, `${name} on ${bg} = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA);
    }
  });

  it('헤더 글자는 헤더 바 위에서 AA를 넘는다(비활성 링크의 opacity-80 포함)', () => {
    expect(contrast(t['on-header'], t.header)).toBeGreaterThanOrEqual(AA);
    const dimmed = blend(t['on-header'], t.header, 0.8);
    const r = contrast(dimmed, t.header);
    expect(r, `비활성 링크 = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA);
  });

  it('브랜드 배경 위 글자도 AA를 넘는다', () => {
    expect(contrast(t['on-brand'], t.brand)).toBeGreaterThanOrEqual(AA);
  });
});
