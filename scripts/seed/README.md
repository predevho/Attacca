# 시드 데이터

데모용 초기 데이터를 **실제 API로** 넣는다. SQL로 직접 INSERT 하지 않는다 —
검증·권한·파일 저장 규칙을 그대로 통과해야 실제 화면에서 제대로 보이고,
SQL로 밀어 넣으면 규칙을 어긴 데이터가 들어가도 모른 채 지나간다.

여러 번 돌려도 안전하다. 이미 있는 것은 건너뛴다.

---

## 먼저: 어드민 만들기

**코드에 `Role.ADMIN`을 부여하는 경로가 없다.** 회원가입은 전부 USER이고 승격
API도 없다. 그래서 첫 어드민은 DB에서 직접 만들어야 한다. 공지 등록과 인증 연주자
승인이 모두 어드민 전용이므로, 이걸 하지 않으면 서비스에 공지를 올릴 수 없다.
(구조적인 해결은 `docs/TODO-BACKLOG.md`의 "어드민 부트스트랩" 항목.)

1. 사이트에서 **직접 회원가입**한다: <https://attacca.site/signup>
   — 비밀번호는 본인만 알아야 하므로 대신 만들어 주지 않는다.
2. EC2에서 그 계정을 ADMIN으로 올린다.

```bash
ssh attacca
cd ~/attacca && set -a && . ./.env.prod && set +a
H=$(echo "$DB_URL" | sed -E 's#jdbc:mysql://([^:/]+).*#\1#')
D=$(echo "$DB_URL" | sed -E 's#.*/([^?]+).*#\1#')
docker run --rm -e MYSQL_PWD="$DB_PASSWORD" mysql:8.4 \
  mysql -h "$H" -u "$DB_USERNAME" "$D" \
  -e "UPDATE member SET role='ADMIN' WHERE login_id='<가입한 loginId>';
      SELECT id, login_id, role FROM member;"
```

3. **다시 로그인해야 반영된다.** access 토큰(30분)에 role이 박혀 있어서,
   기존 토큰으로는 계속 USER로 취급된다. refresh로 재발급해도 되는데,
   재발급은 role을 DB에서 다시 읽으므로 그쪽이 더 빠르다
   (`docs/DOMAIN-COMMON-STATUTE.md` §4.1).

---

## 실행

```bash
ADMIN_ID=<어드민 loginId> ADMIN_PW=<비밀번호> \
PERFORMER_PW=<인증연주자 계정에 쓸 비밀번호> \
node scripts/seed/seed.mjs
```

* `--base http://localhost:8080` 으로 대상 변경 (기본 `https://attacca.site`)
* `--dry` 로 쓰기 없이 확인만

---

## 무엇이 들어가는가

`data.json`에 있다. 실제 공연 자료(`resource/`)에서 옮겼고, **지난 공연은
실제 날짜 그대로** 넣는다.

* 인증 연주자 1명 — 프로필·악기·소개·프로필 사진
* 공연 4건 — 정음피아노앙상블 제4회 정기연주회 / 모차르트의 밤 /
  TWO PIANO OPERA / 제40회 영아티스트 콘서트
* 공지 3건

### 일부러 넣지 않은 것

`resource/`에 있지만 **의도적으로 제외한 이미지**가 있다.

* **제40회 영아티스트 콘서트 포스터** — 미성년자 13명 이상의 얼굴 사진이 있고,
  주최도 다른 단체(음악교육신문)다. 공연 정보(제목·일시·장소)와 본인 연주 곡목만 넣는다.
* **정음피아노앙상블 프로그램 뒷면** — 연주자 11명의 얼굴 사진이 있다.
  곡목·단체 소개 텍스트만 옮긴다.

공연 정보와 곡목은 공개된 정보라 그대로 쓰지만, **사진과 개인정보는 다르다.**
당사자 동의 없이 공개 사이트에 올리지 않는다. 같은 이유로 본인 외 연주자
이름으로 계정을 만들지 않는다.

---

## 지우려면

시드는 API로 넣으므로 화면에서 지우거나, 급하면 DB에서 지운다.
`deleted_at`을 쓰는 소프트 삭제라 목록에서만 사라진다.
