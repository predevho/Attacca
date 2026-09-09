import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Mock 'server-only' for testing (Next.js built-in package)
vi.mock('server-only', () => ({}));

// jsdom에는 IntersectionObserver가 없다.
//
// ⚠️ 이 목은 **observe()를 실제로 기록한다.** 예전 목은 observe()가 빈 함수였고
// trigger()가 관찰 여부와 무관하게 콜백을 불러서, "옵저버를 만들기만 하고
// 대상에 붙이지 않는" 결함을 테스트가 통과시켰다(2026-09-09 발견).
// 관찰 중인 대상이 없는 옵저버는 브라우저에서 절대 발화하지 않으므로 여기서도 발화하지 않는다.
class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  elements: Element[] = [];
  constructor(cb: IntersectionObserverCallback) {
    this.callback = cb;
    ioRegistry.instances.push(this);
  }
  observe(el: Element) { this.elements.push(el); }
  unobserve(el: Element) { this.elements = this.elements.filter((e) => e !== el); }
  disconnect() { this.elements = []; }
}

const ioRegistry = {
  instances: [] as MockIntersectionObserver[],
  /** 실제로 무언가를 관찰 중인 옵저버 수. 0이면 스크롤해도 아무 일도 일어나지 않는다. */
  get observing() { return ioRegistry.instances.filter((o) => o.elements.length > 0).length; },
  /** 관찰 중인 대상이 화면에 들어온 상황. 붙지 않은 옵저버는 건드리지 않는다. */
  trigger() {
    for (const o of ioRegistry.instances) {
      if (o.elements.length === 0) continue;
      o.callback([{ isIntersecting: true } as IntersectionObserverEntry],
        o as unknown as IntersectionObserver);
    }
  },
  reset() { ioRegistry.instances = []; },
};

(globalThis as unknown as { __io: typeof ioRegistry }).__io = ioRegistry;
(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = MockIntersectionObserver;
