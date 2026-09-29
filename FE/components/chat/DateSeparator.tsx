export function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2" role="separator" aria-label={`${label} 메시지`}>
      <span className="h-px flex-1 bg-line" />
      <span className="text-xs text-ink-faint">{label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
