import { proxyAuthed } from '@/lib/server/bffProxy';

/** 게시글 작성 전에 임시 첨부를 업로드한다. FormData boundary는 그대로 BE로 전달한다. */
export async function POST(request: Request) {
  return proxyAuthed('/api/files/attachments', {
    method: 'POST',
    body: await request.formData(),
  });
}
