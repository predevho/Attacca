import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { PageContainer } from '@/components/layout/PageContainer';

describe('PageContainer', () => {
  test('keeps ordinary content in the shared readable-width frame', () => {
    render(<PageContainer>콘텐츠</PageContainer>);

    const container = screen.getByTestId('page-container');
    expect(container).toHaveClass('mx-auto', 'w-full', 'max-w-5xl', 'px-4');
    expect(container).toHaveTextContent('콘텐츠');
  });

  test('allows focused pages to opt into a wider frame', () => {
    render(<PageContainer width="wide">대화</PageContainer>);

    expect(screen.getByTestId('page-container')).toHaveClass('max-w-6xl');
  });
});
