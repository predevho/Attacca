export function EvidenceUrlsInput({
  urls, onChange,
}: {
  urls: string[];
  onChange: (urls: string[]) => void;
}) {
  function setAt(i: number, value: string) {
    onChange(urls.map((u, idx) => (idx === i ? value : u)));
  }
  function removeAt(i: number) {
    onChange(urls.filter((_, idx) => idx !== i));
  }
  function add() {
    if (urls.length >= 10) return;
    onChange([...urls, '']);
  }
  return (
    <div className="flex flex-col gap-2">
      {urls.map((u, i) => (
        <div key={i} className="flex min-w-0 flex-col gap-2 sm:flex-row">
          <input aria-label={`증빙 링크 ${i + 1}`} value={u} onChange={(e) => setAt(i, e.target.value)}
            placeholder="https://..." className="min-w-0 flex-1 rounded border border-line px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" />
          <button type="button" onClick={() => removeAt(i)} className="min-h-10 rounded border border-line px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">삭제</button>
        </div>
      ))}
      <button type="button" onClick={add} disabled={urls.length >= 10}
        className="min-h-10 self-start rounded border border-line px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-40">링크 추가</button>
    </div>
  );
}
