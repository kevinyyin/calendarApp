import { getMyGoogleCalendars, getSharedCalendarIds, toggleShareCalendar } from "./actions";
import { auth } from "@/lib/auth";

export default async function CalendarsPage() {
  const session = await auth();
  const calendars = await getMyGoogleCalendars();
  const shared = session?.user?.id
    ? await getSharedCalendarIds(session.user.id)
    : new Set<string>();

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-4 text-xl font-semibold">Your Google Calendars</h1>
      <ul className="flex flex-col gap-2">
        {calendars.map((cal) => {
          const isShared = shared.has(cal.id);
          return (
            <li key={cal.id} className="flex items-center justify-between rounded border p-3">
              <span>
                <span
                  className="mr-2 inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: cal.backgroundColor }}
                />
                {cal.summary}
              </span>
              <form action={toggleShareCalendar}>
                <input type="hidden" name="googleCalendarId" value={cal.id} />
                <input type="hidden" name="displayName" value={cal.summary} />
                <input type="hidden" name="color" value={cal.backgroundColor} />
                <input type="hidden" name="enable" value={(!isShared).toString()} />
                <button
                  type="submit"
                  className={`rounded px-3 py-1 text-sm ${
                    isShared ? "bg-slate-200" : "bg-slate-900 text-white"
                  }`}
                >
                  {isShared ? "Sharing" : "Share"}
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
