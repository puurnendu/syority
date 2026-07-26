export const VALID_MODELS = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'o1',
    'o3',
];

export const DEPRECATED_MODELS = [
];

/**
 * Normalize common model aliases/typos to valid model identifiers.
 */
export function normalizeModelName(model: string): string {
    return model.trim();
}

/**
 * Format-based model validation. Accepts:
 * - Any string matching /^gemini-/ or /^models\/gemini-/ (Google)
 * - Any string matching /^gpt-/ (OpenAI)
 * - Any string matching /^o1/ or /^o3/ (OpenAI reasoning models)
 */
export function validateAnyModel(model: string): void {
    if (!model || !model.trim()) {
        throw new Error('No AI model configured. Please set it in Platform → Settings → AI Configuration.');
    }

    const trimmed = model.trim();

    if (/^gemini-/i.test(trimmed)) return;
    if (/^models\/gemini-/i.test(trimmed)) return;
    if (/^publishers\/google\/models\//i.test(trimmed)) return;
    if (/^gpt-/i.test(trimmed)) return;
    if (/^vertex-/i.test(trimmed)) return;
    if (/^o1/i.test(trimmed)) return;
    if (/^o3/i.test(trimmed)) return;

    throw new Error(`Unsupported model identifier: ${model}. Expected gemini-*, vertex-*, gpt-*, o1*, or o3* format.`);

}

export function validateModel(model: string | null | undefined): void {
    if (!model || !model.trim()) {
        throw new Error('No AI model configured. Please set it in Platform → Settings → AI Configuration.');
    }

    validateAnyModel(model);
}
