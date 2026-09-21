"use client";

import { useState } from "react";
import { findSlotsForCurrentUser } from "./find-slots-action";
import { Spinner } from "@/components/Spinner";

export default function FindTimePage() {
  const [slots, setSlots] = useState<{ start: Date; end: Date }[]>([]);
  const [friendUsernames, setFriendUsernames] = useState("");
  const [duration, setDuration] = useState(60);
  const [hasSearched, setHasSearched] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const usernames = friendUsernames
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    setIsPending(true);
    try {
      const result = await findSlotsForCurrentUser(
        usernames,
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
    <main className="mx-auto max-w-lg px-6 py-10">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Find a time</h1>
        <p className="mt-1 text-sm text-muted">
          Search the next two weeks for a slot that&apos;s free on everyone&apos;s
          calendar.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="friend-usernames" className="text-sm font-medium text-foreground">
            Friends
          </label>
          <input
            id="friend-usernames"
            placeholder="e.g. alice, bob"
            value={friendUsernames}
            onChange={(e) => setFriendUsernames(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent"
          />
          <p className="text-xs text-muted">Comma-separated usernames.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="duration" className="text-sm font-medium text-foreground">
            Duration (minutes)
          </label>
          <input
            id="duration"
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="mt-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition active:scale-95 hover:opacity-90 disabled:opacity-50"
        >
          <span className="inline-flex items-center gap-2">
            {isPending && <Spinner className="h-3.5 w-3.5" />}
            {isPending ? "Finding slots…" : "Find slots"}
          </span>
        </button>
      </form>

      {hasSearched && slots.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium text-foreground">No free slots found</p>
          <p className="mt-1 text-sm text-muted">
            Nobody in that group has a mutual opening in the next two weeks.
            Try fewer friends or a shorter duration.
          </p>
        </div>
      )}

      {slots.length > 0 && (
        <ul className="mt-6 flex flex-col gap-2">
          {slots.map((slot, i) => (
            <li
              key={i}
              className="rounded-lg border border-border bg-surface p-3 text-sm text-foreground"
            >
              {slot.start.toLocaleString()} – {slot.end.toLocaleTimeString()}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
