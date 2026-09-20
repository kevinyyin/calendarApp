import { describe, it, expect, vi } from "vitest";

const watchMock = vi.fn().mockResolvedValue({
  data: { id: "chan-1", resourceId: "res-1", expiration: "1758300000000" },
});
const stopMock = vi.fn().mockResolvedValue({});

vi.mock("googleapis", () => ({
  google: {
    calendar: () => ({
      events: { watch: watchMock },
      channels: { stop: stopMock },
    }),
    auth: { OAuth2: vi.fn() },
  },
}));

import { registerWatchChannel, stopWatchChannel } from "@/lib/google-watch";

describe("registerWatchChannel", () => {
  it("calls events.watch and returns parsed expiration", async () => {
    const result = await registerWatchChannel(
      "token",
      "cal-id",
      "https://example.com/api/webhooks/google-calendar",
    );
    expect(watchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: "cal-id",
        requestBody: expect.objectContaining({
          type: "web_hook",
          address: "https://example.com/api/webhooks/google-calendar",
        }),
      }),
    );
    expect(result.channelId).toBe("chan-1");
    expect(result.resourceId).toBe("res-1");
    expect(result.expiresAt).toEqual(new Date(1758300000000));
  });
});

describe("stopWatchChannel", () => {
  it("calls channels.stop with the channel and resource id", async () => {
    await stopWatchChannel("token", "chan-1", "res-1");
    expect(stopMock).toHaveBeenCalledWith({
      requestBody: { id: "chan-1", resourceId: "res-1" },
    });
  });
});
