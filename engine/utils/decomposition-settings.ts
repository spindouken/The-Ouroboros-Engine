import type {
    AppSettings,
    DecompositionStrategy,
    ExecutionStrategy,
    CreativeOutputTarget,
    GuidedRepairMode,
    OutputProfile,
    SmallModelCompatibilityMode,
    SpecialistContextMode,
    TribunalStrictnessProfile
} from '../../types';

const VALID_STRATEGIES: DecompositionStrategy[] = ['off', 'bounded', 'fixpoint_recursive'];
const VALID_GUIDED_REPAIR_MODES: GuidedRepairMode[] = ['off', 'auto', 'always'];
const VALID_SMALL_MODEL_COMPATIBILITY: SmallModelCompatibilityMode[] = ['auto', 'force_off'];
const VALID_TRIBUNAL_STRICTNESS: TribunalStrictnessProfile[] = ['balanced', 'strict', 'local_small'];
const VALID_SPECIALIST_CONTEXT_MODES: SpecialistContextMode[] = [
    'constitution_deltas',
    'dependency_artifacts',
    'top_k_relevant_bricks',
    'full_verified_bricks'
];
const VALID_EXECUTION_STRATEGIES: ExecutionStrategy[] = [
    'linear',
    'dependency_parallel',
    'auto_branch_parallel'
];
const VALID_OUTPUT_PROFILES: OutputProfile[] = ['lossless_only', 'lossless_plus_soul'];
const VALID_CREATIVE_OUTPUT_TARGETS: CreativeOutputTarget[] = ['auto', 'bible', 'beat_sheet', 'screenplay'];

export interface ResolvedPrismSettings {
    decompositionStrategy: DecompositionStrategy;
    maxAtomicTasks?: number;
    maxCouncilSize: number;
    maxDecompositionPasses: number;
}

function clampInt(value: unknown, min: number, max: number): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return undefined;
    }
    return Math.min(max, Math.max(min, Math.round(value)));
}

function isValidStrategy(value: unknown): value is DecompositionStrategy {
    return typeof value === 'string' && VALID_STRATEGIES.includes(value as DecompositionStrategy);
}

function isValidGuidedRepairMode(value: unknown): value is GuidedRepairMode {
    return typeof value === 'string' && VALID_GUIDED_REPAIR_MODES.includes(value as GuidedRepairMode);
}

function isValidSmallModelCompatibility(value: unknown): value is SmallModelCompatibilityMode {
    return typeof value === 'string' && VALID_SMALL_MODEL_COMPATIBILITY.includes(value as SmallModelCompatibilityMode);
}

function isValidTribunalStrictness(value: unknown): value is TribunalStrictnessProfile {
    return typeof value === 'string' && VALID_TRIBUNAL_STRICTNESS.includes(value as TribunalStrictnessProfile);
}

function isValidSpecialistContextMode(value: unknown): value is SpecialistContextMode {
    return typeof value === 'string' && VALID_SPECIALIST_CONTEXT_MODES.includes(value as SpecialistContextMode);
}

function isValidExecutionStrategy(value: unknown): value is ExecutionStrategy {
    return typeof value === 'string' && VALID_EXECUTION_STRATEGIES.includes(value as ExecutionStrategy);
}

function isValidOutputProfile(value: unknown): value is OutputProfile {
    return typeof value === 'string' && VALID_OUTPUT_PROFILES.includes(value as OutputProfile);
}

function isValidCreativeOutputTarget(value: unknown): value is CreativeOutputTarget {
    return typeof value === 'string' && VALID_CREATIVE_OUTPUT_TARGETS.includes(value as CreativeOutputTarget);
}

/**
 * Backward compatible strategy resolution:
 * 1) Use explicit strategy when present.
 * 2) Fallback to legacy recursive toggle.
 * 3) Default to bounded.
 */
export function getDecompositionStrategy(
    settings: Partial<AppSettings> | null | undefined
): DecompositionStrategy {
    if (!settings) return 'bounded';

    if (isValidStrategy(settings.decompositionStrategy)) {
        return settings.decompositionStrategy;
    }

    if (typeof settings.enableRecursiveDecomposition === 'boolean') {
        return settings.enableRecursiveDecomposition ? 'fixpoint_recursive' : 'bounded';
    }

    return 'bounded';
}

export function isRecursiveDecompositionActive(
    settings: Partial<AppSettings> | null | undefined
): boolean {
    return getDecompositionStrategy(settings) === 'fixpoint_recursive';
}

export function getInitialDecompositionStatus(
    settings: Partial<AppSettings> | null | undefined
): 'pending' | 'atomic' {
    return isRecursiveDecompositionActive(settings) ? 'pending' : 'atomic';
}

/**
 * Normalize a settings patch while preserving backward compatibility.
 */
export function normalizeSettingsPatch(patch: Partial<AppSettings>): Partial<AppSettings> {
    const normalized: Partial<AppSettings> = { ...patch };

    if ('decompositionStrategy' in patch || 'enableRecursiveDecomposition' in patch) {
        const strategy = getDecompositionStrategy(patch);
        normalized.decompositionStrategy = strategy;
        normalized.enableRecursiveDecomposition = strategy === 'fixpoint_recursive';
    }

    if ('maxAtomicTasks' in patch) {
        normalized.maxAtomicTasks =
            patch.maxAtomicTasks === undefined ? undefined : clampInt(patch.maxAtomicTasks, 5, 50);
    }

    if ('maxDecompositionPasses' in patch) {
        normalized.maxDecompositionPasses =
            patch.maxDecompositionPasses === undefined
                ? undefined
                : clampInt(patch.maxDecompositionPasses, 1, 10);
    }

    if ('maxCouncilSize' in patch) {
        normalized.maxCouncilSize =
            patch.maxCouncilSize === undefined ? undefined : clampInt(patch.maxCouncilSize, 1, 15);
    }

    if ('specialistContextTopK' in patch) {
        normalized.specialistContextTopK =
            patch.specialistContextTopK === undefined ? undefined : clampInt(patch.specialistContextTopK, 1, 20);
    }

    if ('specialistContextBudgetChars' in patch) {
        normalized.specialistContextBudgetChars =
            patch.specialistContextBudgetChars === undefined ? undefined : clampInt(patch.specialistContextBudgetChars, 2000, 120000);
    }

    if ('guidedRepairMode' in patch && !isValidGuidedRepairMode(patch.guidedRepairMode)) {
        normalized.guidedRepairMode = 'auto';
    }

    if ('smallModelCompatibilityMode' in patch) {
        const compatibilityMode = patch.smallModelCompatibilityMode as unknown;
        if (compatibilityMode === 'force_on') {
            // Legacy value: keep behavior scoped to local-small only.
            normalized.smallModelCompatibilityMode = 'auto';
        } else if (!isValidSmallModelCompatibility(compatibilityMode)) {
            normalized.smallModelCompatibilityMode = 'auto';
        }
    }

    if ('tribunalStrictnessProfile' in patch && !isValidTribunalStrictness(patch.tribunalStrictnessProfile)) {
        normalized.tribunalStrictnessProfile = 'balanced';
    }

    if ('specialistContextMode' in patch && !isValidSpecialistContextMode(patch.specialistContextMode)) {
        normalized.specialistContextMode = 'top_k_relevant_bricks';
    }

    if ('executionStrategy' in patch && !isValidExecutionStrategy(patch.executionStrategy)) {
        normalized.executionStrategy = 'linear';
    }

    if ('outputProfile' in patch && !isValidOutputProfile(patch.outputProfile)) {
        normalized.outputProfile = 'lossless_only';
    }

    if ('creativeOutputTarget' in patch && !isValidCreativeOutputTarget(patch.creativeOutputTarget)) {
        normalized.creativeOutputTarget = 'auto';
    }

    if ('autoBranchCouplingThreshold' in patch) {
        if (typeof patch.autoBranchCouplingThreshold !== 'number' || !Number.isFinite(patch.autoBranchCouplingThreshold)) {
            normalized.autoBranchCouplingThreshold = 0.22;
        } else {
            normalized.autoBranchCouplingThreshold = Math.max(0.05, Math.min(0.95, patch.autoBranchCouplingThreshold));
        }
    }

    return normalized;
}

export function resolvePrismSettings(
    settings: Partial<AppSettings> | null | undefined
): ResolvedPrismSettings {
    const strategy = getDecompositionStrategy(settings);
    const rawMaxPasses = clampInt(settings?.maxDecompositionPasses, 1, 10) ?? 3;

    return {
        decompositionStrategy: strategy,
        maxAtomicTasks: settings?.maxAtomicTasks === undefined
            ? undefined
            : clampInt(settings?.maxAtomicTasks, 5, 50),
        maxCouncilSize: clampInt(settings?.maxCouncilSize, 1, 15) ?? 5,
        maxDecompositionPasses: strategy === 'off' ? 1 : rawMaxPasses
    };
}
