import { Spinner } from "@/components/Spinner";

export function PageLoading() {
  return (
    <div className="flex flex-1 items-center justify-center gap-2 py-20 text-sm text-muted">
      <Spinner className="h-4 w-4" />
      Loading…
    </div>
  );
}
