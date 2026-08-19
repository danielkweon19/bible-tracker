import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReadingSession } from "../types";
import { History, Insights } from "./DashboardViews";

describe("Insights", () => {
  it("combines the reading summary, patterns, and trend in one view", () => {
    const onRead = vi.fn();
    render(<Insights sessions={[]} firstName="Daniel" onRead={onRead} />);

    expect(screen.getByRole("heading", { name: "Your reading insights" })).toBeInTheDocument();
    expect(screen.getByText("This week")).toBeInTheDocument();
    expect(screen.getByText("Most-read book")).toBeInTheDocument();
    expect(screen.getByText("Last 7 days")).toBeInTheDocument();
    expect(screen.getByText("Reading pace")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /continue reading/i }));
    expect(onRead).toHaveBeenCalledOnce();
  });
});

describe("History", () => {
  const session: ReadingSession = {
    id: "session-1",
    uid: "reader-1",
    durationSeconds: 300,
    chapters: ["John 1"],
    verseCount: 51,
    createdAt: new Date("2026-08-19T12:00:00Z")
  };

  it("clears all history from the page action", () => {
    const onClear = vi.fn();
    render(<History sessions={[session]} onDelete={vi.fn()} onClear={onClear} />);

    fireEvent.click(screen.getByRole("button", { name: /clear history/i }));

    expect(onClear).toHaveBeenCalledOnce();
  });

  it("reveals an individual delete action with a left swipe", () => {
    const onDelete = vi.fn();
    const { container } = render(
      <History sessions={[session]} onDelete={onDelete} onClear={vi.fn()} />
    );
    const row = container.querySelector(".session-row");

    expect(row).not.toBeNull();
    fireEvent.touchStart(row!, {
      touches: [{ clientX: 240, clientY: 80 }]
    });
    fireEvent.touchEnd(row!, {
      changedTouches: [{ clientX: 100, clientY: 84 }]
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete John 1" }));

    expect(onDelete).toHaveBeenCalledOnce();
  });
});
