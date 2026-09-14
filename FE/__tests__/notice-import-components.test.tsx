import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NoticeForm } from '@/components/notice/NoticeForm';
import { ImportItemList } from '@/components/imports/ImportItemList';
import { ImportSourceStatus } from '@/components/imports/ImportSourceStatus';
import type { NoticeFormValues } from '@/lib/notice/types';

const initial: NoticeFormValues = { type: 'NOTICE', title: '', content: '', scheduledAt: '', place: '', pinned: false, sourceName: '', sourceUrl: '' };

describe('NOTICE/IMPORT 공통 UI 적용', () => {
  it('NOTICE 출처 필드 오류가 접근 가능한 Field로 표시된다', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    render(<NoticeForm initial={{ ...initial, sourceUrl: 'https://example.com' }} submitLabel="저장" pending={false} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(screen.getByRole('textbox', { name: '출처 이름' })).toHaveAttribute('aria-invalid', 'true');
  });

  it('IMPORT 실행 중 버튼은 loading 상태를 보여준다', () => {
    render(<ImportSourceStatus source="KOPIS" pending run={undefined} onRun={vi.fn()} />);
    expect(screen.getByRole('button', { name: '실행 중' })).toBeDisabled();
  });

  it('IMPORT 목록이 비어 있으면 빈 상태를 보여준다', () => {
    render(<ImportItemList items={[]} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText('반입 항목이 없습니다.')).toBeInTheDocument();
  });
});
