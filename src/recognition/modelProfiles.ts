import type { ModelRole, ModelSettingResolution } from "./contracts";

export interface ModelProfile {
  readonly profileId: string;
  readonly role: ModelRole;
  readonly provider: "openai" | "google" | "microsoft";
  readonly model: string;
  readonly contextTier: ModelSettingResolution;
  readonly reasoningEffort: ModelSettingResolution;
  readonly notes: readonly string[];
}

function appliedSetting(requestedValue: string): ModelSettingResolution {
  return {
    requested: requestedValue,
    status: "applied",
    applied: requestedValue,
    reason: null,
  };
}

function unsupportedSetting(
  requestedValue: string,
  reason: string,
): ModelSettingResolution {
  return {
    requested: requestedValue,
    status: "unsupported",
    applied: null,
    reason,
  };
}

export const RECOGNITION_MODEL_PROFILES = Object.freeze({
  readerA: {
    profileId: "reader-a-gpt-5.5",
    role: "reader_a",
    provider: "openai",
    model: "gpt-5.5",
    contextTier: appliedSetting("long_context"),
    reasoningEffort: appliedSetting("xhigh"),
    notes: Object.freeze(["Primary staff-reader model."]),
  },
  readerB: {
    profileId: "reader-b-gemini-3.1-pro-preview",
    role: "reader_b",
    provider: "google",
    model: "gemini-3.1-pro-preview",
    contextTier: appliedSetting("long_context"),
    reasoningEffort: unsupportedSetting(
      "highest_available_thinking",
      "The generic adapter contract cannot guarantee vendor-specific thinking controls.",
    ),
    notes: Object.freeze(["Independent second reader for cross-checking."]),
  },
  readerFallback: {
    profileId: "reader-fallback-gemini-3.7-flash",
    role: "reader_fallback",
    provider: "google",
    model: "gemini-3.7-flash",
    contextTier: unsupportedSetting(
      "long_context",
      "Fallback profile may run with provider default context windows only.",
    ),
    reasoningEffort: unsupportedSetting(
      "xhigh",
      "Fallback profile exposes no deterministic high-thinking control in this contract.",
    ),
    notes: Object.freeze(["Fallback reader when primary models are unavailable."]),
  },
  judge: {
    profileId: "judge-gpt-5.6-sol",
    role: "judge",
    provider: "openai",
    model: "gpt-5.6-sol",
    contextTier: appliedSetting("long_context"),
    reasoningEffort: appliedSetting("max"),
    notes: Object.freeze(["Adjudicates disagreements at event granularity."]),
  },
  codePrimary: {
    profileId: "code-gpt-5.3-codex",
    role: "code_primary",
    provider: "openai",
    model: "gpt-5.3-codex",
    contextTier: unsupportedSetting(
      "long_context",
      "Code profile is provisioned for standard code-window operation.",
    ),
    reasoningEffort: unsupportedSetting(
      "xhigh",
      "Codex code role has no stable reasoning-effort control in this contract.",
    ),
    notes: Object.freeze(["Primary code-role model profile."]),
  },
  codeSecondary: {
    profileId: "code-mai-code-1.1-flash",
    role: "code_secondary",
    provider: "microsoft",
    model: "mai-code-1.1-flash",
    contextTier: unsupportedSetting(
      "long_context",
      "Secondary code profile uses provider default context only.",
    ),
    reasoningEffort: unsupportedSetting(
      "xhigh",
      "Secondary code profile has no deterministic high-thinking setting.",
    ),
    notes: Object.freeze(["Secondary/fallback code-role model profile."]),
  },
} as const satisfies Record<string, ModelProfile>);

export const ALL_RECOGNITION_MODEL_PROFILES: readonly ModelProfile[] =
  Object.freeze(Object.values(RECOGNITION_MODEL_PROFILES));
