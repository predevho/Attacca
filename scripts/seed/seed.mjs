#!/usr/bin/env node
/**
 * 데모용 시드 데이터를 실제 API로 넣는다.
 *
 *   ADMIN_ID=<어드민 loginId> ADMIN_PW=<비밀번호> \
 *   PERFORMER_PW=<인증연주자 계정 비밀번호> \
 *   node scripts/seed/seed.mjs [--base https://attacca.site] [--dry]
 *
 * SQL로 직접 INSERT 하지 않고 API를 쓴다. 검증·권한·파일 저장 같은 규칙을 그대로
 * 통과해야 실제 화면에서 제대로 보이기 때문이다. SQL로 밀어 넣으면 규칙을 어긴
 * 데이터가 들어가도 모른 채 지나간다.
 *
 * 여러 번 돌려도 안전하다 — 이미 있는 것은 건너뛴다.
 * 어드민 승격은 이 스크립트가 하지 않는다(그럴 API가 없다). scripts/seed/README.md 참고.
 */

import { readFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const RESOURCE = join(ROOT, 'resource');

const args = process.argv.slice(2);
const BASE = valueOf('--base') ?? 'https://attacca.site';
const DRY = args.includes('--dry');

function valueOf(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`환경변수 ${name} 이 필요하다.`);
    process.exit(1);
  }
  return v;
}

// --- API 얇은 래퍼 -----------------------------------------------------------
// BE는 { success, data, error } 로 감싸 돌려준다. 실패는 조용히 넘기지 않는다.
async function api(path, { method = 'GET', token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, ok: res.ok, json, raw: text };
}

function fail(what, r) {
  const code = r.json?.error?.resultCode ?? r.status;
  const msg = r.json?.error?.message ?? r.raw?.slice(0, 200);
  throw new Error(`${what} 실패 [${code}] ${msg}`);
}

async function login(loginId, password) {
  const r = await api('/api/auth/login', { method: 'POST', body: { loginId, password } });
  if (!r.ok) fail(`로그인(${loginId})`, r);
  return r.json.data.accessToken;
}

/** 이미 있으면(409) 그대로 진행한다. 여러 번 돌릴 수 있어야 하므로. */
async function signupIfNeeded({ loginId, password, email, nickname }) {
  const r = await api('/api/auth/signup', {
    method: 'POST', body: { loginId, password, email, nickname },
  });
  if (r.ok) return { created: true, id: r.json.data.id };
  if (r.status === 409) return { created: false, id: null };
  fail(`회원가입(${loginId})`, r);
}

async function uploadFile(path, token, filename) {
  const buf = await readFile(join(RESOURCE, filename));
  const form = new FormData();
  form.append('file', new Blob([buf], { type: 'image/jpeg' }), basename(filename));
  return api(path, { method: 'PUT', token, form });
}

// --- 본편 -------------------------------------------------------------------
async function main() {
  const ADMIN_ID = need('ADMIN_ID');
  const ADMIN_PW = need('ADMIN_PW');
  const PERFORMER_PW = need('PERFORMER_PW');

  const data = JSON.parse(await readFile(join(HERE, 'data.json'), 'utf8'));
  console.log(`대상: ${BASE}${DRY ? '  (dry run — 쓰지 않는다)' : ''}`);

  // 1. 어드민 확인
  const adminToken = await login(ADMIN_ID, ADMIN_PW);
  const me = await api('/api/members/me', { token: adminToken });
  if (!me.ok) fail('어드민 확인', me);
  if (me.json.data.role !== 'ADMIN') {
    throw new Error(
      `${ADMIN_ID} 의 권한이 ${me.json.data.role} 다. 공지 등록과 인증 부여는 ADMIN만 할 수 있다.\n`
      + '  scripts/seed/README.md 의 승격 절차를 먼저 할 것.');
  }
  console.log(`어드민: ${me.json.data.nickname ?? ADMIN_ID}`);

  if (DRY) {
    console.log(`공연 ${data.performances.length}건 / 공지 ${data.notices.length}건 준비됨.`);
    return;
  }

  // 2. 인증 연주자 계정
  const p = data.performer;
  const signed = await signupIfNeeded({ ...p, password: PERFORMER_PW });
  console.log(`연주자 계정 ${p.loginId}: ${signed.created ? '생성' : '이미 있음'}`);
  const performerToken = await login(p.loginId, PERFORMER_PW);

  const profile = await api('/api/members/me/profile', {
    method: 'PUT', token: performerToken,
    body: { instruments: p.instruments, bio: p.bio },
  });
  if (!profile.ok) fail('프로필 수정', profile);

  if (p.profileImage) {
    const up = await uploadFile('/api/members/me/profile/image', performerToken, p.profileImage);
    console.log(`  프로필 사진: ${up.ok ? '올림' : `실패 ${up.status}`}`);
  }

  // 3. 인증 연주자 부여 (어드민만 가능)
  const meP = await api('/api/members/me', { token: performerToken });
  const performerId = meP.json.data.id;
  const grant = await api('/api/admin/verified-performers/grant', {
    method: 'POST', token: adminToken,
    body: { memberId: performerId, reason: '실제 연주 활동 확인(정음피아노앙상블, Classic Ensemble M)' },
  });
  // 이미 인증 상태면 409 계열이 온다 — 재실행을 위해 넘어간다.
  console.log(`  인증 연주자: ${grant.ok ? '부여' : `건너뜀 (${grant.json?.error?.resultCode ?? grant.status})`}`);

  // 4. 공연 — 제목이 같은 것이 이미 있으면 건너뛴다
  const existing = await api('/api/public/performances?scope=ALL&size=100');
  const titles = new Set((existing.json?.data?.content ?? []).map((x) => x.title));

  for (const perf of data.performances) {
    if (titles.has(perf.title)) {
      console.log(`  공연 "${perf.title}": 이미 있음`);
      continue;
    }
    const r = await api('/api/performances', {
      method: 'POST', token: performerToken,
      body: {
        title: perf.title, description: perf.description, performedAt: perf.performedAt,
        venue: perf.venue, program: perf.program,
        ticketInfo: perf.ticketInfo, ticketUrl: perf.ticketUrl ?? null,
      },
    });
    if (!r.ok) fail(`공연 등록 "${perf.title}"`, r);
    const id = r.json.data.id;
    let posterNote = '';
    if (perf.poster) {
      const up = await uploadFile(`/api/performances/${id}/poster`, performerToken, perf.poster);
      posterNote = up.ok ? ' + 포스터' : ` (포스터 실패 ${up.status})`;
    }
    console.log(`  공연 "${perf.title}" 등록${posterNote}`);
  }

  // 5. 공지 — 제목이 같은 것이 이미 있으면 건너뛴다
  const notices = await api('/api/public/notices?size=100');
  const nTitles = new Set((notices.json?.data?.content ?? []).map((x) => x.title));

  for (const n of data.notices) {
    if (nTitles.has(n.title)) {
      console.log(`  공지 "${n.title}": 이미 있음`);
      continue;
    }
    const r = await api('/api/admin/notices', {
      method: 'POST', token: adminToken,
      body: {
        type: n.type, title: n.title, content: n.content,
        scheduledAt: n.scheduledAt, place: n.place, pinned: n.pinned,
      },
    });
    if (!r.ok) fail(`공지 등록 "${n.title}"`, r);
    console.log(`  공지 "${n.title}" 등록`);
  }

  console.log('\n시드 완료.');
}

main().catch((e) => {
  console.error(`\n오류: ${e.message}`);
  process.exit(1);
});
