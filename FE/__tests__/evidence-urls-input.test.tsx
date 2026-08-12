import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EvidenceUrlsInput } from '@/components/verification/EvidenceUrlsInput';

describe('EvidenceUrlsInput', () => {
  it('링크 추가 클릭 시 빈 항목이 추가된다', () => {
    const onChange = vi.fn();
    render(<EvidenceUrlsInput urls={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '링크 추가' }));
    expect(onChange).toHaveBeenCalledWith(['']);
  });

  it('입력 변경 시 해당 인덱스만 갱신', () => {
    const onChange = vi.fn();
    render(<EvidenceUrlsInput urls={['a', 'b']} onChange={onChange} />);
    fireEvent.change(screen.getAllByLabelText(/증빙 링크/)[1], { target: { value: 'B' } });
    expect(onChange).toHaveBeenCalledWith(['a', 'B']);
  });

  it('삭제 클릭 시 해당 항목 제거', () => {
    const onChange = vi.fn();
    render(<EvidenceUrlsInput urls={['a', 'b']} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('button', { name: '삭제' })[0]);
    expect(onChange).toHaveBeenCalledWith(['b']);
  });

  it('10개면 링크 추가 버튼 비활성', () => {
    render(<EvidenceUrlsInput urls={Array(10).fill('x')} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '링크 추가' })).toBeDisabled();
  });
});
