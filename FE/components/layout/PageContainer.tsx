import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type PageWidth = 'content' | 'wide' | 'narrow';

const widthClass: Record<PageWidth, string> = {
  content: 'max-w-5xl',
  wide: 'max-w-6xl',
  narrow: 'max-w-3xl',
};

type PageContainerProps = ComponentPropsWithoutRef<'main'> & {
  children: ReactNode;
  width?: PageWidth;
};

export function PageContainer({
  children,
  className,
  width = 'content',
  ...props
}: PageContainerProps) {
  return (
    <main
      data-testid="page-container"
      className={`mx-auto w-full px-4 ${widthClass[width]}${className ? ` ${className}` : ''}`}
      {...props}
    >
      {children}
    </main>
  );
}
