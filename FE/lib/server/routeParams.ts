/**
 * 동적 BFF 라우트의 두 번째 인자 타입.
 *
 * `type Ctx = { params: Promise<{ id: string }> }`가 라우트마다 복붙돼 20곳에 흩어져 있었다.
 * Next의 규약이 바뀌면(예전에 params가 Promise가 된 것처럼) 20곳을 고쳐야 한다.
 */
export type IdParams = { params: Promise<{ id: string }> };

/** 지원(application) id를 받는 라우트. */
export type AidParams = { params: Promise<{ aid: string }> };
