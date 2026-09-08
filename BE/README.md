# Attacca — 백엔드

Spring Boot 3.4.5 / Java 21 / MySQL. 서비스 전체 소개는 [루트 README](../README.md)를 보세요.

## 실행

```bash
# 레포 루트에서 MySQL 먼저
docker compose up -d

cd BE && ./gradlew bootRun
```

`http://localhost:8080`.

⚠️ **JDK 21이 필요합니다.** Gradle 8.11.1은 JDK 25에서 Kotlin DSL 컴파일에 실패하고,
에러가 `What went wrong: 25`로만 나와 원인을 찾기 어렵습니다. `JAVA_HOME`을 21로 맞추거나
`gradle.properties`에 `org.gradle.java.home`을 지정하세요(PC별 값이라 커밋 대상이 아닙니다).

시스템 환경변수 `DB_PASSWORD`가 이미 있으면 compose 기본값을 덮어써 접속이 거부됩니다.
그럴 땐 명령행이 이깁니다.

```bash
./gradlew bootRun "--args=--spring.datasource.password=attacca-local"
```

## 테스트

```bash
./gradlew test   # 373개
```

H2 `test` 프로파일에서 돕니다. **`@SpringBootTest`에는 `@ActiveProfiles("test")`를 반드시 붙이세요.**
없으면 MySQL에 접속하려다 실패합니다. `application-test.yaml`이 datasource와 저장소 루트를 덮어씁니다.

## 패키지

```
com.back
├── domain/{member,verifiedperformer,feed,performance,recruitment,chat,notice}
│   └── {controller,service,repository,entity,dto}
└── global
    ├── config      설정(Security·WebSocket·JPA·S3)
    ├── security    인증/인가, JWT, OAuth2
    ├── exception   전역 예외 처리, ErrorCode
    ├── common      BaseEntity, ApiResponse, PageResponse
    └── storage     FileStorage 인터페이스와 구현
```

도메인 간에는 **엔티티를 직접 참조하지 않고 서비스 계층으로만** 협력합니다.
계층 의존은 단방향(Controller → Service → Repository)이고 건너뛰지 않습니다.

## API 경로 규약

| 접두사 | 인증 | 비고 |
|---|---|---|
| `/api/auth/**` | 없음 | 가입·로그인·토큰 재발급·소셜 |
| `/api/public/**` | 없음 | **읽기 전용.** 이 아래에 쓰기를 두지 않습니다 |
| `/api/admin/**` | `ROLE_ADMIN` | 경로 자체로 게이팅(서비스 계층 판정 없음) |
| 그 외 `/api/**` | 필요 | |

**쿼리 파라미터 enum은 상수명 그대로 대문자**입니다(`?scope=UPCOMING`). 소문자를 보내면 400-01.

## 응답 형식

```jsonc
// 성공
{ "success": true, "data": { }, "error": null }
// 실패
{ "success": false, "data": null,
  "error": { "resultCode": "404-07", "code": "PERFORMANCE_NOT_FOUND", "message": "..." } }
```

`resultCode`는 `HTTP상태-일련번호` 문자열입니다. 전체 목록은 `global/exception/ErrorCode.java`.

## 규칙 문서

구현 전에 해당 도메인 문서를 먼저 읽으세요. 문서가 없는 도메인은 구현하지 않습니다.

- `docs/ARCHITECTURE-CONSTITUTION.md` · `docs/ARCHITECTURE-STATUTE.md`
- `docs/DOMAIN-COMMON-*.md`, `docs/DOMAIN-<도메인>-*.md`
