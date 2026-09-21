import { describe, it, expect } from "vitest";
import { formatEventRange } from "@/lib/format-datetime";

// A fixed IANA zone is passed explicitly rather than relying on the test
// runner's local timezone, which varies by machine/CI — see
// lib/format-datetime.ts's doc comment on why `timeZone` exists at all.
const ZONE = "America/Los_Angeles";

describe("formatEventRange", () => {
  it("renders a same-day range with one date and one timezone abbreviation", () => {
    const start = new Date("2026-09-21T16:00:00Z"); // 9:00 AM PDT
    const end = new Date("2026-09-21T16:30:00Z"); // 9:30 AM PDT

    expect(formatEventRange(start, end, ZONE)).toBe("Sep 21, 9:00 AM – 9:30 AM PDT");
  });

  it("renders a range crossing midnight with both dates, not just the first", () => {
    const start = new Date("2026-09-22T02:00:00Z"); // 7:00 PM PDT, Sep 21
    const end = new Date("2026-09-22T08:00:00Z"); // 1:00 AM PDT, Sep 22

    expect(formatEventRange(start, end, ZONE)).toBe("Sep 21, 7:00 PM – Sep 22, 1:00 AM PDT");
  });
});
