import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { postBffForm } = vi.hoisted(() => ({ postBffForm: vi.fn() }));

vi.mock('@/lib/api', () => ({ postBffForm }));

import { useTemporaryAttachments } from '@/lib/attachments/useTemporaryAttachments';

function file(name: string, type: string, size = 10) {
  return new File([new Uint8Array(size)], name, { type });
}

afterEach(() => {
  postBffForm.mockReset();
});

describe('임시 첨부 업로드', () => {
  it('허용하지 않는 형식은 첨부하지 않고 필드 오류를 남긴다', () => {
    const { result } = renderHook(() => useTemporaryAttachments());

    act(() => result.current.addFiles([file('notes.txt', 'text/plain')]));

    expect(result.current.items).toHaveLength(0);
    expect(result.current.error).toBe('JPG, PNG, WebP 또는 PDF 파일만 첨부할 수 있습니다.');
  });

  it('재시도할 때 이미 성공한 파일은 다시 업로드하지 않는다', async () => {
    postBffForm
      .mockResolvedValueOnce({ ok: true, data: { attachmentId: 11, url: 'https://files.example/a.png' }, message: null })
      .mockResolvedValueOnce({ ok: false, message: '두 번째 파일 업로드에 실패했습니다.' })
      .mockResolvedValueOnce({ ok: true, data: { attachmentId: 12, url: 'https://files.example/b.pdf' }, message: null });
    const { result } = renderHook(() => useTemporaryAttachments());

    act(() => result.current.addFiles([
      file('a.png', 'image/png'),
      file('b.pdf', 'application/pdf'),
    ]));

    let first;
    await act(async () => { first = await result.current.upload(); });
    expect(first).toEqual({ ok: false });
    expect(result.current.items.map((item) => item.attachmentId)).toEqual([11, undefined]);
    expect(result.current.items[1]).toMatchObject({
      status: 'failed',
      error: '두 번째 파일 업로드에 실패했습니다.',
    });

    let second;
    await act(async () => { second = await result.current.retry(result.current.items[1].clientId); });
    expect(second).toEqual({ ok: true, attachmentIds: [11, 12] });
    expect(postBffForm).toHaveBeenCalledTimes(3);
    expect(postBffForm.mock.calls[2][0]).toBe('/api/bff/files/attachments');
  });
});
