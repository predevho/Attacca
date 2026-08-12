import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApplicantList } from '@/components/recruitment/ApplicantList';
import type { Application } from '@/lib/recruitment/types';

const apps: Application[] = [
  { id: 1, postingId: 7, applicant: { id: 2, nickname: '지원자1', verified: false }, message: '잘 부탁드립니다', status: 'PENDING', createdAt: '', updatedAt: '' },
  { id: 2, postingId: 7, applicant: { id: 3, nickname: '지원자2', verified: true }, message: '경력 5년', status: 'ACCEPTED', createdAt: '', updatedAt: '' },
];

describe('ApplicantList', () => {
  it('지원자와 메시지·상태 표시', () => {
    render(<ApplicantList applications={apps} onAccept={() => {}} onReject={() => {}} />);
    expect(screen.getByText('지원자1')).toBeInTheDocument();
    expect(screen.getByText('잘 부탁드립니다')).toBeInTheDocument();
    expect(screen.getByText('수락됨')).toBeInTheDocument();
  });

  it('PENDING만 수락/거절 버튼', () => {
    render(<ApplicantList applications={apps} onAccept={() => {}} onReject={() => {}} />);
    expect(screen.getAllByRole('button', { name: '수락' })).toHaveLength(1);
  });

  it('수락 클릭 시 해당 지원 id로 onAccept', () => {
    const onAccept = vi.fn();
    render(<ApplicantList applications={apps} onAccept={onAccept} onReject={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '수락' }));
    expect(onAccept).toHaveBeenCalledWith(1);
  });

  it('지원자 없으면 안내', () => {
    render(<ApplicantList applications={[]} onAccept={() => {}} onReject={() => {}} />);
    expect(screen.getByText('아직 지원자가 없습니다.')).toBeInTheDocument();
  });
});
