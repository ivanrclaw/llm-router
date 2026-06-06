import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

function setupMatchMedia(matches = false) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("App", () => {
  it("renders a professional dashboard shell with navigation, breadcrumbs, team, locale, and docs snippets", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "LLM Router" })).toBeInTheDocument();
    expect(screen.getByLabelText("Primary navigation")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Usage statistics" })).toHaveAttribute("href", "#stats");
    expect(screen.getByLabelText("Breadcrumb")).toHaveTextContent("Dashboard");
    expect(screen.getByLabelText("Current team")).toHaveValue("demo");
    expect(screen.getByLabelText("Language")).toHaveValue("en");
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Integration docs" })).toBeInTheDocument();
    expect(screen.getByText(/curl -s -X POST/)).toBeInTheDocument();
    expect(screen.getAllByText(/OpenAI SDK/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/OpenCode/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Generic agents/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Loading states use skeleton blocks before data arrives.")).toBeInTheDocument();
    expect(screen.getByText("Destructive actions require confirmation before they run.")).toBeInTheDocument();
    expect(screen.getByText("Mutations confirm success or failure with dashboard toasts.")).toBeInTheDocument();
  });

  it("renders the Spanish dashboard shell when locale is es", () => {
    render(<App locale="es" />);

    expect(screen.getByLabelText("Navegación principal")).toBeInTheDocument();
    expect(screen.getByLabelText("Idioma")).toHaveValue("es");
    expect(screen.getByLabelText("Miga de pan")).toHaveTextContent("Panel");
    expect(screen.getByRole("heading", { name: "Documentación de integración" })).toBeInTheDocument();
    expect(screen.getByText("Los estados de carga usan skeletons antes de que lleguen los datos.")).toBeInTheDocument();
  });

  it("toggles Tailwind class-based dark mode and persists the user choice", () => {
    setupMatchMedia(false);
    localStorage.clear();
    document.documentElement.classList.remove("dark", "light");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("theme")).toBe("dark");

    fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));

    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("theme")).toBe("light");
  });
});
