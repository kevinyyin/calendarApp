"use client";

import { useState } from "react";
import { findSlotsForCurrentUser } from "./find-slots-action";

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
      const result = await findSlotsForCurrentUser(usernames, duration);
      setSlots(result);
      setHasSearched(true);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-4 text-xl font-semibold">Find a time</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          placeholder="friend usernames, comma-separated"
          value={friendUsernames}
          onChange={(e) => setFriendUsernames(e.target.value)}
          className="rounded border px-3 py-2"
        />
        <input
          type="number"
          min={1}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="rounded border px-3 py-2"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {isPending ? "Finding slots…" : "Find slots"}
        </button>
      </form>
      {hasSearched && slots.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">No mutual free slots found.</p>
      )}
      <ul className="mt-4 flex flex-col gap-2">
        {slots.map((slot, i) => (
          <li key={i} className="rounded border p-3">
            {slot.start.toLocaleString()} – {slot.end.toLocaleTimeString()}
          </li>
        ))}
      </ul>
    </main>
  );
}
