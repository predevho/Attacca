#!/usr/bin/env node
/**
 * 데모용 시드 데이터를 실제 API로 넣는다.
 *
 *   PERFORMER_PW=<연주자 계정 비밀번호> node scripts/seed/seed.mjs [--base ...] [--dry]
 *
 * SQL로 직접 INSERT 하지 않고 API를 쓴다. 검증·권한·파일 저장 같은 규칙을 그대로
 * 통과해야 실제 화면에서 제대로 보이기 때문이다. SQL로 밀어 넣으면 규칙을 어긴
 * 데이터가 들어가도 모른 채 지나간다.
 *
 * 여러 번 돌려도 안전하다 — 이미 있는 것은 건너뛴다.
 *
 * **어드민 계정을 쓰지 않는다.** 시드를 돌리자고 권한이 큰 계정을 새로 만들지 않는다.
 * 그래서 어드민이 필요한 두 가지(인증 연주자 부여, 공지 등록)는 이 스크립트 밖에 있다.
 * 인증 부여는 확인만 하고 안내하며, 공지 문안은 data.json 에 남겨 둔다.
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

/**
 * 이미 있으면(409) 그대로 진행한다. 여러 번 돌릴 수 있어야 하므로.
 *
 * ⚠️ 가입에는 약관·개인정보 동의가 필수다(DOMAIN-MEMBER-STATUTE §3.4). 이 스크립트가
 * 체크를 대신 넣으면 **본인이 하지 않은 동의가 기록으로 남는다.** 동의 기록의 존재 이유가
 * "이 사람이 동의했다"고 말할 수 있게 하는 것이니, 그걸 스크립트가 지어내면 기능 자체가
 * 무의미해진다. 그래서 실제 당사자에게 확인받았다는 표시(PERFORMER_CONSENTED=1)를
 * 명시적으로 요구한다 — 실수로 그냥 넘어가지 않게.
 */
async function signupIfNeeded({ loginId, password, email, nickname }) {
  if (process.env.PERFORMER_CONSENTED !== '1') {
    throw new Error(
      '이 계정의 주인에게 약관·개인정보 수집·이용 동의를 실제로 받았는지 확인할 것.\n'
      + '  받았다면 PERFORMER_CONSENTED=1 을 함께 넘긴다.\n'
      + '  받지 않았다면 본인이 직접 가입하게 하는 편이 맞다.');
  }
  const r = await api('/api/auth/signup', {
    method: 'POST',
    body: { loginId, password, email, nickname, agreedTerms: true, agreedPrivacy: true },
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
  const PERFORMER_PW = need('PERFORMER_PW');

  const data = JSON.parse(await readFile(join(HERE, 'data.json'), 'utf8'));
  console.log(`대상: ${BASE}${DRY ? '  (dry run — 쓰지 않는다)' : ''}`);

  if (DRY) {
    console.log(`공연 ${data.performances.length}건 준비됨.`);
    return;
  }

  // 1. 연주자 계정 — 평범한 USER로 만든다. 어드민 계정은 만들지 않는다.
  const p = data.performer;
  const signed = await signupIfNeeded({ ...p, password: PERFORMER_PW });
  console.log(`연주자 계정 ${p.loginId}: ${signed.created ? '생성' : '이미 있음'}`);
  const performerToken = await login(p.loginId, PERFORMER_PW);

  const profile = await api('/api/members/me/profile', {
    method: 'PUT', token: performerToken,
    body: { instruments: p.instruments, bio: p.bio },
  });
  if (!profile.ok) fail('프로필 수정', profile);
  console.log('  프로필 저장');

  if (p.profileImage) {
    const up = await uploadFile('/api/members/me/profile/image', performerToken, p.profileImage);
    console.log(`  프로필 사진: ${up.ok ? '올림' : `실패 ${up.status}`}`);
  }

  // 2. 인증 연주자인지 확인 — 부여는 이 스크립트가 하지 않는다.
  //
  // 부여는 어드민 전용 API다. 시드를 돌리려고 어드민 계정을 새로 만들지 않기로 했으므로
  // (권한이 큰 계정을 임시로 늘리지 않는다), 이 스크립트는 확인만 하고 방법을 알려 준다.
  // 부여한 뒤 다시 돌리면 이어서 진행한다 — 여러 번 돌려도 안전하다.
  const meP = await api('/api/members/me', { token: performerToken });
  const performerId = meP.json.data.id;
  if (!meP.json.data.verified) {
    console.log(`\n연주자 계정(id=${performerId})이 아직 인증 연주자가 아니다.`);
    console.log('공연 등록은 인증 연주자만 할 수 있으므로 여기서 멈춘다.');
    console.log('부여 방법은 scripts/seed/README.md 를 볼 것. 부여 후 이 스크립트를 다시 돌리면 이어서 진행한다.');
    return;
  }
  console.log(`  인증 연주자 확인 (id=${performerId})`);

  // 3. 공연 — 제목이 같은 것이 이미 있으면 건너뛴다
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

  // 공지는 이 스크립트가 넣지 않는다.
  //
  // 공지 등록은 어드민 전용인데, 시드를 위해 어드민 계정을 새로 만들지 않기로 했다.
  // 문안은 data.json 의 notices 에 남겨 뒀으니 어드민이 화면에서 옮겨 쓰면 된다.
  console.log(`\n시드 완료. (공지 ${data.notices.length}건은 어드민이 화면에서 직접 등록 — data.json 참고)`);
}

main().catch((e) => {
  console.error(`\n오류: ${e.message}`);
  process.exit(1);
});
