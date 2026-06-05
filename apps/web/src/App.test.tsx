import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the LLM Router landing smoke screen", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "LLM Router" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Health Check" })).toHaveAttribute("href", "/api/health");
  });
});
