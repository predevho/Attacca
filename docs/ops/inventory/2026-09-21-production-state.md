# 2026-09-21 운영 상태

> 이 문서는 staging 폐기 뒤 현재 운영 경로를 기록한다. 2026-09-17 기준선은 당시 Terraform import 전 스냅샷이므로 수정하지 않는다.

## 공개 경로

| 역할 | 주소 | 확인 결과 |
|---|---|---|
| 웹 | `https://attacca.site` | HTTP 200, Cloudflare·Google DNS에서 A `216.198.79.1` |
| 웹 별칭 | `https://www.attacca.site` | Cloudflare·Google DNS에서 Vercel CNAME `335cd7f1e6a8d4bc.vercel-dns-017.com.` |
| API·WebSocket | `https://api.attacca.site` / `wss://api.attacca.site/ws` | 공개 API HTTP 200, Cloudflare·Google DNS에서 A `3.39.184.71` |
| staging | 사용하지 않음 | Cloudflare·Google DNS에서 A·CNAME 모두 미조회 |

## 배포와 runtime 경계

* Vercel Production이 웹을 제공한다. Vercel Domains에는 `attacca.site`, `www.attacca.site`, 기본 Vercel 도메인만 유지한다.
* EC2는 Spring BE, WebSocket, Redis, Nginx, 로컬 업로드 볼륨과 rollback 후보 `attacca-fe`를 유지한다. rollback FE는 별도 승인 전 제거하지 않는다.
* GitHub Actions는 `main`의 코드 변경을 검사한 뒤 BE·FE 이미지를 같은 커밋 SHA 라벨로 GHCR에 publish한다. EC2의 `attacca-update` 타이머는 새 이미지와 저장소 변경을 pull 방식으로 반영한다.
* 비밀값은 EC2 `/home/ubuntu/attacca/.env.prod`에서만 직접 관리한다. 저장소, 이미지, GitHub Actions 로그에는 넣지 않는다.

## 검증 상태

* `attacca.site` 홈과 `api.attacca.site/api/public/performances` 공개 응답을 확인했다.
* 운영 브라우저에서 카카오 로그인, 세션 유지, 보호 경로, WebSocket 채팅 연결과 메시지 입력창을 확인했다.
* EC2 BE는 `healthy` 상태로 확인했다. staging 폐기 때문에 BE만 재생성했고 Vercel 운영 FE는 변경하지 않았다.
* 2026-09-22 EC2 `attacca-update.timer`가 `enabled`·`active`이고 다음 실행이 예약된 것을 확인했다. 직후 `attacca-update.service`는 `Result=success`, `ExecMainStatus=0`으로 완료됐다.

## 남은 운영 과제

* 단일 BE 구조의 짧은 재기동을 무중단으로 바꾸려면 먼저 RabbitMQ 또는 ActiveMQ 같은 외부 STOMP broker relay와 공유 presence를 설계·구현한다. Redis는 STOMP relay의 직접 대상이 아니며 presence 보조 저장소 후보로만 검토한다.
* `be-uploads` 볼륨의 용량 정책과 S3 전환 가능 상태를 별도 검토한다.
