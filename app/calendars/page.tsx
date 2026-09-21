import { getMyGoogleCalendars, getSharedCalendarIds, toggleShareCalendar } from "./actions";
import { auth } from "@/lib/auth";
import { getAcceptedFriendIds } from "@/lib/friendships";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

export default async function CalendarsPage() {
  const session = await auth();
  const calendars = await getMyGoogleCalendars();
  const shared = session?.user?.id
    ? await getSharedCalendarIds(session.user.id)
    : new Set<string>();
  const friendCount = session?.user?.id
    ? (await getAcceptedFriendIds(session.user.id)).length
    : 0;

  return (
    <main className="mx-auto max-w-lg px-6 py-10">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Your Google calendars</h1>
        <p className="mt-1 text-sm text-muted">
          Choose which calendars friends can see in your merged view. Everything
          else stays private.
        </p>
      </div>

      {calendars.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium text-foreground">No calendars found</p>
          <p className="mt-1 text-sm text-muted">
            We couldn&apos;t find any Google calendars for your account. Try
            reconnecting Google if this seems wrong.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {calendars.map((cal) => {
            const isShared = shared.has(cal.id);
            return (
              <li
                key={cal.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center text-sm text-foreground">
                    <span
                      aria-hidden="true"
                      className="mr-2.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: cal.backgroundColor }}
                    />
                    <span className="truncate">{cal.summary}</span>
                  </span>
                  {isShared && (
                    <span className="ml-5 text-xs text-muted">
                      {friendCount === 0
                        ? "Not visible to anyone yet — you have no friends"
                        : `Shared with ${friendCount} friend${friendCount === 1 ? "" : "s"}`}
                    </span>
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
                      className="rounded-md bg-accent-muted px-3 py-1.5 text-sm font-medium text-accent transition active:scale-95 hover:bg-accent-muted/70 disabled:opacity-50"
                    >
                      Sharing
                    </SubmitButton>
                  ) : (
                    <ConfirmSubmitButton
                      confirmMessage={`Share "${cal.summary}" with ${
                        friendCount === 0
                          ? "your friends (you don't have any yet)"
                          : `your ${friendCount} friend${friendCount === 1 ? "" : "s"}`
                      }? They'll be able to see its events in their merged view.`}
                      pendingText="Sharing…"
                      className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition active:scale-95 hover:opacity-90 disabled:opacity-50"
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
    </main>
  );
}
