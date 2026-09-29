import { AlertIcon } from './Icons';

export function ConflictFlag() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-warn-bg px-2.5 py-1 text-base font-semibold text-medium-ink">
      <AlertIcon className="size-[18px]" />
      Sources disagree
    </span>
  );
}
