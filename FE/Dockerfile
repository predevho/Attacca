# --- 의존성 ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- 빌드 ---
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* 은 빌드 시점에 번들에 박힌다. 런타임 env로는 바꿀 수 없으므로
# 빌드 인자로 받는다. (BE_BASE_URL은 서버에서만 읽히므로 런타임 env로 충분하다.)
ARG NEXT_PUBLIC_BE_WS_URL
ENV NEXT_PUBLIC_BE_WS_URL=$NEXT_PUBLIC_BE_WS_URL

RUN npm run build

# --- 실행 ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 10001 nodejs && adduser --system --uid 10001 nextjs
USER nextjs

# standalone 출력은 필요한 node_modules만 포함한다.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
