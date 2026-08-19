import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { BibleData } from "../types";
import { AppShell } from "./AppShell";

vi.mock("./Reader", () => ({
  Reader: () => <div>Reader content</div>
}));

vi.mock("./DashboardViews", () => ({
  Insights: () => <div>Combined insights content</div>,
  History: () => <div>History content</div>
}));

const bible: BibleData = {
  version: "Test",
  books: [{ name: "John", chapters: [{ verses: [] }] }]
};

function renderShell() {
  render(
    <AppShell
      user={{ uid: "reader-1", displayName: "Reader", email: "reader@example.com", photoURL: null }}
      bible={bible}
      sessions={[]}
      loading
      error={null}
      demo={false}
      location={{ bookIndex: 0, chapterIndex: 0 }}
      active={null}
      initialView="read"
      onLocation={vi.fn()}
      onStart={vi.fn()}
      onCompleteNext={vi.fn()}
      onStop={vi.fn()}
      onFinish={vi.fn()}
      saving={false}
      onDiscard={vi.fn()}
      onDelete={vi.fn()}
    />
  );
}

test("keeps views usable while reading history syncs", () => {
  renderShell();

  expect(screen.getByText("Reader content")).toBeInTheDocument();
  expect(screen.queryByText(/syncing your reading history/i)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /history/i }));

  expect(screen.getByText("History content")).toBeInTheDocument();
  expect(screen.getByText(/syncing your reading history/i)).toBeInTheDocument();
});

test("uses one combined insights destination", () => {
  renderShell();

  expect(screen.queryByRole("button", { name: /overview/i })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /insights/i }));

  expect(screen.getByText("Combined insights content")).toBeInTheDocument();
});
