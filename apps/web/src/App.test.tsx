import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

function mockAuthFetch() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (url === "/api/auth/login") {
      if (body.password === "bad-password") {
        return new Response(JSON.stringify({ error: { message: "Invalid credentials" } }), { status: 401, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ token: "jwt.login.token", user: { id: "user-1", email: body.email, name: "Admin User" }, teams: [{ id: "team-1", name: "Admin Team", role: "owner" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url === "/api/auth/register") {
      return new Response(JSON.stringify({ token: "jwt.register.token", user: { id: "user-2", email: body.email, name: body.name }, teams: [{ id: "team-2", name: body.teamName, role: "owner" }] }), { status: 201, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: { message: "unexpected" } }), { status: 404, headers: { "Content-Type": "application/json" } });
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("App", () => {
  it("redirects protected dashboard routes to login when no authenticated user exists", () => {
    render(<App initialRoute="/dashboard/models" />);

    expect(screen.getByRole("main", { name: "Authentication" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sign in to LLM Router" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Model catalog" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Primary navigation")).not.toBeInTheDocument();
  });

  it("logs in with email and password, stores the JWT session, and then renders the requested admin route", async () => {
    const fetchMock = mockAuthFetch();
    render(<App initialRoute="/dashboard/models" />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "admin-password-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Model catalog" })).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "Content-Type": "application/json" }),
    }));
    expect(localStorage.getItem("llm-router-session")).toContain("jwt.login.token");
    expect(screen.getByText("Admin User")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("shows authentication errors and keeps the dashboard locked on invalid credentials", async () => {
    mockAuthFetch();
    render(<App initialRoute="/dashboard" />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "bad-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials");
    expect(screen.queryByRole("heading", { name: "Control center" })).not.toBeInTheDocument();
    expect(localStorage.getItem("llm-router-session")).toBeNull();
  });

  it("renders auth as a standalone route instead of mixing login and register into the dashboard", () => {
    render(<App initialRoute="/login" />);

    expect(screen.getByRole("main", { name: "Authentication" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sign in to LLM Router" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute("href", "/register");
    expect(screen.queryByLabelText("Primary navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Usage statistics" })).not.toBeInTheDocument();
  });

  it("renders dashboard overview as a real page route with path-based navigation for authenticated users", () => {
    localStorage.setItem("llm-router-session", JSON.stringify({ token: "jwt.demo", user: { id: "u1", name: "Demo Admin", email: "demo@example.com" }, teams: [{ id: "demo", name: "Demo Team", role: "owner" }] }));
    render(<App initialRoute="/dashboard" />);

    expect(screen.getByRole("heading", { name: "LLM Router" })).toBeInTheDocument();
    expect(screen.getByLabelText("Primary navigation")).toBeInTheDocument();
    expect(screen.getByLabelText("Breadcrumb")).toHaveTextContent("Dashboard / Overview");
    expect(screen.getByLabelText("Current team")).toHaveValue("demo");
    expect(screen.getByLabelText("Language")).toHaveValue("en");
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();

    const sidebar = screen.getByLabelText("Primary navigation");
    expect(within(sidebar).getByRole("link", { name: /Overview/ })).toHaveAttribute("href", "/dashboard");
    expect(within(sidebar).getByRole("link", { name: /Usage/ })).toHaveAttribute("href", "/dashboard/stats");
    expect(within(sidebar).getByRole("link", { name: /Platform keys/ })).toHaveAttribute("href", "/dashboard/api-keys");
    expect(screen.getByRole("heading", { name: "Control center" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Integration docs" })).not.toBeInTheDocument();
  });

  it("renders only the active dashboard page route instead of one long single-page dashboard", () => {
    localStorage.setItem("llm-router-session", JSON.stringify({ token: "jwt.demo", user: { id: "u1", name: "Demo Admin", email: "demo@example.com" }, teams: [{ id: "demo", name: "Demo Team", role: "owner" }] }));
    render(<App initialRoute="/dashboard/models" />);

    expect(screen.getByLabelText("Breadcrumb")).toHaveTextContent("Dashboard / Models");
    expect(screen.getByRole("heading", { name: "Model catalog" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Usage statistics" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Platform API keys" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Integration docs" })).not.toBeInTheDocument();
  });

  it("provides a responsive mobile navigation drawer", () => {
    localStorage.setItem("llm-router-session", JSON.stringify({ token: "jwt.demo", user: { id: "u1", name: "Demo Admin", email: "demo@example.com" }, teams: [{ id: "demo", name: "Demo Team", role: "owner" }] }));
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
    localStorage.setItem("llm-router-session", JSON.stringify({ token: "jwt.demo", user: { id: "u1", name: "Demo Admin", email: "demo@example.com" }, teams: [{ id: "demo", name: "Demo Team", role: "owner" }] }));
    render(<App locale="es" initialRoute="/dashboard/docs" />);

    expect(screen.getByLabelText("Navegación principal")).toBeInTheDocument();
    expect(screen.getByLabelText("Idioma")).toHaveValue("es");
    expect(screen.getByLabelText("Miga de pan")).toHaveTextContent("Panel / Documentación de integración");
    expect(screen.getByRole("heading", { name: "Documentación de integración" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Centro de control" })).not.toBeInTheDocument();
  });

  it("toggles Tailwind class-based dark mode and persists the user choice", () => {
    localStorage.setItem("llm-router-session", JSON.stringify({ token: "jwt.demo", user: { id: "u1", name: "Demo Admin", email: "demo@example.com" }, teams: [{ id: "demo", name: "Demo Team", role: "owner" }] }));
    setupMatchMedia(false);
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
