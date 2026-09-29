export function ConflictFlag() {
  return (
    <span className="inline-flex h-8 items-center gap-1 rounded-md border-2 border-medium bg-warn-bg px-2 text-base font-semibold text-ink">
      <span aria-hidden="true">⚠</span> Sources disagree
    </span>
  );
}
