import { describe, it, expect, vi } from "vitest";

const listMock = vi.fn().mockResolvedValue({
  data: {
    items: [
      { id: "primary", summary: "kevin@example.com", backgroundColor: "#123" },
      { id: "abc123@group.calendar.google.com", summary: "Work", backgroundColor: "#456" },
    ],
  },
});

vi.mock("googleapis", () => ({
  google: {
    calendar: () => ({ calendarList: { list: listMock } }),
    auth: { OAuth2: vi.fn() },
  },
}));

import { listGoogleCalendars } from "@/lib/google-calendar";

describe("listGoogleCalendars", () => {
  it("maps Google's calendarList response to a flat list", async () => {
    const result = await listGoogleCalendars("fake-access-token");
    expect(result).toEqual([
      { id: "primary", summary: "kevin@example.com", backgroundColor: "#123" },
      {
        id: "abc123@group.calendar.google.com",
        summary: "Work",
        backgroundColor: "#456",
      },
    ]);
    expect(listMock).toHaveBeenCalled();
  });
});
