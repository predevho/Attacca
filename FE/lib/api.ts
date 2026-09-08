export type BffResult<T = unknown> = { ok: boolean; data?: T; message: string | null };

async function parse<T>(res: Response): Promise<BffResult<T>> {
  try {
    return (await res.json()) as BffResult<T>;
  } catch {
    return { ok: false, message: '응답을 해석할 수 없습니다.' };
  }
}

/**
 * fetch 자체가 reject하는 경우(오프라인, DNS 실패 등)까지 결과값으로 흡수한다.
 * 이게 없으면 호출부의 `.then(...)`이 unhandled rejection이 되고 화면이 로딩 상태로 영구히 멈춘다.
 * 모든 호출부가 이미 `ok === false`를 다루므로 반환 모양은 그대로다.
 */
async function request<T>(path: string, init: RequestInit): Promise<BffResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    return { ok: false, message: '서버에 연결할 수 없습니다.' };
  }
  return parse<T>(res);
}

/** 클라이언트 컴포넌트 전용: same-origin BFF만 호출한다. 토큰은 서버 쿠키에 있으므로 여기서 다루지 않는다. */
export async function postBff<T = unknown>(path: string, body?: unknown): Promise<BffResult<T>> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function getBff<T = unknown>(path: string): Promise<BffResult<T>> {
  return request<T>(path, { method: 'GET' });
}

export async function putBff<T = unknown>(path: string, body?: unknown): Promise<BffResult<T>> {
  return request<T>(path, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** multipart PUT. content-type을 지정하지 않아 브라우저가 boundary를 설정한다. */
export async function putBffForm<T = unknown>(path: string, form: FormData): Promise<BffResult<T>> {
  return request<T>(path, { method: 'PUT', body: form });
}

export async function deleteBff<T = unknown>(path: string): Promise<BffResult<T>> {
  return request<T>(path, { method: 'DELETE' });
}
