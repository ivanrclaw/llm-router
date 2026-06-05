import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TeamSwitcher } from "../components/TeamSwitcher";
import { LoginPage, RegisterPage } from "./AuthPages";

describe("Sprint 2 auth UI", () => {
  it("renders login and register pages in English", () => {
    render(
      <>
        <LoginPage locale="en" />
        <RegisterPage locale="en" />
      </>,
    );

    expect(screen.getByRole("heading", { name: "Sign in to LLM Router" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create your LLM Router account" })).toBeInTheDocument();
    expect(screen.getAllByText("Email").length).toBeGreaterThan(0);
  });

  it("renders login/register/team switcher in Spanish", () => {
    render(
      <>
        <LoginPage locale="es" />
        <RegisterPage locale="es" />
        <TeamSwitcher locale="es" teams={[{ id: "team-1", name: "Equipo", role: "owner" }]} selectedTeamId="team-1" />
      </>,
    );

    expect(screen.getByRole("heading", { name: "Inicia sesión en LLM Router" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Crea tu cuenta de LLM Router" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Equipo actual" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Equipo · Propietario" })).toBeInTheDocument();
  });
});
