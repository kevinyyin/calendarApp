import { getMyGoogleCalendars, getSharedCalendarIds, toggleShareCalendar } from "./actions";
import { auth } from "@/lib/auth";
import { getAcceptedFriendIds } from "@/lib/friendships";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { Badge } from "@/components/Badge";

export default async function CalendarsPage() {
  const session = await auth();
  const calendars = await getMyGoogleCalendars();
  const shared = session?.user?.id
    ? await getSharedCalendarIds(session.user.id)
    : new Set<string>();
  const friendCount = session?.user?.id
    ? (await getAcceptedFriendIds(session.user.id)).length
    : 0;
  const sharedCount = calendars.filter((cal) => shared.has(cal.id)).length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
      <div className="animate-rise-in">
        <div className="mb-12 flex flex-col gap-3 sm:mb-16">
          <div className="flex flex-wrap gap-2">
            <Badge tone="outline">
              {sharedCount} of {calendars.length} shared
            </Badge>
            <Badge tone="outline">
              {friendCount} friend{friendCount === 1 ? "" : "s"}
            </Badge>
          </div>
          <h1 className="text-headline font-semibold text-foreground">
            Your Google calendars
          </h1>
          <p className="max-w-md text-base leading-relaxed text-muted">
            Choose which calendars friends can see in your merged view.
            Everything else stays private.
          </p>
        </div>

        {calendars.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-sm font-medium text-foreground">No calendars found</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              We couldn&apos;t find any Google calendars for your account. Try
              reconnecting Google if this seems wrong.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {calendars.map((cal) => {
              const isShared = shared.has(cal.id);
              return (
                <li
                  key={cal.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 py-5 first:pt-3 last:pb-3"
                >
                  <span className="flex min-w-0 flex-col gap-2">
                    <span className="flex items-center text-sm font-medium text-foreground">
                      <span
                        aria-hidden="true"
                        className="mr-2.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: cal.backgroundColor }}
                      />
                      <span className="truncate">{cal.summary}</span>
                    </span>
                    {isShared && (
                      <Badge tone="accent" className="ml-5 w-fit">
                        {friendCount === 0
                          ? "Not visible yet — no friends"
                          : `Shared with ${friendCount} friend${friendCount === 1 ? "" : "s"}`}
                      </Badge>
                    )}
                  </span>
                  <form action={toggleShareCalendar} className="shrink-0">
                    <input type="hidden" name="googleCalendarId" value={cal.id} />
                    <input type="hidden" name="displayName" value={cal.summary} />
                    <input type="hidden" name="color" value={cal.backgroundColor} />
                    <input type="hidden" name="enable" value={(!isShared).toString()} />
                    {isShared ? (
                      <SubmitButton
                        pendingText="Unsharing…"
                        className="rounded-full bg-danger-muted px-4 py-2 text-sm font-medium text-danger transition duration-200 ease-[var(--ease-premium)] active:scale-[0.98] hover:opacity-80 disabled:opacity-50"
                      >
                        Unshare
                      </SubmitButton>
                    ) : (
                      <ConfirmSubmitButton
                        confirmMessage={`Share "${cal.summary}" with ${
                          friendCount === 0
                            ? "your friends (you don't have any yet)"
                            : `your ${friendCount} friend${friendCount === 1 ? "" : "s"}`
                        }? They'll be able to see its events in their merged view — including any friend you add later.`}
                        confirmLabel="Yes, share"
                        variant="accent"
                        pendingText="Sharing…"
                        className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition duration-200 ease-[var(--ease-premium)] active:scale-[0.98] hover:opacity-90 disabled:opacity-50"
                      >
                        Share
                      </ConfirmSubmitButton>
                    )}
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
