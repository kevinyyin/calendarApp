import { google } from "googleapis";

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
  const res = await calendar.calendarList.list();
  return (res.data.items ?? []).map((item) => ({
    id: item.id!,
    summary: item.summary!,
    backgroundColor: item.backgroundColor ?? "#888888",
  }));
}
