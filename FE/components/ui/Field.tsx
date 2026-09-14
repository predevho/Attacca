import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const describedBy = error || hint ? descriptionId : undefined;
  const input = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })
    : children;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label htmlFor={id}>{label}</label>
      {input}
      {(error || hint) && <span id={descriptionId} role={error ? 'alert' : undefined} className={error ? 'text-xs text-danger' : 'text-xs text-ink-faint'}>{error ?? hint}</span>}
    </div>
  );
}
