import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProviderKeysPage } from "./ProviderKeysPage";

describe("ProviderKeysPage", () => {
  it("renders masked OpenCode Zen provider keys and validation action", () => {
    render(
      <ProviderKeysPage
        locale="en"
        providerKeys={[
          {
            id: "pk_1",
            providerSlug: "opencode-zen",
            providerName: "OpenCode Zen",
            name: "Primary Zen",
            keyPrefix: "oz_live_",
            priority: 10,
            rpmLimit: 60,
            isEnabled: true,
            healthStatus: "healthy",
            lastValidatedAt: "2026-06-05T00:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByText("Provider keys")).toBeInTheDocument();
    expect(screen.getByText("Primary Zen")).toBeInTheDocument();
    expect(screen.getByText("oz_live_••••••••")).toBeInTheDocument();
    expect(screen.getAllByText(/OpenCode Zen/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Healthy")).toBeInTheDocument();
    expect(screen.getByText("Validate key")).toBeInTheDocument();
  });

  it("renders Spanish labels and empty state", () => {
    render(<ProviderKeysPage locale="es" providerKeys={[]} />);

    expect(screen.getByText("Claves de proveedor")).toBeInTheDocument();
    expect(screen.getByText("Validar clave")).toBeInTheDocument();
    expect(screen.getByText("Aún no hay claves de proveedor.")).toBeInTheDocument();
  });
});
