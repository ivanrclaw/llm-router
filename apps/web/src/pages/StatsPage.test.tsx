import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatsPage } from "./StatsPage";

const stats = {
  filters: { teamId: "team-1", from: "2026-06-01", to: "2026-06-03" },
  overview: {
    requestCount: 4,
    successCount: 3,
    errorCount: 1,
    promptTokens: 400,
    completionTokens: 200,
    totalTokens: 600,
    cachedReadTokens: 600,
    cachedWriteTokens: 300,
    costUsdCents: 600,
    savedUsdCents: 120,
  },
  latency: { avgLatencyMs: 25, p50LatencyMs: 20, p95LatencyMs: 40 },
  cache: { cachedReadTokens: 600, cachedWriteTokens: 300, savedUsdCents: 120, cacheTokenRatio: 2.25 },
  errors: [{ errorCode: "provider_rate_limited", count: 1, httpStatus: 429 }],
  timeSeries: [
    { date: "2026-06-01", requestCount: 1, costUsdCents: 100, savedUsdCents: 20 },
    { date: "2026-06-02", requestCount: 3, costUsdCents: 500, savedUsdCents: 100 },
  ],
  breakdowns: {
    models: [{ id: "model-1", label: "big-pickle", requestCount: 4, costUsdCents: 600, savedUsdCents: 120 }],
    modelGroups: [{ id: "coding", label: "coding", requestCount: 4, costUsdCents: 600, savedUsdCents: 120 }],
    users: [{ id: "user-1", label: "owner@example.com", requestCount: 4, costUsdCents: 600, savedUsdCents: 120 }],
    platformApiKeys: [{ id: "key-1", label: "Production key", requestCount: 4, costUsdCents: 600, savedUsdCents: 120 }],
    providerKeys: [{ id: "provider-key-1", label: "OpenCode Zen", requestCount: 4, costUsdCents: 600, savedUsdCents: 120 }],
  },
};

describe("StatsPage", () => {
  it("renders usage analytics cards, charts, filters, CSV export, and drilldown links in English", () => {
    render(<StatsPage locale="en" teamId="team-1" stats={stats} />);

    expect(screen.getByRole("heading", { name: "Usage statistics" })).toBeInTheDocument();
    expect(screen.getByLabelText("From date")).toHaveValue("2026-06-01");
    expect(screen.getByLabelText("To date")).toHaveValue("2026-06-03");
    expect(screen.getByRole("link", { name: "Export CSV" })).toHaveAttribute("href", "/api/teams/team-1/stats/export.csv?from=2026-06-01&to=2026-06-03");
    expect(screen.getByText("Requests")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Cost"));
    expect(screen.getAllByText("$6.00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Savings"));
    expect(screen.getAllByText("$1.20").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("P95 latency"));
    expect(screen.getByText("40 ms")).toBeInTheDocument();
    expect(screen.getByText("2026-06-02 · 3 requests · $5.00"));
    expect(screen.getByText("provider_rate_limited · 1 · HTTP 429"));
    expect(screen.getByRole("link", { name: /big-pickle/ })).toHaveAttribute("href", "/dashboard/stats?modelId=model-1");
    expect(screen.getByRole("link", { name: /coding/ })).toHaveAttribute("href", "/dashboard/stats?modelGroupId=coding");
  });

  it("renders Spanish labels and empty state", () => {
    render(<StatsPage locale="es" teamId="team-1" stats={null} />);

    expect(screen.getByRole("heading", { name: "Estadísticas de uso" })).toBeInTheDocument();
    expect(screen.getByText("Aún no hay datos de uso para estos filtros."));
    expect(screen.getByRole("link", { name: "Exportar CSV" })).toBeInTheDocument();
  });
});
