import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./hooks/useAppUpdate", () => ({
  useAppUpdate: vi.fn()
}));

vi.mock("./hooks/useAuth", () => ({
  useAuth: () => ({ user: null, loading: false })
}));

vi.mock("./hooks/useBible", () => {
  const bible = {
    version: "Test",
    books: Array.from({ length: 43 }, (_, index) => ({
      name: index === 42 ? "John" : `Book ${index + 1}`,
      chapters: [{ verses: [{ num: 1, text: "In the beginning." }] }]
    }))
  };

  return {
    useBible: () => ({ bible, error: null })
  };
});

vi.mock("./lib/firebase", () => ({
  auth: null,
  db: null,
  isFirebaseConfigured: true
}));

beforeAll(() => {
  Object.defineProperty(Element.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn()
  });
});

beforeEach(() => {
  window.history.replaceState(null, "", "/?demo=1");
  window.localStorage.clear();
});

describe("reading session timer", () => {
  it("freezes the duration when stopped and saves that final time", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /start session/i }));
    now.mockReturnValue(126_000);
    fireEvent.click(screen.getByRole("button", { name: /stop timer/i }));

    expect(screen.getByText("Final time")).toBeInTheDocument();
    expect(screen.getByText("02:05")).toBeInTheDocument();
    expect(JSON.parse(
      window.localStorage.getItem("selah-bible.active.demo-reader") ?? "{}"
    )).toMatchObject({ startedAt: 1_000, stoppedAt: 126_000 });

    fireEvent.click(screen.getByRole("button", { name: /save session/i }));

    expect(await screen.findByRole("status")).toHaveTextContent("Session saved");
    expect(screen.getByRole("status")).toHaveTextContent(
      "02:05 · 1 chapter added to history"
    );
    expect(window.localStorage.getItem("selah-bible.active.demo-reader")).toBeNull();
  });
});
