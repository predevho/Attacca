# TODO-DONE

완료된 작업 기록.

---

* [x] (2026-09-09) 회원 입력 검증 / 개인정보 동의 / 회원 탈퇴 — 규칙은 `docs/DOMAIN-MEMBER-STATUTE.md` §3.3~3.5.
  * **검증이 하나도 없었다.** 운영 서버에 비밀번호 `1`, 이메일 `not-an-email`, 닉네임 공백 한 칸으로 가입이 되고 로그인까지 되는 것을 직접 확인했다. `SignupRequest`에 제약 애노테이션이 없고 컨트롤러에 `@Valid`도 없었다. 다른 도메인 DTO에는 다 있었는데 **가장 바깥 입구인 MEMBER만** 빠져 있었다.
  * 비밀번호는 길이 기준(8~64)으로 본다. 특수문자 강제는 오히려 예측 가능한 변형을 부른다는 NIST 권고를 따랐다. 닉네임은 저장 전 trim — MySQL 기본 collation이 후행 공백을 무시해 `"홍길동"`과 `"홍길동 "`이 같게 비교된다(빈 닉네임이 `NICKNAME_ALREADY_EXISTS`로 막히는 것으로 드러났다).
  * **동의는 화면이 아니라 기록이다.** 체크박스만 두면 "동의한 적 없다"에 답할 수 없다. `member_consent`에 이력 전부를 남기고, 탈퇴해도 지우지 않는다(개인 식별 정보가 없고, 동의 여부에 답하려면 필요하다). 회원 FK를 걸지 않은 것도 같은 이유 — 걸면 지우고 싶어진다.
  * 카카오는 최초 사용 시 곧바로 가입된다. 가입 여부는 인가코드를 교환해 봐야 아니까 **버튼을 누르기 전에** 동의를 받아 httpOnly 쿠키로 콜백까지 나른다. 이미 있는 회원의 로그인은 막지 않는다.
  * **탈퇴는 사람을 지우고 글은 남긴다.** 작성물까지 지우면 남의 글타래가 무너진다. loginId/password는 null, email은 `deleted-{id}@attacca.invalid`(RFC 2606 예약 TLD라 실수로도 발송되지 않는다), nickname은 `탈퇴한회원{id}`. 프로필 사진은 파일까지 지운다. 소셜 연결을 끊어 카카오 재로그인으로 되살아나지 않게 한다. refresh 전부 철회.
  * **검증(실서버)**: 약한 입력 400-01 / 동의 없이 가입 400-04 / 동의하고 가입 시 이력 2건 기록 / 탈퇴 후 재로그인 401-07 · 옛 refresh 401-09 · 재탈퇴 409-07 / DB에서 익명화와 동의 이력 잔존 확인. Flyway V2·V3 적용 확인.
  * ⚠️ 약관·개인정보처리방침 문안은 **초안이며 법적 검토를 받지 않았다.** 실사용자를 받기 전에 확인 필요(파일 상단에 명시).

* [x] (2026-09-08) HTTPS 전환 — **https://attacca.site**. 절차는 `docs/DEPLOY.md` 2단계.
  * **이 작업으로 로그인이 처음 동작하게 됐다.** `NODE_ENV=production`이라 쿠키에 `Secure`가 붙는데 HTTP에서는 브라우저가 저장을 거부한다. 즉 그전까지 브라우저 로그인은 **아예 불가능**했고, HTTPS는 편의가 아니라 동작 조건이었다.
  * 도메인 attacca.site(가비아) + Elastic IP `3.39.184.71`. A 레코드 apex/www, 보안 그룹 443.
  * Let's Encrypt 인증서(apex + www). 스테이징으로 먼저 연습한 뒤 진짜 발급. `attacca-renew.timer`가 하루 2회 확인 → nginx reload. `--dry-run`으로 갱신 전 과정 검증.
  * **www는 apex로 301.** 취향이 아니라 필요다 — 두 오리진이면 쿠키가 갈라져 www에서 로그인하면 apex는 로그아웃 상태가 되고, WS 허용 오리진도 둘 다 열어야 한다.
  * **함께 잡은 치명적 버그**: nginx에 `location /api/bff/`가 없어 브라우저가 부른 `/api/bff/*`가 전부 BE로 가 401이었다. 로그인·피드 등 클라이언트 동작이 통째로 죽어 있었는데, 홈이 서버 렌더라 멀쩡해 보여 가려져 있었다.
  * **nginx 설정이 왜 안 먹었는지도 잡았다**: 설정을 파일 하나로 bind mount 하면 그 inode에 고정된다. `git pull`이 파일을 갈아끼우면 컨테이너는 영영 옛 파일을 본다(호스트 inode 298981 / 컨테이너 320796). reload가 아니라 재생성해야 한다.
  * **CI에 `workflow_dispatch` 추가**: 코드는 그대로인데 빌드 시점 변수(`NEXT_PUBLIC_BE_WS_URL`)만 바뀌면 이미지를 다시 구울 방법이 없었다. 이번 전환에서 실제로 막혔다.
  * **검증**: 로그인→쿠키 2개 저장(Secure)→인증 요청 200→로그아웃→쿠키 0개·401, 철회된 refresh는 401-09. wss 핸드셰이크 101. http/www 모두 apex https로 301. TLS 1.3.

* [x] (2026-09-08) 자동 배포(CD) 구축 — main 푸시 한 번으로 끝난다. 절차는 `docs/DEPLOY.md`.
  * **구성**: Actions가 테스트 → 이미지 빌드 → GHCR(`:latest`/`:<sha>`) 푸시. EC2의 systemd 타이머가 2분마다 받아 교체하고, 참조를 잃은 옛 이미지를 지운다.
  * **미는 대신 당겨오기로 했다.** GitHub이 밀어넣으려면 22번을 전체 개방하거나 SSM/OIDC를 붙여야 한다. 서버가 스스로 확인하면 **인바운드 포트를 하나도 열지 않고** GitHub에 서버 자격증명도 두지 않는다. 대가는 최대 2분 지연과 배포 로그가 GitHub에 안 남는 것(서버 `journalctl`에는 남는다).
  * **서버에서 굽지 않는다.** t3.micro(1GB)에서 Gradle·Next를 빌드하느라 스왑을 긁고 빌드 캐시가 5GB까지 불어 있었다. 빌드를 밖으로 빼고 정리해 디스크 35%→20%.
  * `update.sh`가 저장소도 fast-forward로 따라가므로 compose·nginx 설정 변경도 자동 반영된다(자기 자신을 갱신하므로 전체를 `main()`으로 감쌌다 — bash가 실행 중 파일을 읽어 가기 때문).
  * **함께 잡은 버그 2건**:
    * nginx가 `upstream be:8080`을 기동 시 한 번만 해석해, 컨테이너가 재생성되면 죽은 IP를 붙들고 502를 냈다. 변수+`resolver`로 요청마다 다시 묻게 했다. BE IP를 강제로 바꿔(172.18.0.3→.6) nginx 재시작 없이 200이 나오는 것까지 확인.
    * prod compose에 "비상용"으로 남긴 `build:` 때문에 compose가 `--no-build`에서 이미지 변경 검사를 건너뛰어, 새 이미지를 받아 놓고도 교체하지 않고 2분마다 헛돌았다. `build:` 제거 + 드리프트 서비스만 `--force-recreate`로 이중 방어.
  * **검증**: 실제 커밋 하나를 푸시해 CI 통과 → GHCR 푸시 → 타이머가 감지·교체·헬스체크 통과까지 전 구간 확인. 이후 6분간 헛도는 실행 0회.

* [x] (2026-09-08) FE 무한스크롤이 조용히 멈출 수 있던 버그 — `useInfiniteList`의 상태 지연.
  * **증상**: CI에서 `sentinel 교차 시…` 테스트가 간헐적으로 실패. 로컬에서는 재현되지 않았다.
  * **오진 두 번**: 처음엔 "러너가 굶었다"로 보고 타임아웃을 1초→5초로 늘렸는데, 다음 CI가 **5초를 기다려도** 실패했다. 마이크로태스크 체인이 5초 걸릴 리 없으니 느린 게 아니라 **로드가 아예 일어나지 않은 것**이었다. 그 전에 시도한 렌더 중 ref 갱신은 eslint `react-hooks/refs`가 에러로 막아 채택 불가.
  * **원인**: 옵저버 콜백이 읽는 `stateRef`를 `useEffect`로 갱신하고 있었다. IntersectionObserver 콜백은 브라우저 이벤트라 **커밋과 패시브 이펙트 flush 사이에 끼어들 수 있고**, 그때 `loaded:false / nextCursor:null`인 낡은 값을 읽어 다음 페이지 로드를 건너뛴다. 한 번 건너뛰면 다시 트리거될 일이 없다.
  * **영향은 테스트만이 아니다.** 실제 브라우저에서도 첫 페인트 직후 sentinel이 이미 보이는 화면(짧은 목록, 큰 뷰포트)에서 **목록이 그대로 멈출 수 있었다.**
  * **수정**: 렌더·이펙트 타이밍에 기대지 않고, 상태를 바꾸는 바로 그 자리(`load` 안)에서 ref를 함께 갱신한다. 타임아웃 완화는 되돌렸다 — 재발하면 빨리 실패해야 한다.

* [x] (2026-09-08) 인증/인가 — refresh 로테이션·철회 도입(Redis). 규칙은 `docs/DOMAIN-COMMON-STATUTE.md` §4.1.
  * **왜**: 무상태 JWT에서는 (1) 서버 쪽 로그아웃이 없고 (2) 같은 refresh를 14일 재사용하며 (3) 개별 철회 수단이 없었다. 탈취되면 만료까지 손을 못 댔다.
  * **구조**: refresh만 서버가 기억한다 — 화이트리스트 `rt:{memberId}` Set(멤버=`jti`, TTL=refresh 만료). access는 여전히 무상태(30분이라 블랙리스트를 두지 않는다). Set 하나로 다중 기기가 자연히 되고 전 기기 무효화가 `DEL` 한 번이다.
  * **`reissue`가 access·refresh를 둘 다 새로 준다.** 옛 `jti`는 즉시 제거. 화이트리스트에 없는 refresh가 오면 탈취로 보고 `DEL rt:{memberId}` — 그 회원의 전 기기가 로그아웃된다(401-09 `REVOKED_TOKEN`).
  * **덤으로 잡은 구멍**: `reissue`가 refresh claim의 role을 새 access로 그대로 옮겨 담고 있었다. ADMIN을 강등해도 **최대 14일간 ADMIN access가 계속 발급**됐다는 뜻이다. 이제 DB에서 role을 다시 읽는다. 상태를 갖기로 한 김에 함께 고쳤다.
  * **fail-closed**(선택). Redis에 못 붙으면 503-01. 막히는 범위가 `reissue`만이 아니라 **로그인 포함 토큰 발급 전체**라는 점을 실제로 Redis를 내려 확인하고 문서를 고쳤다. 공개 조회와 이미 발급된 access 요청은 계속 산다.
  * **어긋날 수 없게 만든 것들**: 발급은 반드시 `TokenIssuer.issue()`를 거친다(발급과 화이트리스트 등록이 한 곳). role 조회는 `global.security.MemberRoleProvider` 포트 ↔ MEMBER 도메인 구현 — `global`이 `domain`을 참조하지 않는다. 저장소는 `RefreshTokenStore` 인터페이스라 테스트가 Redis 없이 인메모리로 돈다(`app.auth.token-store=memory`).
  * **FE**: `session.ts`가 쿠키 두 개를 갱신하고(옛 refresh를 남기면 다음 갱신에서 재사용으로 감지돼 전 기기가 날아간다), `/api/bff/logout`이 BE 철회를 먼저 호출한다. BE 호출이 실패해도 쿠키는 지운다.
  * **검증**: 로컬 실제 Redis로 로그인→`rt:1` 1건 → 재발급→로테이션 → 옛 refresh 재사용→401-09 + `rt:*` 0건 → 로그아웃→401-09 → Redis 중단시 로그인·재발급 503-01 / 공개 조회 200 → Redis 복구시 200. BE 383 / FE 358 통과.

* [x] (2026-09-08) 배포 준비 — 블로커 3건 해소 + 배포 산출물. 절차는 `docs/DEPLOY.md`.
  * **`ddl-auto` → `validate` + Flyway 도입**. 기존 `update` 스키마(19테이블)를 `V1__baseline_schema.sql`로 추출. 기존 DB는 `baseline-on-migrate`로 흡수하고, **빈 DB에서는 마이그레이션이 실제로 돌아 앱이 뜨는 것까지 확인**했다(로컬 + 컨테이너 두 경로). 이제 엔티티를 바꾸면 기동이 실패하므로 마이그레이션을 반드시 함께 써야 한다 — Hibernate가 조용히 스키마를 바꾸는 것보다 낫다.
  * **단일 인스턴스로 확정.** 채팅이 그대로 동작하는 것이 결정적이었다(인메모리 STOMP 브로커·presence). 스케일아웃·블루그린은 의도적으로 포기하고, 필요해지면 Redis를 먼저 넣는다.
  * **WS origin 환경변수화**(`WS_ALLOWED_ORIGINS`). `*`였던 것을 좁혔다. 채팅은 브라우저가 BE에 직접 붙어 BFF를 거치지 않으므로 이 값이 실제 접근 통제다.
  * **Actuator**: `health`만 노출 + `/actuator/health`만 permitAll. `/actuator/env`·`/beans`가 401인 것을 확인.
  * 산출물: `BE/Dockerfile`(멀티스테이지, non-root uid 10001, `MaxRAMPercentage`) / `FE/Dockerfile`(standalone) / `docker-compose.prod.yml` / `deploy/nginx.conf`(WS Upgrade·1시간 타임아웃·업로드 상한 일치) / `.github/workflows/ci.yml`(한 워크플로 안에서 paths-filter + needs로 BE→FE 순서 강제) / `.env.prod.example`.
  * **검증**: 두 이미지 모두 빌드 성공. BE 컨테이너를 **완전히 빈 DB**에 붙여 Flyway V1 적용 → `validate` 통과 → 기동 → `/actuator/health` UP → 공개 조회 200 → non-root 실행까지 확인. BE 373 / FE 353 테스트 통과.
  * 테스트가 155건 깨졌다가 복구된 과정: `validate`가 `@DataJpaTest`(프로파일 미지정)에도 적용돼 H2에 스키마가 없어 실패했다. 테스트 소스셋 전역 `application.properties`로 `create-drop`+Flyway off를 주어 해소.
  * 남은 것: 실제 AWS 프로비저닝, 인증서 발급, CI의 배포 job(EC2 접속 방식 미정), S3 실연동.

* [x] (2026-09-08) FE 홈 화면 신설 — 공개 랜딩. `/`가 `/feed` 리다이렉트에서 실제 화면이 됐다.
  * **홈(`/`)**: 자동 전환 캐러셀(다가오는 공연 + 고정 공지) / 게시글 위젯(최신글·인기글 탭) / 월간 달력 + 이번 달 일정. 공개 조회(`/api/bff/public/**`)만 쓰고 신원 조회를 하지 않는다.
  * **BFF 4종**: 공지·공연·게시글 패스스루 + `/api/bff/public/calendar`(합성). `proxyPublic` 헬퍼 신설 — 쿠키를 읽지도 붙이지도 않는다(토큰 유무로 응답이 달라지면 안 되므로). 달력 합성은 한쪽만 실패해도 반쪽을 그리지 않고 실패로 내린다.
  * **비로그인 헤더**: 예전에는 신원을 못 얻으면 헤더 자체를 렌더하지 않았다. 공개 홈에서는 그러면 로그인할 방법이 사라져, 로그인·회원가입을 보여주도록 바꿨다. 신원을 아직 모르는 동안에는 오른쪽만 비워 상태가 번쩍이지 않게 했다.
  * **로그인 후 원래 경로 복귀**: 미들웨어가 `?next=`를 붙이고 로그인 성공 시 그리로 돌아간다. `safeNext`가 내부 경로만 허용해 `//evil.com` 같은 열린 리다이렉트를 막는다. 홈이 공개가 되면서 "홈 → 카드 클릭 → 로그인 → 원래 그것"이 주 동선이 됐기 때문.
  * **[결함] 실화면에서 가로 스크롤 발견·수정** — `lg:grid-cols-[1fr_340px]`의 `1fr`은 최소 크기가 `auto`라, `truncate`된 긴 제목의 min-content 폭만큼 첫 열이 부풀어 달력을 뷰포트 밖(1452px)으로 밀어냈다. `minmax(0,1fr)`으로 수정. 유닛 테스트로는 잡히지 않는 종류라 실화면 검증이 잡았다.
  * `lib/api.ts`에 공용 `request()` 도입 — fetch reject를 `{ok:false}`로 흡수한다. 기존 BACKLOG 항목("신원 조회에 .catch 없음")을 개별 호출부가 아니라 한 곳에서 해소.
  * **실환경 검증 완료**(MySQL+BE 8081+FE 3001, 브라우저): 비로그인 홈 렌더 → 게시글 클릭 → `/login?next=/feed/4` → 로그인 → 해당 글 복귀 → 로그인 상태 홈 → 인기글 탭이 MySQL에서도 (좋아요+댓글) 순으로 정렬. 라이트/다크 둘 다 확인.
  * FE 테스트 353개 통과(신규 홈 로직 24·홈 화면 8·공개 BFF 8·미들웨어 3), eslint 0 에러, 색 토큰 검사 통과, 빌드 성공.
  * 남은 범위 밖: 캐러셀 hover 일시정지·`prefers-reduced-motion`, 공지 상세 화면, 포스터 없는 슬라이드의 대체 디자인.

* [x] (2026-09-08) PERFORMANCE·FEED 공개 조회 + 인기글 정렬 — 새 홈(공개 랜딩)이 쓸 나머지 두 소스. 문서 PERFORMANCE-STATUTE §12 / FEED-STATUTE §12.
  * **`PublicMemberDisplay` 신설**(`domain.member.dto`) — 닉네임·인증뱃지만 갖고 회원 id를 아예 담지 않는다. 기존 `MemberDisplay`는 `@JsonProperty("id")`로 회원 id를 직렬화하므로 공개 응답에 쓰면 안 된다. 규칙을 문서가 아니라 **타입으로 강제**한 것.
  * **PERFORMANCE**: `/api/public/performances?scope=UPCOMING|PAST|ALL|SCHEDULED&from=&to=` + 단건. `SCHEDULED`는 NOTICE와 같은 이름·같은 `[from, to)` 규약(BFF가 두 도메인을 같은 모양으로 호출). enum은 공개 전용 `PublicPerformanceScope`로 분리 — 인증 경로에 의미 없는 값을 더하지 않기 위함.
  * **FEED**: `/api/public/feed/posts?sort=LATEST|POPULAR` (목록만, 상세는 비공개 — 카드 클릭 시 인증 경로로 보내 로그인을 요구하는 동선이 의도). 인기순은 **최근 30일 창** 안에서 (좋아요+댓글) 내림차순, 동률 시 id DESC. 창이 없으면 한 번 터진 옛 글이 영구히 상단을 차지한다. 집계값 정렬이라 커서가 아닌 오프셋이며, 인증 경로의 커서 타임라인은 손대지 않았다.
  * 공개 응답에서 `likedByMe` 제거 — 비인증 경로에서는 보는 사람을 몰라 계산할 수 없고, 있어서도 안 되는 값.
  * NOTICE-STATUTE §6의 공개 규칙을 정정: "작성자 표시정보 전체 비노출"은 NOTICE 고유 판단이고, **모든 도메인 공통 고정 규칙은 회원 식별자·내부 상태·보는 사람 종속 값의 비노출**이다. 표시정보 노출 여부는 도메인이 판단한다.
  * 테스트 15개 신규(공연 공개 7 / 피드 공개 8). 전체 **373/373 통과**.

* [x] (2026-09-08) NOTICE(공지·소식·운영 일정) 도메인 문서화 + BE 구현 — 새 홈 화면의 캐러셀·달력 원천. 문서 `docs/DOMAIN-NOTICE-CONSTITUTION.md` / `STATUTE.md`.
  * **엔티티 1종 `Notice`** (`type` NOTICE/NEWS/EVENT + `scheduledAt` nullable + `pinned` + `coverImageKey` + soft delete). 셋을 쪼개지 않은 이유는 작성 주체·필드·수명주기가 같고 홈이 한 번에 모아 조회하기 때문.
  * **달력 노출 = `scheduledAt`의 유무**라는 단일 상태. 별도 플래그를 두지 않아 "날짜는 있는데 달력엔 없음" 같은 모순 상태가 만들어질 수 없다. `pinned`는 캐러셀만 제어하는 독립 축.
  * **공개 조회를 처음 도입** — `/api/public/**` permitAll + 컨트롤러·DTO를 인증용과 분리. 공개 응답(`PublicNoticeResponse`)에는 작성자·회원 식별자를 담지 않는다. 이 규칙을 이후 도메인의 공개 조회 표준으로 삼는다(STATUTE §6).
  * **쓰기는 경로로 게이팅** — `/api/admin/notices`가 기존 `hasRole("ADMIN")` 매처에 걸린다. 서비스 계층 권한 판정 없음, 소유자 판정도 없음(운영 주체의 글).
  * 공통 `PageResponse<T>` 신규 — 공개 API는 외부 계약이라 `PageImpl` 직렬화에 기대지 않는다. 기존 도메인 전환은 BACKLOG 유지.
  * **[결함] 잘못된 HTTP 메서드가 500으로 응답되던 것을 405-01로 수정** — `ErrorCode.METHOD_NOT_ALLOWED`가 정의만 되고 이를 쓰는 핸들러가 없어 catch-all로 떨어지고 있었다. 공개 경로에 쓰기가 없음을 확인하는 테스트가 잡아낸 기존 결함(2026-07 `NoResourceFoundException` 404, 2026-08 파라미터 바인딩 400과 같은 계열).
  * 에러코드 404-12(`NOTICE_NOT_FOUND`) 추가. ARCHITECTURE-CONSTITUTION §3 도메인 표(6→7개)·STATUTE §2 패키지 트리 반영.
  * 테스트 46개 신규(엔티티 8 / 리포지토리 8 / 서비스 14 / 어드민 컨트롤러 7 / 공개 컨트롤러 9). 전체 **358/358 통과**.
  * 남은 범위 밖: 예약 발행·노출 기간, 댓글/좋아요, 태그 검색, 알림, 마크다운 본문(순수 텍스트로 확정).

* [x] (2026-08-18) 전역 내비게이션 + 악보지 테마 — 브랜치 `feature/global-nav-paper-theme`. 설계 `docs/superpowers/specs/2026-08-18-global-nav-paper-theme-design.md`, 계획 `docs/superpowers/plans/2026-08-18-global-nav-paper-theme.md`.
  * **전역 헤더 신규**: 도메인 4개 링크(피드·공연·구인·채팅) + 닉네임·인증뱃지 + 어드민(ROLE_ADMIN만) + 로그아웃. 인증 화면에서는 스스로 렌더를 건너뛰고 신원 요청도 보내지 않는다. 판정 로직은 순수 함수로 분리해 단위 테스트.
  * **홈을 `/feed`로 전환하고 `/dashboard` 제거** — 내비가 생기면서 존재 이유가 사라진 페이지. 이동 대상 4곳(루트·로그인·카카오 콜백·어드민 게이트) 변경.
  * **미들웨어 `/recruitments` 누락 복구** + matcher 커버리지 회귀 테스트 신규. 2026-08-12 세 브랜치 병합 중 경로가 조용히 사라진 사고였다.
  * **프로필**에 닉네임·인증뱃지 표시 + 도달 불가였던 "내 지원 현황" 링크 추가.
  * **색 토큰 체계**: 헨레 악보 모티프(종이 배경·음표 검정·표지 dove-blue). 시맨틱 토큰 15종 + 라이트/밤 두 팔레트. 하드코딩 색 227곳을 7개 도메인 병렬 작업으로 치환하고, 카드 배경·테두리 색을 신규 지정(Tailwind v4에서 bare border가 currentColor라 글자색을 따라가던 상태였음).
  * 브랜드 색은 대비 검증 후 2톤 분리(면 #4E6E8E / 텍스트 #3D5A80). 헤더만 다크에서 명암 반전(#8FB0CE + 어두운 글자, 7.9:1).
  * 안전장치 2종 추가: `npm run check:colors`(하드코딩 색·테두리 색 미지정 탐지), 라이트/다크 토큰 집합 일치 테스트.
  * 검증: 테스트 285 → **309 통과**, eslint 0 에러, `next build` 성공, **라이트/다크 실화면 확인**(헤더 반전·말풍선 구분·375px 두 줄 접힘·인증 화면 헤더 미노출).
  * 범위 밖: 사용자 테마 토글, 모바일 정식 이식(햄버거·a11y), 로그인/회원가입 레이아웃 개편.
* [x] (2026-08-18) 첫 실환경 통합 스모크 검증 — BE(8081)+MySQL+FE(3001) 동시 기동, 전 도메인 브라우저 실왕복.
  * 통과: 회원가입→로그인→대시보드(httpOnly 쿠키·미들웨어) / 프로필 조회·수정(악기 한글 라벨 변환·영속) / 피드 작성·좋아요·댓글(작성자 닉네임 배치 조회) / 인증연주자 신청→어드민 승인 / **공연 등록 게이팅 해제**(도메인 간 `isVerified` 파생 실동작) / 공연 등록(주최자 인증뱃지) / 구인 등록·지원·중복 409-08·수락 / 채팅 1:1 방 생성·실시간 송수신·읽음
  * 기동 환경 이슈 해결: 시스템 기본 JDK 25 → `JAVA_HOME`을 JDK 21로 고정 / 8080·3000을 다른 프로젝트가 점유 → BE 8081·FE 3001로 override(`FE/.env.local`, `.claude/launch.json` 추가)
  * 미포함: 카카오 실왕복(2026-07-15 검증 완료·앱 키 필요), 프로필 이미지 업로드(2026-07-16 라이브 검증 완료), S3
* [x] (2026-08-18) **[Critical] FE 채팅 실시간 수신 불가 결함 수정** (TDD) — `connect()` 직후 동기 `subscribeRoom()` 호출로 `@stomp/stompjs`가 예외(`There is no underlying STOMP connection`)를 던져 구독이 아예 걸리지 않던 문제.
  * 수정: `stompClient`가 구독 요청을 목록으로 보관하고 `onConnect`에서 실제 구독 → 연결 전 호출은 대기, **재연결 시 자동 재구독**(STOMP는 서버측 구독을 복구하지 않음), 해제분은 재구독 제외
  * 테스트가 못 잡은 이유: 목 `Client.subscribe`가 미연결 예외를 흉내내지 않음 → 목에 제약 추가해 RED 재현 후 수정(테스트 3개 신규)
  * 재검증: 브라우저에서 자기 전송분 즉시 표시 + 별도 STOMP 클라이언트가 보낸 메시지 실시간 도착. FE `vitest` 285/285 통과
* [x] (2026-08-18) [BE] 요청 파라미터 바인딩 실패가 500으로 응답되던 결함 수정 (TDD) — `MethodArgumentTypeMismatchException`(enum 변환 실패)·`MissingServletRequestParameterException`(필수 파라미터 누락)에 핸들러가 없어 catch-all로 떨어지던 것을 400-01로 매핑. 2026-07 `NoResourceFoundException` 건과 동일 계열. BE `test` 312/312 통과, 실환경 400 확인.
* [x] (2026-08-12) FE 구인(RECRUITMENT) 화면 구현 (TDD, 서브에이전트 주도 15태스크) — main 병합 완료. 공고 CRUD/목록/마감 + 지원 플로우 전체.
  * 페이지 5: /recruitments(scope 탭 OPEN/CLOSED/ALL·악기 필터·무한스크롤)/new(등록)/[id](상세·역할별 분기)/[id]/edit(수정)/applications/me(내 지원 현황·철회)
  * 상세 역할별 분기: 작성자→ApplicantList(지원자 첫 페이지·수락/거절)+수정·마감·삭제 / 비작성자·미마감→ApplyPanel(인라인 펼 토글) / 마감→안내. 지원 여부는 낙관적 제출+409 피드백(ALREADY_APPLIED 등 BE 메시지 노출)
  * 컴포넌트 6: InstrumentPicker(공용 프레젠테이셔널·폼+필터 재사용)/PostingForm(등록·수정 공용)/PostingCard/ApplyPanel/ApplicantList/ApplicationCard. AuthorBadge·useInfiniteList·toCursorPage(오프셋→커서)·canEdit/canDelete 재사용
  * BFF 8라우트(proxyAuthed, BE /api/recruitments/** 미러): 공고 목록/등록/상세/수정/삭제/마감 + 지원 POST·지원자목록·내지원(applications/me)·accept/reject/withdraw. 지원 액션 동적 세그먼트는 aid
  * 공연과 차이: 등록 게이팅 없음(로그인 회원 누구나), 포스터 없음, 다중 악기·모집인원·마감일(비우면 상시모집). 내 지원 응답에 공고 제목 없어 postingId 링크로 처리
  * 전 계층 TDD, 태스크별 독립 검증. 전체 vitest 183/183 통과, lint(구인 파일 0경고)·next build 통과
  * 범위 밖: 지원자 목록 20명 초과 페이지네이션, PostingCard 악기 라벨 변환(현재 enum명), 구직, CHAT 연계, 알림
* [x] (2026-08-12) FE 인증 연주자(VERIFIED-PERFORMER) 화면 구현 (TDD, 서브에이전트 주도 11태스크) — main 병합 완료. 회원 신청/상태 + 어드민 심사/직접지정 전체.
  * 페이지 2: `/verified-performer`(회원 — 상태별 분기: 신청/재신청 폼·심사중·승인·거절/철회+재신청) / `/admin/verified-performers`(어드민 — 신원 게이트·status 탭 무한스크롤·승인 즉시·거절/철회 인라인 사유·직접지정 grant)
  * 컴포넌트 5: EvidenceUrlsInput(동적 증빙 링크)/ApplyForm/MyStatusCard/ApplicationReviewItem/GrantForm. BFF 7라우트(회원 2 + 어드민 5, approve 무body). 프로필에 진입 링크 추가
  * 상태 규칙: 활성 신청(PENDING/APPROVED) 유일 → 종료(REJECTED/REVOKED)만 재신청. 어드민 액션 성공 시 목록 key 리마운트로 재조회
  * 제약: 응답에 memberId만 있어 어드민 목록은 "회원 #{id}" 표시(닉네임 없음 — BE 표시정보 확장 후속)
  * 전 계층 TDD, 태스크별 독립 검증. 전체 vitest 175/175·lint(verification 파일 0경고)·next build 통과. 최종 리뷰 반영(refreshKey 불필요 의존성 제거)
  * 범위 밖: 회원측 PENDING 취소(BE 없음), 어드민 목록 닉네임 표시, evidenceUrl URL 형식 검증
* [x] (2026-08-12) FE 채팅(CHAT) 화면 **MVP** 구현 (TDD, 서브에이전트 주도 7태스크) — main 병합 완료. 방 목록 + 대화창(실시간 송수신) + 1:1 시작 + 읽음.
  * 페이지 2: `/chat`(방 목록·안읽은 배지·회원 id로 새 대화)·`/chat/[id]`(대화창·이력+STOMP 실시간+읽음). 컴포넌트 4(RoomListItem/NewChatForm/MessageBubble/MessageComposer). BFF 5라우트(rooms/messages/read + 특수 ws-token).
  * 실시간: `@stomp/stompjs`(프로젝트 유일 라이브러리 예외)로 BE(`NEXT_PUBLIC_BE_WS_URL`)에 직접 STOMP 연결. CONNECT 토큰은 BFF `ws-token`이 httpOnly access 쿠키를 반환(WS 동안 토큰 JS 노출 — 승인된 트레이드오프). STOMP 로직은 `lib/chat/stompClient.ts`에 캡슐화. 자기 전송분 재수신은 `mergeMessages` id 중복 제거, typing 프레임 필터.
  * 태스크별 독립 검증. 전체 vitest 163/163·lint(chat 파일 0경고)·next build 통과. **WS 실왕복은 BE 기동 후 수동 검증 필요**(자동 테스트는 배선 목).
  * 범위 밖(후속): 그룹 생성·초대·퇴장, 타이핑, presence(online), 회원 검색, WS reissue 완전화, 알림.
* [x] (2026-08-02) FE 공연(PERFORMANCE) 화면 구현 (TDD, 서브에이전트 주도 8태스크) — 목록(scope 탭·무한스크롤)/등록(2단계 마법사·자격 게이팅)/상세/수정/포스터. useInfiniteList 오프셋 재사용(toCursorPage), proxyAuthed·AuthorBadge·canEdit/canDelete·신원 재사용. 브랜치 feature/performance-fe.
  * 범위 밖: 관심/북마크, 피드 카드 노출, 곡목 구조화, 좌석/예매, 공개 조회, 태그/장르 필터.
* [x] (2026-08-02) FE 피드(FEED) 화면 구현 (TDD, 서브에이전트 주도 13태스크) — 무한스크롤 타임라인/인라인 작성/상세·댓글/게시글·댓글 좋아요(낙관적+롤백)/수정·삭제. BE 선행: 신원 엔드포인트 GET /api/members/me. BFF 프록시 헬퍼(status||502) 신설. 브랜치 feature/feed-fe.
  * 범위 밖: 이미지 첨부/대댓글/댓글 수정/팔로우 타임라인/신고/PERFORMANCE 카드.
* [x] (2026-07-27) CHAT(채팅) BE 도메인 구현 (TDD, 서브에이전트 주도 14태스크) — main 병합 완료(커밋 `7b5cff4`)
  * 통합 방 모델: 1:1(DIRECT)+그룹(GROUP)을 "방+참여자" 한 모델로. 엔티티 3종 `ChatRoom`(type/title/createdBy/`directKey`(unique)/`lastMessageAt`(비정규화 정렬키)) + `ChatParticipant`(roomId/memberId 원시 Long, `leftAt` soft leave, `lastReadMessageId` 읽음커서, `(roomId,memberId)` unique) + `ChatMessage`(append-only, `(roomId,id)` 인덱스)
  * 1:1 유일성: 정렬 키 `directKey="min:max"` + DB unique + find-or-create. 동시 생성 경합은 insert를 `DirectRoomInitializer`(REQUIRES_NEW)로 격리해 바깥 트랜잭션 오염 없이 재조회(멱등)
  * 리포지토리 3종: `findByDirectKey`, 활성 참여 방 목록(오프셋 페이징, lastMessageAt desc), 메시지 커서 이력(id desc), 방별 마지막 메시지(`max(id) group by`)·안읽은 수(`countUnreadPerRoom` LEFT JOIN 배치, 호출측 참여검증 불변식) 집계 — 모두 IN 배치로 N+1 없음
  * 서비스 2종: `ChatRoomService`(생성 find-or-create/상세/초대(평평한 모델, 그룹만)/퇴장 soft leave/방 목록(안읽은수·마지막메시지·displayName 파생)/읽음), `ChatMessageService`(전송 영속화+lastMessageAt 갱신/커서 이력). 표시정보는 `MemberQueryService.findDisplaysByIds` 배치 재사용
  * REST `/api/chat/**` 7종 + WebSocket/STOMP: 엔드포인트 `/ws`, `enableSimpleBroker`(인메모리, Redis는 scale-out 시 교체), 인증은 CONNECT 프레임 JWT(`StompAuthChannelInterceptor` → Principal=memberId), SUBSCRIBE/SEND는 활성 참여자 인가(fail-closed). `ChatStompController`(send 브로드캐스트/typing 비영속), presence는 `PresenceRegistry`(연결수 카운팅, 인메모리·단일서버 한계) + 연결/해제 이벤트 브로드캐스트
  * 전역 `ErrorCode` 4종: `CHAT_ROOM_NOT_FOUND`(404-10)/`CHAT_MESSAGE_NOT_FOUND`(404-11)/`NOT_ROOM_PARTICIPANT`(403-03)/`CHAT_INVALID_PARTICIPANTS`(400-03, 400-02는 INVALID_FILE 점유)
  * WebSocket 통합 테스트: `@SpringBootTest(RANDOM_PORT)`+`WebSocketStompClient` 실연결 3종(유효토큰 송수신·무토큰 거절·비참여자 구독 ERROR 거절, 서버측 원예외 "참여자" 단언). 전 계층 TDD, 태스크마다 독립 리뷰(리뷰 지적 반영: DIRECT 경합 REQUIRES_NEW 격리·방목록 DIRECT 표시명 N+1 제거·테스트 단언 정밀화). 전체 `test` 307/307 통과
  * 범위 밖: FE 화면, 메시지 수정/삭제, 파일 첨부, 메시지 검색, 알림 푸시, 다중 서버 정확 presence·릴레이(Redis), 방장 권한/kick, 타 도메인 채팅 연계
* [x] (2026-07-23) RECRUITMENT(구인) BE 도메인 구현 (TDD, 서브에이전트 주도 8태스크)
  * 엔티티 2종: `RecruitmentPosting`(authorId=원시 Long, title/description/instruments(다중 악기 `@ElementCollection`, `@BatchSize`)/recruitCount/location/fee/deadline(nullable=상시)/status(OPEN/CLOSED), soft delete) + `RecruitmentApplication`(postingId/applicantId 원시 Long, message, 상태머신 PENDING→ACCEPTED/REJECTED/WITHDRAWN)
  * 리포지토리: 공고 scope별(open=OPEN·미마감 / closed=CLOSED·마감지남 / all) + `instrument` 필터(JPQL `member of`) + soft delete 필터; 지원 활성지원 존재판정(`existsBy...StatusIn` [PENDING,ACCEPTED]) + 공고별/지원자별 페이징. `deadline==now`는 CLOSED(경계 결정적 테스트)
  * 서비스 2종: `RecruitmentPostingService`(등록=인증 회원 누구나·게이팅 없음/조회/목록/수정=작성자/마감=작성자/삭제=작성자·ADMIN, `findActive` 재사용), `RecruitmentApplicationService`(지원=본인공고·마감·중복 게이팅/지원자목록=작성자/내지원목록/수락·거절=작성자/철회=지원자, guard 순서 확정)
  * 컨트롤러 2종(`/api/recruitments`): 공고 CRUD+마감, 지원 POST `{id}/applications`·GET `{id}/applications`(작성자)·GET `applications/me`·accept/reject/withdraw. 어드민 판정 principal 역할, 어드민 전용 경로 없음. size 기본 20/최대 50
  * MEMBER 협력: 작성자·지원자 표시(닉네임+인증뱃지)를 `MemberQueryService.findDisplaysByIds` 배치 재사용으로 파생(N+1 없음)
  * 전역 `ErrorCode` 6종: `RECRUITMENT_NOT_FOUND`(404-08)/`RECRUITMENT_APPLICATION_NOT_FOUND`(404-09)/`RECRUITMENT_CLOSED`(409-07)/`ALREADY_APPLIED`(409-08)/`CANNOT_APPLY_OWN_RECRUITMENT`(409-09)/`RECRUITMENT_INVALID_APPLICATION_STATE`(409-10)
  * 전 계층 TDD, 태스크마다 독립 리뷰(리뷰 지적 반영: 리포/서비스/컨트롤러 테스트 커버리지 보강 3회, deadline==now 경계 비결정성 수정). 최종 전체-브랜치 리뷰 Ready-with-fixes → instruments N+1을 `@BatchSize(100)`로 수정. 전체 `test` 266/266 통과
  * 범위 밖: 구직 공고, PERFORMANCE 연결, 지원 첨부파일, CHAT 연계, 키워드/태그 검색, 알림, 마감 자동화 배치, applicationCount 응답 필드, 공통 PageResponse DTO
* [x] (2026-07-22) PERFORMANCE(연주회) BE 도메인 구현 (TDD, 서브에이전트 주도 6태스크)
  * 엔티티 `Performance`(organizerId=원시 Long, title/description/performedAt(시작 일시)/venue/program(자유텍스트)/ticketInfo/ticketUrl/posterImageKey, soft delete)
  * 리포지토리: scope별 목록(upcoming=`performedAt>=now` asc / past=`<now` desc / all=desc, `deletedAt IS NULL` 필터) + 단건(active)
  * 서비스 `PerformanceService`: 등록(인증 연주자 또는 ADMIN — `isVerified` 협력, 아니면 403-02)/조회/목록/수정(주최자)/삭제(주최자·ADMIN)/포스터(주최자, image/*, 교체 시 옛파일 삭제 후행)
  * 컨트롤러(`/api/performances`): POST 등록·GET 목록(`?scope`+Pageable)·GET/{id}·PUT/{id}·DELETE/{id}·PUT/{id}/poster. 어드민 판정은 principal 역할, 어드민 전용 경로 없음. size 기본 20/최대 50
  * MEMBER 협력: 주최자 표시(닉네임+인증뱃지)를 `MemberQueryService.findDisplaysByIds` 배치 재사용으로 파생(N+1 없음). FileService(포스터)·VerifiedPerformerService(등록 자격) 재사용
  * 전역 `ErrorCode` 2종: `PERFORMANCE_NOT_FOUND`(404-07)/`NOT_VERIFIED_PERFORMER`(403-02)
  * 전 계층 TDD, 태스크마다 독립 리뷰, 최종 전체-브랜치 리뷰 MERGEABLE(Critical 0). 이연 Important: 목록 PageImpl 직렬화 경고 → 코드베이스 공통 PageResponse DTO는 BACKLOG. 전체 `test` 통과
* [x] (2026-07-17) FEED(피드) BE 도메인 구현 (TDD, 서브에이전트 주도 11태스크)
  * 엔티티 4종: `Post`/`Comment`(평면, soft delete) + `PostLike`/`CommentLike`(유니크, 멱등). 작성자는 원시 `authorId`(Long)
  * 리포지토리: id 기준 커서 keyset(타임라인 최신순 desc / 댓글 오래된순 asc), 배치 카운트(`GROUP BY ... IN :ids`)와 내 좋아요 집합 → 목록 N+1 방지(페이지당 고정 쿼리)
  * 서비스 3종: `FeedPostService`(작성/조회/타임라인/수정=작성자/삭제=작성자·ADMIN), `FeedCommentService`(작성/커서목록/삭제), `FeedLikeService`(게시글·댓글 좋아요·취소 멱등)
  * 좋아요 동시성: 유니크 제약 + `saveAndFlush`+`DataIntegrityViolationException` catch로 이중요청에도 멱등 200 보장(STATUTE §4)
  * 컨트롤러 3종(`/api/feed/**`): 어드민 판정은 principal 역할(`ROLE_ADMIN`)로, 어드민 전용 경로 없음. 커서 size 기본 20/최대 50
  * MEMBER 협력: `MemberQueryService.findDisplaysByIds`(닉네임+인증뱃지 배치 파생) 신설 + `VerifiedPerformerService.findVerifiedMemberIds`(승인 회원 배치) 추가 — fetch join 불가(도메인 경계상 연관 없음)라 서비스 협력+IN 배치로 처리
  * 전역 `ErrorCode` 2종: `POST_NOT_FOUND`(404-05)/`COMMENT_NOT_FOUND`(404-06)
  * 전 계층 TDD, 태스크마다 독립 리뷰(리뷰가 잡은 실버그: 좋아요 유니크 제약 컬럼명 camelCase→snake_case 정정), 최종 전체-브랜치 리뷰 MERGEABLE. 전체 `test` 통과
* [x] (2026-07-16) VERIFIED-PERFORMER(인증 연주자) BE 도메인 구현 (TDD)
  * 상태 머신 엔티티 `VerificationApplication`(PENDING/APPROVED/REJECTED/REVOKED) — `apply`/`grantByAdmin` 팩토리 + `approve`/`reject`/`revoke` 전이(종결 상태 재처리 시 `INVALID_APPLICATION_STATE`). `memberId`는 원시 Long(느슨한 결합), 재신청=새 레코드로 이력 보존
  * 리포지토리: `existsByMemberIdAndStatus`(활성 유일성·뱃지 판정), `findTop...OrderByCreatedAtDescIdDesc`(최신 신청 — createdAt 동률을 id로 타이브레이크해 결정적 정렬), `findByStatus...`(어드민 페이징)
  * 서비스 `VerifiedPerformerService`: 신청(활성 PENDING→409-04/APPROVED→409-05 거절), 승인/거절/철회, 어드민 직접지정, `isVerified`(APPROVED만 true)
  * 회원 API 2종: `POST /api/verified-performers/applications`, `GET /api/verified-performers/applications/me`(이력 없으면 200+data:null)
  * 어드민 API 5종(`/api/admin/**`, ROLE_ADMIN): 상태별 목록(`?status`+Pageable), `{id}/approve`(사유 선택)·`{id}/reject`·`{id}/revoke`(사유 필수), `grant`(직접지정)
  * 전역 `ErrorCode` 4종 추가: `VERIFICATION_ALREADY_PENDING`(409-04)/`VERIFICATION_ALREADY_APPROVED`(409-05)/`INVALID_APPLICATION_STATE`(409-06)/`APPLICATION_NOT_FOUND`(404-04)
  * MEMBER 통합: `ProfileResponse.verified` 추가, `MemberProfileService`가 `VerifiedPerformerService.isVerified`로 뱃지 파생(프로필 미생성 회원도 파생). 도메인 경계는 서비스 계층 협력만(엔티티 직접 참조 없음)
  * 엔티티/리포지토리/서비스/컨트롤러(회원·어드민) 전 계층 테스트, 전체 `test` 통과
* [x] (2026-07-15) FE Next.js 초기화 + 인증 플로우(BFF) (TDD, subagent-driven)
  * Next 16(App Router)/React 19/TS/Tailwind/Vitest 스캐폴딩, 위치 `FE/`
  * BFF 3계층: `lib/server/*`(beClient·cookies·session) / `app/api/bff/**`(signup·login·logout·me) / UI. 토큰은 httpOnly 쿠키, UI 미접근
  * 화면: 회원가입/로그인/대시보드(+루트 리다이렉트), `/dashboard`는 미들웨어 보호
  * reissue 1회 재시도(`session.ts`), 대시보드가 `/api/bff/me`(인증 프로브)로 전체 경로 검증
  * 통신은 네이티브 fetch(라이브러리 미도입). CORS는 BFF라 미추가
  * Vitest 단위 테스트(unwrap·cookies·beClient·session·bff·api·폼 스모크). 실BE 연동은 수동 검증
* [x] (2026-07-15) BE 런타임 DB(MySQL) + MEMBER 프로필/이미지 (TDD, subagent-driven)
  * 런타임 DB: 레포 루트 docker-compose(MySQL 8.4) + datasource env 기본값 + `ddl-auto: update`. 테스트는 `application-test.yaml`(H2) 프로파일 분리(`@SpringBootTest`에 `@ActiveProfiles("test")`)
  * `MemberProfile`(1:1 단방향, lazy upsert) + `Instrument` enum 21종(장르는 리뷰에서 제외, VOICE/VOCAL 분리)
  * API 4종: `GET/PUT /api/members/me/profile`, `PUT /api/members/me/profile/image`(image/* 검증, 교체 시 옛 파일 삭제), `GET /api/members/profile-options`
  * Bean Validation 도입 + 전역 예외 400 매핑 3건(@Valid 실패/본문 파싱 실패/파트 누락 — 기존 500 결함 수정), `MEMBER_NOT_FOUND`(404-03)
  * 파일 저장 계층(FileService)의 첫 실사용처
* [x] (2026-07-14) 파일 저장 기반(FileStorage) 구성 (TDD)
  * `global.storage`: `FileStorage`(인터페이스) / `LocalFileStorage`(기본) / `S3FileStorage`(AWS SDK v2) / `StorageProperties`
  * `FileService.upload(MultipartFile, String directory, Long uploaderId)` — key 생성(`{디렉터리}/{yyyy}/{MM}/{dd}/{UUID}.{확장자}`) + 저장 + `FileMetadata` 영속화를 한 트랜잭션으로 조합
  * `FileStorage`는 DB를 모른다(책임 분리). 도메인은 `FileService`만 사용
  * 접근 URL = `base-url + key` → CloudFront/R2 전환 시 설정 한 줄만 교체
  * 에러코드 4종 추가: `INVALID_FILE`(400-02), `FILE_NOT_FOUND`(404-01), `FILE_UPLOAD_FAILED`(500-02), `RESOURCE_NOT_FOUND`(404-02, 파일 전용 아닌 일반 코드). `BusinessException`에 cause 보존 생성자 추가
  * `SecurityConfig`에 `/files/**` permit 추가(로컬 파일 서빙)
  * 문서 충돌 해소: 메타데이터는 공용 `FileMetadata` 테이블로 결정 → `DOMAIN-COMMON-STATUTE §7` 개정
  * 리뷰 중 발견·수정한 버그 2건:
    1. 앱 전역 500→404 라우팅 버그 — 매칭되는 핸들러가 없는 모든 URL에서 Spring이 던지는 `NoResourceFoundException`이 `GlobalExceptionHandler`의 catch-all(`Exception.class`)에 걸려 500으로 응답되고 있었음. `RESOURCE_NOT_FOUND`(404-02) 전용 핸들러를 추가해 404로 정정(파일 저장 기능과 무관한 앱 전역 수정).
    2. key 생성의 확장자 파서가 dotfile(예: `.내파일`, 점이 index 0)에서 원본 파일명 전체를 key로 흘려보내던 버그 — "원본 파일명은 key에 넣지 않는다" 규칙을 깨고 한글이 공개 URL에 노출될 수 있었음. 점이 index 0이면 확장자 없음으로 처리하도록 수정.
  * 범위 밖: HTTP 업로드 엔드포인트(사용처인 MEMBER 프로필 이미지에서 구현), 실제 S3 연동 검증(자격증명 미발급), Presigned URL
* [x] (2026-07-13) MEMBER: 카카오 소셜 로그인 + 자체 로그인 loginId 전환 (TDD, subagent-driven)
  * 식별자 역할 분리: `loginId`(자체 로그인, unique·nullable) / `email`(인증·소셜연결 키, 전원 필수) / `nickname`(활동명) / 내부 신원 `id`
  * 자체 auth를 email→loginId 기반으로 개정(`SignupRequest{loginId,password,email,nickname}`, `login{loginId,password}`)
  * 카카오 소셜: `POST /api/auth/oauth/kakao{code,redirectUri}` — 프론트 인가코드→백엔드 교환(`OAuthClient`/`KakaoOAuthClient`), `SocialAccount`(provider+providerUserId 유니크)
  * 자동가입/자동연결: 검증된 이메일(is_email_verified)만 기존 회원 연결, 미검증 거절(계정 탈취 방지). nickname 충돌 시 유니크 생성
  * 에러코드 추가: `LOGIN_ID_ALREADY_EXISTS`(409-03), `OAUTH_EMAIL_UNVERIFIED`(401-08), `OAUTH_PROVIDER_ERROR`(502-01). `LOGIN_FAILED` 문구를 아이디 기준으로 정정
  * 카카오 키는 env 주입(`KAKAO_CLIENT_ID`/`KAKAO_CLIENT_SECRET`), 커밋 금지. 실제 카카오 HTTP는 운영 키로 수동 검증(자동 테스트는 매핑·로직만 Fake)
  * 브랜치 `feature/member-oauth2-social-login`, 태스크 6개 TDD + 태스크별 리뷰, 전체 `clean build` 통과
  * 범위 밖(BACKLOG): 구글 등 타 provider, 프로필/이미지, 실제 인증메일 발송
* [x] (2026-07-12) MEMBER 도메인: 자체 회원가입/로그인 (TDD)
  * `domain.member`: `Member`(엔티티, email/password/nickname/role), `MemberRepository`(existsByEmail·existsByNickname·findByEmail), `MemberService`(signup·login), `MemberAuthController`
  * 엔드포인트: `POST /api/auth/signup`, `POST /api/auth/login`(access+refresh 발급) — 기존 `/api/auth/**` permit 재사용(SecurityConfig 미변경)
  * 에러코드 전역 `ErrorCode`에 추가: `LOGIN_FAILED`(401-07), `EMAIL_ALREADY_EXISTS`(409-01), `NICKNAME_ALREADY_EXISTS`(409-02)
  * 비밀번호 BCrypt 해시 저장, 로그인 실패는 이메일/비번 구분 없이 401-07(정보 노출 방지)
  * 테스트: Member/Repository/Service(6)/Controller(4)/ErrorCode + 회귀 수정(SecurityConfigTest `@WebMvcTest` 범위 한정) → 전체 `clean build` 통과(43개)
  * 범위 밖(BACKLOG): 소셜 로그인(OAuth2), 프로필/이미지(FileStorage 의존)
* [x] (2026-07-11) BE 보안 기반(Security+JWT) 골격 구성 (TDD, 접근안 A)
  * `global.security`: `Role`(enum), `JwtProvider`/`JwtProperties`, `JwtAuthenticationFilter`, `SecurityConfig`(STATELESS), 핸들러 2종, `AuthController(/api/auth/reissue)`
  * access+refresh 무상태(refresh에도 role), 인증 ErrorCode 7종(401-01~06/403-01), jjwt 0.12.6
  * 테스트 5종(Role/ErrorCode/JwtProvider/Filter/SecurityConfig/AuthController) + 전체 `clean build` 통과
  * 커밋 `5a76833`·`184e19a`·`90b4427`·`287379d`·`6da73cf`
* [x] (2026-07-05) 전역 코드 리뷰 반영: `ErrorCode.resultCode`(int, HTTP 기반) 추가 + `ErrorBody(resultCode, code, message)` 응답 노출, Lombok `@Getter` 전환 (TDD, `clean build` 통과)
* [x] (2026-07-05) BE 전역(global) 기반 구성 (TDD)
  * `global.common.ApiResponse<T>` (성공/실패 공통 래퍼, nested `ErrorBody` record)
  * `global.common.BaseEntity` (`createdAt`/`updatedAt`, `@MappedSuperclass` + JPA Auditing)
  * `global.exception.ErrorCode`(enum, code=상수명), `BusinessException`, `GlobalExceptionHandler`(`@RestControllerAdvice`)
  * `global.config.JpaAuditingConfig` (`@EnableJpaAuditing`)
  * 테스트 4종(ApiResponse/BusinessException/GlobalExceptionHandler/BaseEntity) 및 전체 `clean build` 통과
* [x] (2026-07-05) `BE/build.gradle.kts` Spring Boot 4.1.0 → 3.4.5 재조정, 빌드 통과 확인
  * 4.x 전용 스타터 이름 수정: `-webmvc`→`-web`, 테스트 스타터 3종→`-test`+`spring-security-test`
  * Gradle 래퍼 9.5.1 → 8.11.1 (Boot 3.4 플러그인은 Gradle 9 미지원)
  * 테스트 컨텍스트 로딩용 H2(`testRuntimeOnly`) 추가 → `./gradlew clean build` BUILD SUCCESSFUL
* [x] (2026-07-05) 프로젝트 초기 설계 브레인스토밍 및 문서 체계 작성
  * ARCHITECTURE-CONSTITUTION / STATUTE
  * DOMAIN-COMMON-CONSTITUTION / STATUTE
  * DOMAIN-MEMBER-CONSTITUTION / STATUTE
  * TODO-*, CONTEXT, AI 기록 문서 초기화
