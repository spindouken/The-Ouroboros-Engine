import type { Node, ExecutionStrategy } from '../../types';

export interface AtomicTaskLike {
    id: string;
    title?: string;
    instruction?: string;
    dependencies?: unknown;
    complexity?: number;
}

export interface DependencySuggestion {
    id: string;
    dependsOn: string[];
}

const FOUNDATION_HINTS = [
    'define',
    'scope',
    'baseline',
    'framework',
    'taxonomy',
    'methodology',
    'background',
    'literature',
    'criteria',
    'assumption'
];

function toTokens(input: string): string[] {
    return (input || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length >= 4);
}

function lexicalOverlap(a: string, b: string): number {
    const aTokens = new Set(toTokens(a));
    const bTokens = new Set(toTokens(b));
    if (aTokens.size === 0 || bTokens.size === 0) return 0;
    let overlap = 0;
    for (const token of aTokens) {
        if (bTokens.has(token)) overlap++;
    }
    return overlap / Math.min(aTokens.size, bTokens.size);
}

function parseDependencies(raw: unknown, currentTaskId: string): string[] {
    let candidates: unknown[] = [];
    if (Array.isArray(raw)) {
        candidates = raw;
    } else if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed || trimmed.toLowerCase() === 'none' || trimmed === '[]') return [];
        candidates = trimmed.split(/[,\n|;]+/);
    } else if (raw && typeof raw === 'object') {
        const ids = (raw as any).ids;
        if (Array.isArray(ids)) {
            candidates = ids;
        } else if (typeof (raw as any).id === 'string') {
            candidates = [(raw as any).id];
        }
    }

    return Array.from(
        new Set(
            candidates
                .map((dep) => (typeof dep === 'string' || typeof dep === 'number') ? String(dep).trim() : '')
                .filter((dep) => dep.length > 0 && dep !== currentTaskId)
        )
    );
}

function hasDependencyPath(startId: string, targetId: string, depMap: Record<string, string[]>): boolean {
    const stack = [startId];
    const visited = new Set<string>();
    while (stack.length > 0) {
        const current = stack.pop() as string;
        if (current === targetId) return true;
        if (visited.has(current)) continue;
        visited.add(current);
        for (const dep of depMap[current] || []) {
            if (!visited.has(dep)) stack.push(dep);
        }
    }
    return false;
}

export function sanitizeTaskDependencies<T extends AtomicTaskLike>(tasks: T[]): T[] {
    const validIds = new Set(tasks.map((task) => task.id));
    const depMap: Record<string, string[]> = {};

    for (const task of tasks) {
        depMap[task.id] = parseDependencies(task.dependencies, task.id)
            .filter((depId) => validIds.has(depId) && depId !== task.id);
    }

    // Remove cycle-producing edges deterministically.
    for (const task of tasks) {
        const safeDeps: string[] = [];
        for (const depId of depMap[task.id]) {
            const staged = { ...depMap, [task.id]: [...safeDeps, depId] };
            if (!hasDependencyPath(depId, task.id, staged)) {
                safeDeps.push(depId);
            }
        }
        depMap[task.id] = safeDeps;
    }

    return tasks.map((task) => ({
        ...task,
        dependencies: depMap[task.id]
    }));
}

export function applyDependencySuggestions<T extends AtomicTaskLike>(
    tasks: T[],
    suggestions: DependencySuggestion[]
): T[] {
    const suggestionMap = new Map(suggestions.map((item) => [item.id, item.dependsOn || []]));
    const merged = tasks.map((task) => {
        const currentDeps = parseDependencies(task.dependencies, task.id);
        const extra = suggestionMap.get(task.id) || [];
        return {
            ...task,
            dependencies: Array.from(new Set([...currentDeps, ...extra]))
        };
    });
    return sanitizeTaskDependencies(merged);
}

export function enrichTaskDependenciesHeuristically<T extends AtomicTaskLike>(tasks: T[]): T[] {
    const seed = sanitizeTaskDependencies(tasks);
    const out = seed.map((task) => ({ ...task, dependencies: parseDependencies(task.dependencies, task.id) }));

    for (let i = 0; i < out.length; i++) {
        const current = out[i];
        const currentText = `${current.title || ''}\n${current.instruction || ''}`;
        const currentDeps = parseDependencies(current.dependencies, current.id);

        let bestPriorId = '';
        let bestScore = 0;

        for (let j = 0; j < i; j++) {
            const prior = out[j];
            const priorText = `${prior.title || ''}\n${prior.instruction || ''}`;
            const overlap = lexicalOverlap(currentText, priorText);
            const priorIsFoundation = FOUNDATION_HINTS.some((hint) => priorText.toLowerCase().includes(hint));
            const score = overlap + (priorIsFoundation ? 0.15 : 0);
            if (score > bestScore) {
                bestScore = score;
                bestPriorId = prior.id;
            }
        }

        if (bestPriorId && bestScore >= 0.22 && !currentDeps.includes(bestPriorId)) {
            current.dependencies = [...currentDeps, bestPriorId];
        } else {
            current.dependencies = currentDeps;
        }
    }

    return sanitizeTaskDependencies(out as T[]);
}

const ACTIVE_EXECUTION_STATUSES = new Set([
    'running',
    'critiquing',
    'synthesizing',
    'reflexion',
    'surveying',
    'auditing',
    'compiling',
    'patching',
    'verifying',
    'planning',
    'decomposing'
]);

function buildDependentsMap(nodes: Node[]): Record<string, string[]> {
    const map: Record<string, string[]> = {};
    for (const node of nodes) {
        map[node.id] = [];
    }
    for (const node of nodes) {
        for (const depId of node.dependencies || []) {
            if (!map[depId]) map[depId] = [];
            map[depId].push(node.id);
        }
    }
    return map;
}

function countTransitiveDependents(startId: string, dependentsMap: Record<string, string[]>): number {
    const visited = new Set<string>();
    const stack = [...(dependentsMap[startId] || [])];
    while (stack.length > 0) {
        const nodeId = stack.pop() as string;
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);
        for (const next of dependentsMap[nodeId] || []) {
            if (!visited.has(next)) stack.push(next);
        }
    }
    return visited.size;
}

function linearPriority(node: Node, dependentsScore: number): number {
    const complexity = typeof node.data?.complexity === 'number' ? node.data.complexity : 5;
    const depth = typeof node.depth === 'number' ? node.depth : 0;
    // Higher downstream impact first; then shallower/lower complexity nodes.
    return dependentsScore * 100 - depth * 3 - complexity;
}

function pairCoupling(a: Node, b: Node): number {
    const aText = `${a.label || ''}\n${a.instruction || ''}`;
    const bText = `${b.label || ''}\n${b.instruction || ''}`;
    return lexicalOverlap(aText, bText);
}

export function getRunnableNodes(nodes: Node[]): Node[] {
    const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));
    return nodes.filter((node) => {
        if (node.status !== 'pending') return false;
        const deps = Array.isArray(node.dependencies) ? node.dependencies : [];
        return deps.every((depId) => !byId[depId] || byId[depId].status === 'complete');
    });
}

export function selectRunnableBatch(
    nodes: Node[],
    strategy: ExecutionStrategy,
    concurrency: number,
    branchCouplingThreshold: number,
    maxBatchContextChars: number = 16000
): Node[] {
    const runnable = getRunnableNodes(nodes);
    if (runnable.length <= 1) return runnable;

    const dependentsMap = buildDependentsMap(nodes);
    const ordered = [...runnable].sort((a, b) => {
        const scoreA = linearPriority(a, countTransitiveDependents(a.id, dependentsMap));
        const scoreB = linearPriority(b, countTransitiveDependents(b.id, dependentsMap));
        if (scoreB !== scoreA) return scoreB - scoreA;
        const labelCmp = (a.label || '').localeCompare(b.label || '');
        if (labelCmp !== 0) return labelCmp;
        return a.id.localeCompare(b.id);
    });

    if (strategy === 'linear') {
        return [ordered[0]];
    }

    if (strategy === 'dependency_parallel') {
        return ordered;
    }

    // auto_branch_parallel: select low-coupling subset, bounded by concurrency.
    const limit = Math.max(1, concurrency);
    const contextBudget = Math.max(2000, maxBatchContextChars);
    let usedChars = 0;
    const selected: Node[] = [];
    for (const candidate of ordered) {
        if (selected.length >= limit) break;
        const safe = selected.every((existing) => pairCoupling(existing, candidate) <= branchCouplingThreshold);
        if (!safe) continue;

        const candidateChars = `${candidate.label || ''}\n${candidate.instruction || ''}`.length;
        if (selected.length > 0 && usedChars + candidateChars > contextBudget) continue;

        selected.push(candidate);
        usedChars += candidateChars;
    }
    return selected.length > 0 ? selected : [ordered[0]];
}

export interface QueueMetrics {
    runnableCount: number;
    queuedCount: number;
    activeCount: number;
    blockedByDependencyCount: number;
    pendingCount: number;
}

export function computeQueueMetrics(nodes: Node[]): QueueMetrics {
    const runnable = getRunnableNodes(nodes);
    const queuedCount = nodes.filter((node) => node.status === 'queued').length;
    const activeCount = nodes.filter((node) => ACTIVE_EXECUTION_STATUSES.has(node.status)).length;
    const pendingCount = nodes.filter((node) => node.status === 'pending').length;
    const blockedByDependencyCount = Math.max(0, pendingCount - runnable.length);

    return {
        runnableCount: runnable.length,
        queuedCount,
        activeCount,
        blockedByDependencyCount,
        pendingCount
    };
}
