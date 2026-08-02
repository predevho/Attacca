import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Mock 'server-only' for testing (Next.js built-in package)
vi.mock('server-only', () => ({}));

// jsdom에는 IntersectionObserver가 없다. 마지막 인스턴스의 콜백을 노출해
// 페이지 테스트에서 (globalThis as any).__io.trigger()로 교차를 시뮬레이션한다.
class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.callback = cb;
    (globalThis as unknown as { __io: MockIntersectionObserver }).__io = this;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  trigger() {
    this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}
(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = MockIntersectionObserver;
