export * from "./generated/api";

// Export types that are NOT in generated/api to avoid naming conflicts
export type {
  Batch,
  ChatMessage,
  ChatMessageBody,
  ChatMessageResponse,
  DashboardSummary,
  FlavoringGuideResponse,
  FlavoringGuideResponseSuggestionsItem,
  GetFlavoringGuideParams,
  HealthStatus,
  Log,
  OnboardingAdviceBody,
  OnboardingAdviceResponse,
  Photo,
  Profile,
} from "./generated/types";

// Export enum const objects (these are not in api.ts Zod schemas)
export {
  CreateLogBodySmell,
  GetFlavoringGuidePreference,
  BatchStatus,
  ChatMessageRole,
} from "./generated/types";
