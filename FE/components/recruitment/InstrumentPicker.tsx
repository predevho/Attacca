import type { InstrumentOption } from '@/lib/recruitment/types';

export function InstrumentPicker({
  options, selected, onToggle,
}: {
  options: InstrumentOption[];
  selected: string[];
  onToggle: (code: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o.code);
        return (
          <button key={o.code} type="button" aria-pressed={on} onClick={() => onToggle(o.code)}
            className={`rounded-full px-3 py-1 text-sm ${on ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
