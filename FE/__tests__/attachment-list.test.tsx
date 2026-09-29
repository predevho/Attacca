import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { AttachmentList } from '@/components/files/AttachmentList';

const attachments = [
  {
    id: 1,
    originalName: 'score.png',
    contentType: 'image/png',
    size: 2048,
    url: 'https://files.example/score.png',
  },
  {
    id: 2,
    originalName: 'resume.pdf',
    contentType: 'application/pdf',
    size: 4096,
    url: 'https://files.example/resume.pdf',
  },
];

describe('AttachmentList', () => {
  test('renders image attachments as inline previews and documents as links', () => {
    render(<AttachmentList attachments={attachments} />);

    expect(screen.getByRole('img', { name: 'score.png' })).toHaveAttribute('src', 'https://files.example/score.png');
    expect(screen.getByRole('button', { name: 'score.png 미리보기' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /resume\.pdf/ })).toHaveAttribute(
      'href',
      'https://files.example/resume.pdf',
    );
  });

  test('opens an image preview dialog and closes it with Escape', () => {
    render(<AttachmentList attachments={attachments} />);

    fireEvent.click(screen.getByRole('button', { name: 'score.png 미리보기' }));

    expect(screen.getByRole('dialog', { name: 'score.png 미리보기' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'score.png 원본' })).toHaveAttribute(
      'src',
      'https://files.example/score.png',
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'score.png 미리보기' })).not.toBeInTheDocument();
  });
});
