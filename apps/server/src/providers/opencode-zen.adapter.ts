export const OPENCODE_ZEN_SLUG = "opencode-zen";
export const OPENCODE_ZEN_MODELS_URL = "https://opencode.ai/zen/v1/models";

export type ProviderValidationResult = {
  status: "healthy" | "invalid" | "rate_limited" | "error";
  lastErrorCode: string | null;
  cooldownSeconds?: number;
};

export class OpenCodeZenAdapter {
  async validateKey(apiKey: string): Promise<ProviderValidationResult> {
    const response = await fetch(OPENCODE_ZEN_MODELS_URL, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    if (response.ok) return { status: "healthy", lastErrorCode: null };
    if (response.status === 401 || response.status === 403) return { status: "invalid", lastErrorCode: `provider_${response.status}` };
    if (response.status === 429) return { status: "rate_limited", lastErrorCode: "provider_429", cooldownSeconds: 300 };
    return { status: "error", lastErrorCode: `provider_${response.status}` };
  }
}
