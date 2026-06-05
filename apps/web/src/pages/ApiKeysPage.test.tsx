import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApiKeysPage } from "./ApiKeysPage";

describe("ApiKeysPage", () => {
  it("renders API key management in English and shows generated key only in create result", () => {
    render(
      <ApiKeysPage
        locale="en"
        apiKeys={[{ id: "key-1", name: "CI Key", keyPrefix: "lr_abcd1234", scopes: ["models:read"], rateLimitRpm: 60 }]}
        createdKey="lr_new_secret_visible_once"
      />,
    );

    expect(screen.getByRole("heading", { name: "Platform API keys" })).toBeInTheDocument();
    expect(screen.getAllByText("Create API key").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("CI Key")).toBeInTheDocument();
    expect(screen.getByText("lr_abcd1234")).toBeInTheDocument();
    expect(screen.getByText("lr_new_secret_visible_once")).toBeInTheDocument();
    expect(screen.getByText("Shown once. Copy it now; it will not be shown again.")).toBeInTheDocument();
  });

  it("renders API key management in Spanish with budget and scope labels", () => {
    render(
      <ApiKeysPage
        locale="es"
        apiKeys={[
          {
            id: "key-2",
            name: "Producción",
            keyPrefix: "lr_prod1234",
            scopes: ["models:read", "chat:write"],
            dailyBudgetUsdCents: 500,
            monthlyBudgetUsdCents: 10000,
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Claves API de plataforma" })).toBeInTheDocument();
    expect(screen.getAllByText("Crear clave API").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Ámbitos").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Presupuesto diario: $5.00")).toBeInTheDocument();
    expect(screen.getByText("Presupuesto mensual: $100.00")).toBeInTheDocument();
  });
});
