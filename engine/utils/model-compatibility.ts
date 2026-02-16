import type { SmallModelCompatibilityMode } from '../../types';

export const LOCAL_SMALL_MODEL_ID = 'local-custom-small';

/**
 * Lite/strict-JSON prompting is intentionally scoped to local-small usage.
 */
export function shouldUseLiteCompatibility(
    modelId: string,
    compatibilityMode: SmallModelCompatibilityMode | undefined
): boolean {
    if (modelId !== LOCAL_SMALL_MODEL_ID) {
        return false;
    }

    return compatibilityMode !== 'force_off';
}

