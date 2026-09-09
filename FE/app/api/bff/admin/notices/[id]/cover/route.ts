import { proxyAuthed } from '@/lib/server/bffProxy';
import type { IdParams } from '@/lib/server/routeParams';

/** 커버 이미지 교체. multipart 는 beFetch 가 content-type 을 붙이지 않는다(경계 문자열 때문). */
export async function PUT(request: Request, { params }: IdParams) {
  const { id } = await params;
  return proxyAuthed(`/api/admin/notices/${encodeURIComponent(id)}/cover`,
    { method: 'PUT', body: await request.formData() });
}
