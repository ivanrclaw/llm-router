import { fireEvent, render, screen, within } from "@testing-library/react";
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
  it("renders auth as a standalone view instead of mixing login and register into the dashboard", () => {
    render(<App initialRoute="/login" />);

    expect(screen.getByRole("main", { name: "Authentication" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sign in to LLM Router" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute("href", "/register");
    expect(screen.queryByLabelText("Primary navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Usage statistics" })).not.toBeInTheDocument();
  });

  it("renders a granular professional dashboard shell with grouped sidebar navigation and no inline auth forms", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "LLM Router" })).toBeInTheDocument();
    expect(screen.getByLabelText("Primary navigation")).toBeInTheDocument();
    expect(screen.getByLabelText("Breadcrumb")).toHaveTextContent("Dashboard");
    expect(screen.getByLabelText("Current team")).toHaveValue("demo");
    expect(screen.getByLabelText("Language")).toHaveValue("en");
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();

    const sidebar = screen.getByLabelText("Primary navigation");
    expect(within(sidebar).getByText("Analyze")).toBeInTheDocument();
    expect(within(sidebar).getByText("Operate")).toBeInTheDocument();
    expect(within(sidebar).getByText("Secure")).toBeInTheDocument();
    expect(within(sidebar).getByText("Resources")).toBeInTheDocument();
    expect(within(sidebar).getByRole("link", { name: /Overview/ })).toHaveAttribute("href", "#overview");
    expect(within(sidebar).getByRole("link", { name: /Usage/ })).toHaveAttribute("href", "#stats");
    expect(within(sidebar).getByRole("link", { name: /Platform keys/ })).toHaveAttribute("href", "#api-keys");
    expect(within(sidebar).getByRole("link", { name: /Provider keys/ })).toHaveAttribute("href", "#provider-keys");
    expect(within(sidebar).getByRole("link", { name: /Models/ })).toHaveAttribute("href", "#models");
    expect(within(sidebar).getByRole("link", { name: /Model groups/ })).toHaveAttribute("href", "#model-groups");
    expect(within(sidebar).getByRole("link", { name: /Budgets/ })).toHaveAttribute("href", "#budgets");
    expect(within(sidebar).getByRole("link", { name: /Integration docs/ })).toHaveAttribute("href", "#docs");

    expect(screen.getByRole("heading", { name: "Control center" })).toBeInTheDocument();
    expect(screen.getByText("Route traffic, control cost, and monitor OpenAI-compatible usage from focused sections.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Integration docs" })).toBeInTheDocument();
    expect(screen.getByText(/curl -s -X POST/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sign in to LLM Router" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Create your LLM Router account" })).not.toBeInTheDocument();
  });

  it("renders the Spanish dashboard shell with grouped sections", () => {
    render(<App locale="es" />);

    expect(screen.getByLabelText("Navegación principal")).toBeInTheDocument();
    expect(screen.getByLabelText("Idioma")).toHaveValue("es");
    expect(screen.getByLabelText("Miga de pan")).toHaveTextContent("Panel");
    expect(screen.getByRole("heading", { name: "Centro de control" })).toBeInTheDocument();
    const sidebar = screen.getByLabelText("Navegación principal");
    expect(within(sidebar).getByText("Analizar")).toBeInTheDocument();
    expect(within(sidebar).getByText("Operar")).toBeInTheDocument();
    expect(within(sidebar).getByText("Seguridad")).toBeInTheDocument();
    expect(within(sidebar).getByText("Recursos"));
    expect(screen.getByRole("heading", { name: "Documentación de integración" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Inicia sesión en LLM Router" })).not.toBeInTheDocument();
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
