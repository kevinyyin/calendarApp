import { google, calendar_v3 } from "googleapis";

export type GoogleEvent = calendar_v3.Schema$Event;

function calendarClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  // Assigned directly (rather than via `auth.setCredentials(...)`) to match
  // `lib/google-calendar.ts`'s convention: `OAuth2Client#credentials` is
  // itself a plain public property that `setCredentials` just writes to —
  // this achieves the same result while keeping this module's unit tests
  // able to mock `google.auth.OAuth2` as a bare constructor without
  // reimplementing the real client's methods.
  auth.credentials = { access_token: accessToken };
  return google.calendar({ version: "v3", auth });
}

export async function fetchAllGoogleEvents(
  accessToken: string,
  googleCalendarId: string,
): Promise<{ items: GoogleEvent[]; nextSyncToken: string }> {
  const calendar = calendarClient(accessToken);
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  const items: GoogleEvent[] = [];

  do {
    const res = await calendar.events.list({
      calendarId: googleCalendarId,
      pageToken,
      singleEvents: true,
      maxResults: 250,
    });
    items.push(...(res.data.items ?? []));
    pageToken = res.data.nextPageToken ?? undefined;
    nextSyncToken = res.data.nextSyncToken ?? nextSyncToken;
  } while (pageToken);

  if (!nextSyncToken) {
    throw new Error("Google did not return a nextSyncToken on the final page");
  }

  return { items, nextSyncToken };
}

export async function fetchIncrementalGoogleEvents(
  accessToken: string,
  googleCalendarId: string,
  syncToken: string,
): Promise<{ items: GoogleEvent[]; nextSyncToken: string }> {
  const calendar = calendarClient(accessToken);
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  const items: GoogleEvent[] = [];

  do {
    const res = await calendar.events.list({
      calendarId: googleCalendarId,
      pageToken,
      syncToken: pageToken ? undefined : syncToken,
      singleEvents: true,
      maxResults: 250,
    });
    items.push(...(res.data.items ?? []));
    pageToken = res.data.nextPageToken ?? undefined;
    nextSyncToken = res.data.nextSyncToken ?? nextSyncToken;
  } while (pageToken);

  if (!nextSyncToken) {
    throw new Error("Google did not return a nextSyncToken on the final page");
  }

  return { items, nextSyncToken };
}
