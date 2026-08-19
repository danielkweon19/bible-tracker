import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ActiveReading, BibleData } from "../types";
import { Reader } from "./Reader";

const bible: BibleData = {
  version: "Test",
  books: [{
    name: "John",
    chapters: [
      { verses: [{ num: 1, text: "In the beginning." }] },
      { verses: [{ num: 1, text: "The next chapter." }] }
    ]
  }]
};

beforeAll(() => {
  Object.defineProperty(Element.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn()
  });
});

function renderReader(active: ActiveReading, saving = false) {
  const onStop = vi.fn();
  const onFinish = vi.fn();
  const onLocation = vi.fn();

  const result = render(
    <Reader
      bible={bible}
      location={{ bookIndex: 0, chapterIndex: 0 }}
      active={active}
      onLocation={onLocation}
      onStart={vi.fn()}
      onStop={onStop}
      onFinish={onFinish}
      saving={saving}
      onDiscard={vi.fn()}
    />
  );

  return { ...result, onStop, onFinish, onLocation };
}

describe("reading timer", () => {
  it("shows a stop control without rendering a live duration", () => {
    const { onStop } = renderReader({ startedAt: Date.now() - 125_000, chapters: [] });

    expect(screen.getByText("Reading in progress")).toBeInTheDocument();
    expect(screen.queryByText("Final time")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /complete/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /stop timer/i }));

    expect(onStop).toHaveBeenCalledOnce();
  });

  it("shows the frozen final duration before saving", () => {
    const { onFinish } = renderReader({
      startedAt: 1_000,
      stoppedAt: 126_000,
      chapters: []
    });

    expect(screen.getByText("Final time")).toBeInTheDocument();
    expect(screen.getByText("02:05")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /stop timer/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /save session/i }));

    expect(onFinish).toHaveBeenCalledOnce();
  });

  it("disables the save action while the session is being saved", () => {
    renderReader({ startedAt: 1_000, stoppedAt: 126_000, chapters: [] }, true);

    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
  });

  it("moves to the next chapter with a horizontal swipe", () => {
    const { container, onLocation } = renderReader({
      startedAt: 1_000,
      chapters: ["John 1"]
    });
    const reader = container.querySelector(".reader-scroll");

    expect(reader).not.toBeNull();
    fireEvent.touchStart(reader!, {
      touches: [{ clientX: 240, clientY: 120 }]
    });
    fireEvent.touchEnd(reader!, {
      changedTouches: [{ clientX: 80, clientY: 125 }]
    });

    expect(onLocation).toHaveBeenCalledWith({ bookIndex: 0, chapterIndex: 1 });
  });
});
