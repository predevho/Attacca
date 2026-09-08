import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 컨테이너 배포용. .next/standalone 에 필요한 node_modules만 추려 담아
  // 런타임 이미지에 전체 의존성을 넣지 않아도 되게 한다.
  output: "standalone",
};

export default nextConfig;
