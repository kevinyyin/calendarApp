"use client";

import { useEffect, useRef, useState } from "react";
import { findSlotsForCurrentUser } from "./find-slots-action";
import { Spinner } from "@/components/Spinner";
import { Badge } from "@/components/Badge";
import { formatEventRange } from "@/lib/format-datetime";

// "Find a time" is a repeated, specific-group task ("when can the four of us
// actually meet") per PRODUCT.md, not a one-off — re-checking the same
// friends on every visit is pure extraneous load. Persisted client-side only
// (a per-device convenience, not app state), so every read/write is
// try/catch-guarded and the form works identically if storage throws or is
// unavailable (private browsing, blocked site data, SSR).
const SELECTED_FRIENDS_STORAGE_KEY = "overlap.findTime.selectedFriends";

function loadSavedFriends(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SELECTED_FRIENDS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((v) => typeof v === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function saveSelectedFriends(selected: Set<string>) {
  try {
    window.localStorage.setItem(SELECTED_FRIENDS_STORAGE_KEY, JSON.stringify([...selected]));
  } catch {
    // Storage unavailable/blocked/full — the selection still works for this
    // session, it just won't be remembered next visit.
  }
}

export function FindTimeForm({ friendUsernames }: { friendUsernames: string[] }) {
  const [slots, setSlots] = useState<{ start: Date; end: Date }[]>([]);
  // Starts empty on both server and first client render — reading
  // localStorage has to wait for the mount effect below, or the value the
  // client hydrates with (from the browser's saved selection) would mismatch
  // the server-rendered markup (which never sees localStorage at all).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [duration, setDuration] = useState(60);
  const [hasSearched, setHasSearched] = useState(false);
  const [isPending, setIsPending] = useState(false);
  // Guards the save effect below from firing with the empty initial state
  // before the load effect has had a chance to populate it — otherwise the
  // very first commit would overwrite a real saved selection with "[]".
  const loadedFromStorage = useRef(false);

  useEffect(() => {
    const saved = loadSavedFriends();
    const validUsernames = new Set(friendUsernames);
    // react-hooks/set-state-in-effect prefers deriving state during render or
    // syncing via useSyncExternalStore, but localStorage is categorically
    // unreadable during SSR/first-paint — this one-time post-hydration read
    // is the standard escape hatch for exactly that case, and a full
    // external-store subscription would be needless weight for a per-device
    // "remember my last picks" convenience with no cross-tab requirement.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(new Set([...saved].filter((u) => validUsernames.has(u))));
    loadedFromStorage.current = true;
    // Deliberately mount-only: friendUsernames comes from the server and
    // doesn't change for the lifetime of this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loadedFromStorage.current) return;
    saveSelectedFriends(selected);
  }, [selected]);

  function toggleFriend(username: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(username)) {
        next.delete(username);
      } else {
        next.add(username);
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsPending(true);
    try {
      const result = await findSlotsForCurrentUser(
        [...selected],
        duration,
        // Only the browser knows where the viewer is; the server action
        // needs this to clip waking hours to their local day.
        new Date().getTimezoneOffset(),
      );
      setSlots(result);
      setHasSearched(true);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-16 sm:py-20">
      <div className="animate-rise-in">
        <div className="mb-10 flex flex-col gap-3">
          <Badge tone="outline" className="w-fit">
            Next two weeks
          </Badge>
          <h1 className="text-headline font-semibold text-foreground">Find a time</h1>
          <p className="max-w-md text-base leading-relaxed text-muted">
            Search the next two weeks for a slot that&apos;s free on everyone&apos;s
            calendar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-foreground">Friends</legend>
            <div className="flex flex-col gap-1 rounded-2xl border border-border bg-surface p-3 shadow-[var(--shadow-soft)]">
              {friendUsernames.map((username) => (
                <label
                  key={username}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-foreground transition-colors duration-150 hover:bg-surface-muted"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(username)}
                    onChange={() => toggleFriend(username)}
                    className="h-4 w-4 rounded border-border accent-accent"
                  />
                  {username}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-col gap-2">
            <label htmlFor="duration" className="text-sm font-medium text-foreground">
              Duration (minutes)
            </label>
            <input
              id="duration"
              type="number"
              min={1}
              max={480}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none transition-colors duration-200 focus:border-accent"
            />
            <p className="text-xs leading-relaxed text-muted">
              Only searches 8:00 AM – 10:00 PM in your local time each day.
            </p>
          </div>
          <button
            type="submit"
            disabled={isPending || selected.size === 0}
            className="rounded-full bg-accent px-5 py-3 text-sm font-medium text-accent-foreground shadow-[var(--shadow-soft)] transition duration-200 ease-[var(--ease-premium)] active:scale-[0.98] hover:opacity-90 hover:shadow-[var(--shadow-lifted)] disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2">
              {isPending && <Spinner className="h-3.5 w-3.5" />}
              {isPending ? "Finding slots…" : "Find slots"}
            </span>
          </button>
        </form>

        {hasSearched && slots.length === 0 && (
          <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-sm font-medium text-foreground">No free slots found</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              Nobody in that group has a mutual opening in the next two weeks.
              Try fewer friends or a shorter duration.
            </p>
          </div>
        )}

        {slots.length > 0 && (
          <ul className="mt-10 flex flex-col divide-y divide-border border-y border-border">
            {slots.map((slot, i) => (
              <li
                key={i}
                className="tabular-nums py-3.5 text-sm text-foreground first:pt-2.5 last:pb-2.5"
              >
                {formatEventRange(slot.start, slot.end)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
