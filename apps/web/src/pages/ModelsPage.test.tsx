import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ModelsPage } from "./ModelsPage";

describe("ModelsPage", () => {
  it("renders model catalog with pricing badges and filters in English", () => {
    render(
      <ModelsPage
        locale="en"
        models={[
          {
            id: "m1",
            providerSlug: "opencode-zen",
            externalModelId: "big-pickle",
            displayName: "Big Pickle",
            endpointType: "openai_chat_completions",
            tags: ["free", "coding"],
            isFree: true,
            isEnabled: true,
            pricingConfidence: "docs_pricing_verified",
            currentPricing: { inputUsdPer1M: 0, outputUsdPer1M: 0, isFree: true },
          },
          {
            id: "m2",
            providerSlug: "opencode-zen",
            externalModelId: "live-paid-pro",
            displayName: "Live Paid Pro",
            endpointType: "openai_chat_completions",
            tags: ["reasoning"],
            isFree: false,
            isEnabled: true,
            pricingConfidence: "unknown",
            currentPricing: { inputUsdPer1M: 1.5, outputUsdPer1M: 3, isFree: false },
          },
        ]}
      />,
    );

    expect(screen.getByText("Model catalog")).toBeInTheDocument();
    expect(screen.getByText("Big Pickle")).toBeInTheDocument();
    expect(screen.getByText(/live-paid-pro/)).toBeInTheDocument();
    expect(screen.getAllByText("Free").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Paid").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Unknown pricing")).toBeInTheDocument();
    expect(screen.getByText("$1.5 / $3 per 1M")).toBeInTheDocument();
    expect(screen.getAllByText("Endpoint").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Coding").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Spanish empty state and sync action", () => {
    render(<ModelsPage locale="es" models={[]} />);

    expect(screen.getByText("Catálogo de modelos")).toBeInTheDocument();
    expect(screen.getByText("Sincronizar modelos")).toBeInTheDocument();
    expect(screen.getByText("Aún no hay modelos."));
  });
});
