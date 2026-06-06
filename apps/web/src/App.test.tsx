import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the LLM Router landing smoke screen", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "LLM Router" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Health Check" })).toHaveAttribute("href", "/api/health");
    expect(screen.getByRole("heading", { name: "Usage statistics" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Export CSV" })).toHaveAttribute("href", "/api/teams/demo/stats/export.csv?from=2026-06-01&to=2026-06-03");
  });
});
