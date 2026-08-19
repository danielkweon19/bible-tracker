import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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
      chapters: index === 42
        ? [
            { verses: [{ num: 1, text: "In the beginning." }] },
            { verses: [{ num: 1, text: "The next chapter." }] }
          ]
        : [{ verses: [{ num: 1, text: "In the beginning." }] }]
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("reading session timer", () => {
  it("freezes the duration and submits that final time immediately", () => {
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

    expect(screen.queryByText(/saving/i)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Session saved");
    expect(screen.getByRole("status")).toHaveTextContent(
      "02:05 · 1 chapter added to history"
    );
    expect(window.localStorage.getItem("selah-bible.active.demo-reader")).toBeNull();
  });

  it("tracks the starting chapter and chapters reached through navigation", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /start session/i }));
    expect(JSON.parse(
      window.localStorage.getItem("selah-bible.active.demo-reader") ?? "{}"
    ).chapters).toEqual(["John 1"]);
    expect(screen.queryByRole("button", { name: /complete/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next chapter" }));

    expect(JSON.parse(
      window.localStorage.getItem("selah-bible.active.demo-reader") ?? "{}"
    ).chapters).toEqual(["John 1", "John 2"]);
    expect(screen.getByText("2 chapters tracked")).toBeInTheDocument();
  });

  it("clears the complete reading history after confirmation", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /history/i }));
    fireEvent.click(screen.getByRole("button", { name: /clear history/i }));

    expect(screen.getByText("No reading sessions yet")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Reading history cleared.");
  });
});
