import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdminPageFrame } from '@/components/admin/AdminPageFrame';

describe('AdminPageFrame', () => {
  it('기본 폭에서 제목과 설명을 제공한다', () => {
    render(
      <AdminPageFrame title="공지 관리" description="운영 공지를 관리합니다.">
        목록
      </AdminPageFrame>,
    );

    expect(screen.getByRole('main')).toHaveClass('mx-auto', 'w-full', 'max-w-5xl', 'px-4');
    expect(screen.getByRole('heading', { name: '공지 관리' })).toBeInTheDocument();
    expect(screen.getByText('운영 공지를 관리합니다.')).toBeInTheDocument();
  });

  it('집중형 폭과 제목 행동을 제공한다', () => {
    render(
      <AdminPageFrame title="공지 등록" width="narrow" action={<button type="button">등록</button>}>
        폼
      </AdminPageFrame>,
    );

    expect(screen.getByRole('main')).toHaveClass('max-w-3xl');
    expect(screen.getByRole('button', { name: '등록' })).toBeInTheDocument();
  });
});
