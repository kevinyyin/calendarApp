import { google } from "googleapis";

// gaxios (the HTTP client under googleapis) defaults `timeout` to none and
// `retryConfig.totalTimeout` to `Number.MAX_SAFE_INTEGER` — i.e. a stalled or
// endlessly-retried request has no upper bound at all. Without this, a single
// slow/retryable Google API call can run for a server action's entire
// lifetime (we've seen this hit Vercel's hard 300s function timeout in
// production) instead of failing fast so callers can handle it.
const GOOGLE_REQUEST_OPTIONS = {
  timeout: 15_000,
  retryConfig: { retry: 2, totalTimeout: 20_000 },
};

function calendarClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  // Assigned directly (rather than via `auth.setCredentials(...)`) because
  // `OAuth2Client#credentials` is itself a plain public property that
  // `setCredentials` just writes to — this achieves the same result while
  // keeping `listGoogleCalendars`'s unit test able to mock `google.auth.OAuth2`
  // as a bare constructor without reimplementing the real client's methods.
  auth.credentials = { access_token: accessToken };
  return google.calendar({ version: "v3", auth });
}

export async function listGoogleCalendars(accessToken: string) {
  const calendar = calendarClient(accessToken);
  const res = await calendar.calendarList.list(undefined, GOOGLE_REQUEST_OPTIONS);
  return (res.data.items ?? []).map((item) => ({
    id: item.id!,
    summary: item.summary!,
    backgroundColor: item.backgroundColor ?? "#888888",
  }));
}
