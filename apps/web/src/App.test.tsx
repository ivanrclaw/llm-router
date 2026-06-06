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
  it("renders auth as a standalone route instead of mixing login and register into the dashboard", () => {
    render(<App initialRoute="/login" />);

    expect(screen.getByRole("main", { name: "Authentication" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sign in to LLM Router" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute("href", "/register");
    expect(screen.queryByLabelText("Primary navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Usage statistics" })).not.toBeInTheDocument();
  });

  it("renders dashboard overview as a real page route with path-based navigation", () => {
    render(<App initialRoute="/dashboard" />);

    expect(screen.getByRole("heading", { name: "LLM Router" })).toBeInTheDocument();
    expect(screen.getByLabelText("Primary navigation")).toBeInTheDocument();
    expect(screen.getByLabelText("Breadcrumb")).toHaveTextContent("Dashboard / Overview");
    expect(screen.getByLabelText("Current team")).toHaveValue("demo");
    expect(screen.getByLabelText("Language")).toHaveValue("en");
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();

    const sidebar = screen.getByLabelText("Primary navigation");
    expect(within(sidebar).getByText("Analyze")).toBeInTheDocument();
    expect(within(sidebar).getByText("Operate")).toBeInTheDocument();
    expect(within(sidebar).getByText("Secure")).toBeInTheDocument();
    expect(within(sidebar).getByText("Resources")).toBeInTheDocument();
    expect(within(sidebar).getByRole("link", { name: /Overview/ })).toHaveAttribute("href", "/dashboard");
    expect(within(sidebar).getByRole("link", { name: /Usage/ })).toHaveAttribute("href", "/dashboard/stats");
    expect(within(sidebar).getByRole("link", { name: /Platform keys/ })).toHaveAttribute("href", "/dashboard/api-keys");
    expect(within(sidebar).getByRole("link", { name: /Provider keys/ })).toHaveAttribute("href", "/dashboard/provider-keys");
    expect(within(sidebar).getByRole("link", { name: /Models/ })).toHaveAttribute("href", "/dashboard/models");
    expect(within(sidebar).getByRole("link", { name: /Model groups/ })).toHaveAttribute("href", "/dashboard/model-groups");
    expect(within(sidebar).getByRole("link", { name: /Budgets/ })).toHaveAttribute("href", "/dashboard/budgets");
    expect(within(sidebar).getByRole("link", { name: /Integration docs/ })).toHaveAttribute("href", "/dashboard/docs");

    expect(screen.getByRole("heading", { name: "Control center" })).toBeInTheDocument();
    expect(screen.getByText("Route traffic, control cost, and monitor OpenAI-compatible usage from focused sections.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Integration docs" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sign in to LLM Router" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Create your LLM Router account" })).not.toBeInTheDocument();
  });

  it("renders only the active dashboard page route instead of one long single-page dashboard", () => {
    render(<App initialRoute="/dashboard/models" />);

    expect(screen.getByLabelText("Breadcrumb")).toHaveTextContent("Dashboard / Models");
    expect(screen.getByRole("heading", { name: "Model catalog" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Usage statistics" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Platform API keys" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Integration docs" })).not.toBeInTheDocument();
  });

  it("provides a responsive mobile navigation drawer", () => {
    render(<App initialRoute="/dashboard/stats" />);

    const mobileNav = screen.getByLabelText("Mobile navigation");
    expect(mobileNav).toHaveAttribute("aria-hidden", "true");
    const openButton = screen.getByRole("button", { name: "Open navigation" });
    expect(openButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(openButton);

    expect(openButton).toHaveAttribute("aria-expanded", "true");
    expect(mobileNav).toHaveAttribute("aria-hidden", "false");
    expect(within(mobileNav).getByRole("link", { name: /Budgets/ })).toHaveAttribute("href", "/dashboard/budgets");
  });

  it("renders the Spanish dashboard shell with real routed sections", () => {
    render(<App locale="es" initialRoute="/dashboard/docs" />);

    expect(screen.getByLabelText("Navegación principal")).toBeInTheDocument();
    expect(screen.getByLabelText("Idioma")).toHaveValue("es");
    expect(screen.getByLabelText("Miga de pan")).toHaveTextContent("Panel / Documentación de integración");
    const sidebar = screen.getByLabelText("Navegación principal");
    expect(within(sidebar).getByText("Analizar")).toBeInTheDocument();
    expect(within(sidebar).getByText("Operar")).toBeInTheDocument();
    expect(within(sidebar).getByText("Seguridad")).toBeInTheDocument();
    expect(within(sidebar).getByText("Recursos")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Documentación de integración" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Centro de control" })).not.toBeInTheDocument();
  });

  it("toggles Tailwind class-based dark mode and persists the user choice", () => {
    setupMatchMedia(false);
    localStorage.clear();
    document.documentElement.classList.remove("dark", "light");
    render(<App initialRoute="/dashboard" />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("theme")).toBe("dark");

    fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));

    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("theme")).toBe("light");
  });
});
