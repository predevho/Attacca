import type { ReactNode } from 'react';

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <section className="py-10 text-center"><h2 className="font-medium">{title}</h2>{description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}{action && <div className="mt-4">{action}</div>}</section>;
}
