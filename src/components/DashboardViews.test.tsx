import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Insights } from "./DashboardViews";

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
