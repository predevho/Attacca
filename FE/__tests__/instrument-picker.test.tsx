import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InstrumentPicker } from '@/components/recruitment/InstrumentPicker';

const options = [{ code: 'PIANO', label: '피아노' }, { code: 'VIOLIN', label: '바이올린' }];

describe('InstrumentPicker', () => {
  it('옵션 라벨을 모두 렌더', () => {
    render(<InstrumentPicker options={options} selected={[]} onToggle={() => {}} />);
    expect(screen.getByText('피아노')).toBeInTheDocument();
    expect(screen.getByText('바이올린')).toBeInTheDocument();
  });

  it('클릭 시 해당 code로 onToggle 호출', () => {
    const onToggle = vi.fn();
    render(<InstrumentPicker options={options} selected={[]} onToggle={onToggle} />);
    fireEvent.click(screen.getByText('피아노'));
    expect(onToggle).toHaveBeenCalledWith('PIANO');
  });

  it('선택된 항목은 aria-pressed=true', () => {
    render(<InstrumentPicker options={options} selected={['VIOLIN']} onToggle={() => {}} />);
    expect(screen.getByText('바이올린').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('피아노').getAttribute('aria-pressed')).toBe('false');
  });
});
