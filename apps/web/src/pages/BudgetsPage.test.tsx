import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BudgetsPage } from "./BudgetsPage";

describe("BudgetsPage", () => {
  it("renders budget controls for every supported scope in English", () => {
    render(
      <BudgetsPage
        locale="en"
        policies={[
          { id: "team", scopeType: "team", scopeLabel: "Demo Team", dailyBudgetUsdCents: 500, monthlyBudgetUsdCents: 10000, hardLimit: true, alertThresholds: [50, 80] },
          { id: "user", scopeType: "user", scopeLabel: "owner@example.com", dailyBudgetUsdCents: null, monthlyBudgetUsdCents: 25000, hardLimit: false, alertThresholds: [] },
          { id: "platform", scopeType: "platform_api_key", scopeLabel: "Production lr_ key", dailyBudgetUsdCents: 1000, monthlyBudgetUsdCents: null, hardLimit: true, alertThresholds: [90] },
          { id: "provider", scopeType: "provider_api_key", scopeLabel: "OpenCode Zen main", dailyBudgetUsdCents: 2000, monthlyBudgetUsdCents: 50000, hardLimit: true, alertThresholds: [75] },
          { id: "model", scopeType: "model", scopeLabel: "big-pickle", dailyBudgetUsdCents: null, monthlyBudgetUsdCents: 30000, hardLimit: true, alertThresholds: [] },
          { id: "group", scopeType: "model_group", scopeLabel: "coding", dailyBudgetUsdCents: 1500, monthlyBudgetUsdCents: null, hardLimit: true, alertThresholds: [50] },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Budgets" })).toBeInTheDocument();
    expect(screen.getByText("Team")).toBeInTheDocument();
    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.getByText("Platform API key")).toBeInTheDocument();
    expect(screen.getByText("Provider key")).toBeInTheDocument();
    expect(screen.getByText("Model")).toBeInTheDocument();
    expect(screen.getByText("Model group")).toBeInTheDocument();
    expect(screen.getByText("Daily budget: $5.00")).toBeInTheDocument();
    expect(screen.getByText("Alert thresholds: 50%, 80%")).toBeInTheDocument();
    expect(screen.getByText("Soft alert only")).toBeInTheDocument();
  });

  it("renders Spanish labels and empty state", () => {
    render(<BudgetsPage locale="es" policies={[]} />);

    expect(screen.getByRole("heading", { name: "Presupuestos" })).toBeInTheDocument();
    expect(screen.getByText("Crea límites diarios y mensuales por equipo, usuario, clave API, proveedor, modelo y grupo."))
      .toBeInTheDocument();
    expect(screen.getByText("Aún no hay políticas de presupuesto."))
      .toBeInTheDocument();
  });
});
