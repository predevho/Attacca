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
RUN useradd --system --create-home --uid 10001 attacca
USER attacca

COPY --from=build --chown=attacca:attacca /src/build/libs/*.jar app.jar

# storage.type=local일 때 업로드가 여기 쌓인다. 컨테이너를 새로 띄우면 사라지므로
# 운영에서는 볼륨을 붙이거나 storage.type=s3로 전환할 것.
VOLUME ["/app/uploads"]

EXPOSE 8080

# 컨테이너 메모리에 맞춰 힙을 잡는다(고정 -Xmx를 박지 않는다).
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75"

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
