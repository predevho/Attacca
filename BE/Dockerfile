# --- 빌드 ---
# JDK 21 고정. Gradle 8.11.1은 JDK 25에서 Kotlin DSL 컴파일에 실패한다.
FROM gradle:8.11.1-jdk21 AS build
WORKDIR /src

# 의존성 레이어를 먼저 굳혀 소스만 바뀐 재빌드를 빠르게 한다.
COPY build.gradle.kts settings.gradle.kts ./
RUN gradle dependencies --no-daemon || true

COPY src ./src
# 테스트는 CI에서 이미 돌았다. 이미지 빌드에서 또 돌리지 않는다(MySQL 없이는 어차피 H2뿐).
RUN gradle bootJar --no-daemon -x test

# --- 실행 ---
FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app

# root로 돌리지 않는다.
#
# ⚠️ 업로드 디렉터리를 **이미지 안에서 미리 만들고 소유자를 넘겨야** 한다.
# 만들지 않고 VOLUME 만 선언하면 도커가 런타임에 root:root 로 만들어 버려,
# uid 10001 로 도는 앱이 한 글자도 쓰지 못한다. 운영에서 파일 업로드가
# 통째로 실패하고 있었다(2026-09-09 발견) — 아무도 올린 적이 없어 가려져 있었다.
RUN useradd --system --create-home --uid 10001 attacca \
 && mkdir -p /app/uploads \
 && chown attacca:attacca /app/uploads
USER attacca

COPY --from=build --chown=attacca:attacca /src/build/libs/*.jar app.jar

# storage.type=local일 때 업로드가 여기 쌓인다. 컨테이너를 새로 띄우면 사라지므로
# 운영에서는 볼륨을 붙이거나 storage.type=s3로 전환할 것.
#
# 새로 만드는 이름 있는 볼륨은 이미지의 이 디렉터리(소유자 포함)를 복사해 간다.
# **이미 만들어진 볼륨은 그대로 root 소유로 남으므로 한 번은 손으로 고쳐야 한다** —
# 방법은 docs/DEPLOY.md "업로드 디렉터리 권한" 참고.
VOLUME ["/app/uploads"]

EXPOSE 8080

# 컨테이너 메모리에 맞춰 힙을 잡는다(고정 -Xmx를 박지 않는다).
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75"

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
