// 색 토큰 전환이 끝났는지 검사한다. 인자로 경로를 주면 그 범위만 본다.
//   node scripts/check-color-tokens.mjs app/feed components/feed
//   node scripts/check-color-tokens.mjs            # 전체(app, components)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = process.argv.slice(2).length ? process.argv.slice(2) : ['app', 'components'];
const PALETTE = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white';
const HARDCODED = new RegExp(`(?:bg|text|border|ring|divide|placeholder)-(?:${PALETTE})(?:-\\d{2,3})?(?![\\w-])`, 'g');

// 카카오 브랜드 식별색. 배경이 노랑 고정이라 그 위 글자도 검정 고정이어야 한다.
const ALLOWED = [{ file: 'app/(auth)/login/LoginForm.tsx', classes: ['text-black'] }];

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

function allowedFor(file) {
  return ALLOWED.find((a) => file.endsWith(a.file))?.classes ?? [];
}

const problems = [];
for (const file of ROOTS.flatMap((r) => walk(r))) {
  const src = readFileSync(file, 'utf8');
  const allow = allowedFor(file);

  src.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(HARDCODED)) {
      if (!allow.includes(m[0])) problems.push(`${file}:${i + 1}  하드코딩 색 ${m[0]}`);
    }
  });

  // 테두리를 켜놓고(border, border-2, border-t ...) 색을 지정하지 않은 className
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    const cls = (m[1] ?? m[2] ?? '').split(/\s+/);
    const drawsBorder = cls.some((c) => /^border(-[0-9]+|-[trblxy](-[0-9]+)?)?$/.test(c));
    const hasColor = cls.some((c) => /^border-(line|warn|success|danger|brand|brand-strong|current|transparent)$/.test(c));
    if (drawsBorder && !hasColor) {
      const line = src.slice(0, m.index).split('\n').length;
      problems.push(`${file}:${line}  테두리 색 미지정`);
    }
  }
}

if (problems.length) {
  console.error(`전환 미완료 ${problems.length}건:`);
  problems.forEach((p) => console.error('  ' + p));
  process.exit(1);
}
console.log(`색 토큰 전환 완료 (${ROOTS.join(', ')})`);
