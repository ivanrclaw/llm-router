import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ModelGroupsPage } from "./ModelGroupsPage";

describe("ModelGroupsPage", () => {
  it("renders model groups with routing policy, candidates, and warnings in English", () => {
    render(
      <ModelGroupsPage
        locale="en"
        groups={[
          {
            id: "g1",
            alias: "free-coding",
            displayName: "Free Coding",
            isEnabled: true,
            stickySessionTtlSeconds: 86400,
            policy: { endpointType: "openai_chat_completions", freeOnly: true, requiredTags: ["coding"], maxInputUsdPer1M: 0 },
            candidates: [
              { id: "c1", externalModelId: "big-pickle", providerSlug: "opencode-zen", priority: 10, weight: 3, isEnabled: true, warnings: [] },
              { id: "c2", externalModelId: "embed-only-free", providerSlug: "opencode-zen", priority: 20, weight: 1, isEnabled: true, warnings: ["endpoint_incompatible"] },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("Model groups")).toBeInTheDocument();
    expect(screen.getByText("free-coding")).toBeInTheDocument();
    expect(screen.getByText(/Free only/)).toBeInTheDocument();
    expect(screen.getByText(/openai_chat_completions/)).toBeInTheDocument();
    expect(screen.getByText(/big-pickle/)).toBeInTheDocument();
    expect(screen.getByText(/weight 3/)).toBeInTheDocument();
    expect(screen.getByText(/Candidate warning/)).toBeInTheDocument();
    expect(screen.getByText(/endpoint_incompatible/)).toBeInTheDocument();
  });

  it("renders Spanish empty state and create action", () => {
    render(<ModelGroupsPage locale="es" groups={[]} />);

    expect(screen.getByText("Grupos de modelos")).toBeInTheDocument();
    expect(screen.getByText("Crear grupo")).toBeInTheDocument();
    expect(screen.getByText("Aún no hay grupos de modelos.")).toBeInTheDocument();
  });
});
