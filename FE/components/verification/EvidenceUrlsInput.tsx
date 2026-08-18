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
        <div key={i} className="flex gap-2">
          <input aria-label={`증빙 링크 ${i + 1}`} value={u} onChange={(e) => setAt(i, e.target.value)}
            placeholder="https://..." className="flex-1 rounded border border-line px-3 py-2 text-sm" />
          <button type="button" onClick={() => removeAt(i)} className="rounded border border-line px-3 py-1 text-xs">삭제</button>
        </div>
      ))}
      <button type="button" onClick={add} disabled={urls.length >= 10}
        className="self-start rounded border border-line px-3 py-1 text-xs disabled:opacity-40">링크 추가</button>
    </div>
  );
}
