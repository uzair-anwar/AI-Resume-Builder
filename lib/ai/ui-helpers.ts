import type { AiProviderCatalog, AiProviderChoice, AiProviderId } from "./provider-types";

/** Which provider’s model list to show in the UI for the current provider choice. */
export function resolveModelPickerProvider(
  choice: AiProviderChoice,
  providers: AiProviderCatalog[],
  fallbackOrder: AiProviderId[],
): AiProviderId | null {
  if (!providers.length) return null;
  if (choice !== "auto") {
    return providers.some((p) => p.id === choice) ? choice : null;
  }
  for (const id of fallbackOrder) {
    if (providers.some((p) => p.id === id)) return id;
  }
  return providers[0]?.id ?? null;
}
