import { RankedList } from '../components/RankedList';
import { useApp } from '../state';

export const DEFAULT_QUESTION = 'Which villages need evacuation support first?';

export function Primary() {
  const ranking = useApp((s) => s.ranking);
  const changed = useApp((s) => s.changed);
  const query = useApp((s) => s.query);
  const set = useApp((s) => s.set);

  const q = query.trim().toLowerCase();
  const filtering = q !== '' && q !== DEFAULT_QUESTION.toLowerCase();
  const recs = (ranking?.recommendations ?? []).filter(
    (r) =>
      !filtering || r.place_name.toLowerCase().includes(q) || r.taluka.toLowerCase().includes(q),
  );

  return (
    <div className="flex flex-col">
      <div className="px-4 pt-4 pb-3">
        <label className="flex h-14 items-center gap-2 rounded-xl border-2 border-ink bg-card px-3 focus-within:ring-4 focus-within:ring-info/30">
          <span aria-hidden="true" className="text-xl">
            ⌕
          </span>
          <span className="sr-only">Question, or type a village or taluka to filter</span>
          <input
            type="search"
            value={query}
            onChange={(e) => set({ query: e.target.value })}
            onFocus={(e) => query === DEFAULT_QUESTION && e.target.select()}
            placeholder={DEFAULT_QUESTION}
            className="h-12 min-w-0 flex-1 bg-transparent text-lg text-ink outline-none placeholder:text-ink-2"
          />
        </label>
        {filtering && (
          <button
            type="button"
            onClick={() => set({ query: DEFAULT_QUESTION })}
            className="mt-2 min-h-12 text-base font-semibold text-info underline"
          >
            Show all villages
          </button>
        )}
      </div>
      {!ranking ? (
        <p className="px-4 py-8 text-center text-lg text-ink-2">Loading ranked villages…</p>
      ) : (
        <RankedList recs={recs} changed={changed} onOpen={(id) => set({ selectedId: id })} />
      )}
    </div>
  );
}
