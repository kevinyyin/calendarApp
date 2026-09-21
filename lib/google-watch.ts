import { google } from "googleapis";
import { randomUUID } from "crypto";

// See lib/google-calendar.ts for why this is necessary: gaxios has no
// default request timeout and an effectively unbounded retry budget
// (`totalTimeout` defaults to `Number.MAX_SAFE_INTEGER`).
const GOOGLE_REQUEST_OPTIONS = {
  timeout: 15_000,
  retryConfig: { retry: 2, totalTimeout: 20_000 },
};

function calendarClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  // Assigned directly (rather than via `auth.setCredentials(...)`) to match
  // `lib/google-calendar-events.ts`'s convention: `OAuth2Client#credentials`
  // is itself a plain public property that `setCredentials` just writes to —
  // this achieves the same result while keeping this module's unit tests
  // able to mock `google.auth.OAuth2` as a bare constructor without
  // reimplementing the real client's methods.
  auth.credentials = { access_token: accessToken };
  return google.calendar({ version: "v3", auth });
}

export async function registerWatchChannel(
  accessToken: string,
  googleCalendarId: string,
  webhookUrl: string,
) {
  const calendar = calendarClient(accessToken);
  const res = await calendar.events.watch(
    {
      calendarId: googleCalendarId,
      requestBody: {
        id: randomUUID(),
        type: "web_hook",
        address: webhookUrl,
      },
    },
    GOOGLE_REQUEST_OPTIONS,
  );
  return {
    channelId: res.data.id!,
    resourceId: res.data.resourceId!,
    expiresAt: new Date(Number(res.data.expiration)),
  };
}

export async function stopWatchChannel(
  accessToken: string,
  channelId: string,
  resourceId: string,
) {
  const calendar = calendarClient(accessToken);
  await calendar.channels.stop(
    { requestBody: { id: channelId, resourceId } },
    GOOGLE_REQUEST_OPTIONS,
  );
}
