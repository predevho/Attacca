import type { ReactNode } from 'react';

type AdminPageWidth = 'default' | 'narrow';

const widthClass: Record<AdminPageWidth, string> = {
  default: 'max-w-5xl',
  narrow: 'max-w-3xl',
};

type AdminPageFrameProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  width?: AdminPageWidth;
  children: ReactNode;
  className?: string;
};

export function AdminPageFrame({
  title,
  description,
  action,
  width = 'default',
  children,
  className,
}: AdminPageFrameProps) {
  return (
    <main className={`mx-auto w-full px-4 py-10 ${widthClass[width]}${className ? ` ${className}` : ''}`}>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {description && <p className="mt-2 text-sm text-ink-muted">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </main>
  );
}
