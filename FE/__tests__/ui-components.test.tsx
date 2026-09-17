import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field } from '@/components/ui/Field';
import { StatusMessage } from '@/components/ui/StatusMessage';

describe('공통 UI 컴포넌트', () => {
  it('Button은 loading 중 비활성화하고 진행 상태를 알린다', () => {
    render(<Button loading>저장</Button>);
    expect(screen.getByRole('button', { name: '저장 중' })).toBeDisabled();
  });

  it('Field는 오류와 입력을 연결한다', () => {
    render(<Field label="출처 이름" error="출처 이름을 입력하세요"><input /></Field>);
    const input = screen.getByRole('textbox', { name: '출처 이름' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby');
    expect(screen.getByRole('alert')).toHaveTextContent('출처 이름을 입력하세요');
  });

  it('StatusMessage는 tone을 상태 role로 노출한다', () => {
    render(<StatusMessage tone="danger">불러오지 못했습니다.</StatusMessage>);
    expect(screen.getByRole('alert')).toHaveTextContent('불러오지 못했습니다.');
    expect(screen.getByRole('alert')).toHaveAttribute('data-tone', 'danger');
  });

  it('EmptyState는 빈 목록 안내와 선택적 행동을 보여준다', () => {
    render(<EmptyState title="항목이 없습니다." action={<Button>새로고침</Button>} />);
    expect(screen.getByText('항목이 없습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '새로고침' })).toBeInTheDocument();
  });
});
