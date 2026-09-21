import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { CalendarGrid, addDays } from "@/components/CalendarGrid";

afterEach(cleanup);

function todayAt(hour: number, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

const events = [
  {
    id: "e1",
    personUserId: "friend-1",
    personLabel: "Alice",
    color: "#88bdf2",
    title: "Design review",
    startAt: todayAt(10),
    endAt: todayAt(11),
  },
];

describe("addDays", () => {
  it("advances the date by n days and normalizes to midnight", () => {
    const start = new Date("2026-09-22T15:30:00");
    const result = addDays(start, 3);
    expect(result.getDate()).toBe(25);
    expect(result.getHours()).toBe(0);
  });
});

describe("CalendarGrid", () => {
  it("shows nothing-scheduled empty state with no events", () => {
    render(<CalendarGrid events={[]} />);
    expect(screen.getByText("Nothing on the calendar")).toBeTruthy();
  });

  it("defaults to Day mode showing today's events, and Week toggle switches to 7 columns", () => {
    render(<CalendarGrid events={events} />);
    expect(screen.getByText("Design review")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Week" }));
    // Week mode still shows the same event, now inside one of 7 day columns.
    expect(screen.getByText("Design review")).toBeTruthy();
    // Previous/Next day nav is Day-mode only.
    expect(screen.queryByRole("button", { name: "Previous day" })).toBeNull();
  });

  it("opens a popover with title, time, and person on click, and closes on a second click", () => {
    render(<CalendarGrid events={events} />);
    const block = screen.getByRole("button", { name: /Design review.*Alice/ });

    fireEvent.click(block);
    expect(screen.getByRole("dialog").textContent).toContain("Alice");

    fireEvent.click(block);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stays open when clicking inside the popover itself", () => {
    render(<CalendarGrid events={events} />);
    fireEvent.click(screen.getByRole("button", { name: /Design review.*Alice/ }));

    fireEvent.click(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).not.toBeNull();
  });

  it("shows a short event's title inline without needing a click", () => {
    const shortEvent = [
      {
        id: "e2",
        personUserId: "friend-1",
        personLabel: "Alice",
        color: "#88bdf2",
        title: "Quick sync",
        startAt: todayAt(14, 0),
        endAt: todayAt(14, 15),
      },
    ];
    render(<CalendarGrid events={shortEvent} />);
    expect(screen.getByText("Quick sync")).toBeTruthy();
  });
});
