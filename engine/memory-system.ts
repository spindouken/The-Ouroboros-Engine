/**
 * The Memory System (Client-Side RAG) - Section 5.1
 * 
 * Bringing the "Agent Bible" Tenets to the Browser.
 * 
 * Components:
 * 1. **The Librarian (Skill Extraction):** Extracts successful patterns into db.skills
 * 2. **The Project Insight Layer:** Every 5-10 bricks, synthesizes high-level observations
 * 3. **The Pre-Flight Check:** Injects "Top 3 Related Solved Problems" before Specialist
 * 4. **The Anti-Pattern Library:** Stores failure modes from Antagonist rejections
 * 
 * All operations run CLIENT-SIDE in the browser using Dexie.js (IndexedDB).
 * No server-side dependencies, no external API calls for memory operations.
 */

import { db, DBSkill } from '../db/ouroborosDB';

// ============================================================================
// TYPES
// ============================================================================

export interface SkillMatch {
    /** The matched skill */
    skill: DBSkill;

    /** Relevance score (0-100) */
    relevance: number;

    /** Tags that matched */
    matchedTags: string[];
}

export interface PreFlightInjection {
    /** Top N matched skills */
    skills: SkillMatch[];

    /** Formatted context for injection into prompt */
    formattedContext: string;

    /** Whether any skills were found */
    hasSkills: boolean;
}

export interface AntiPattern {
    /** Unique identifier */
    id: string;

    /** Description of what NOT to do */
    description: string;

    /** The failure mode that caused this */
    failureMode: string;

    /** Categories this applies to */
    categories: string[];

    /** When this was learned */
    learnedAt: number;

    /** How many times this was encountered */
    hitCount: number;
}

export interface ProjectInsight {
    /** The insight observation */
    observation: string;

    /** When this was synthesized */
    timestamp: number;

    /** Which bricks contributed to this insight */
    brickIds: string[];
}

// ============================================================================
// PRE-FLIGHT CHECK (Skill Injection)
// ============================================================================

/**
 * Query db.skills and find the top N related skills for a given task
 * This runs BEFORE a Specialist starts, injecting relevant solved problems
 * 
 * @param taskDescription - The atomic task description
 * @param tags - Additional tags to search for
 * @param limit - Maximum number of skills to return (default: 3)
 * @returns PreFlightInjection with matched skills and formatted context
 */
export async function performPreFlightCheck(
    taskDescription: string,
    tags: string[] = [],
    limit: number = 3
): Promise<PreFlightInjection> {
    try {
        // Extract keywords from task description
        const keywords = extractKeywords(taskDescription);
        const searchTags = [...new Set([...tags, ...keywords])];

        if (searchTags.length === 0) {
            return {
                skills: [],
                formattedContext: '',
                hasSkills: false
            };
        }

        // Query skills that match any of our tags
        const allSkills = await db.skills.toArray();

        // Score each skill by tag overlap
        const scoredSkills: SkillMatch[] = allSkills.map(skill => {
            const matchedTags = skill.tags.filter(tag =>
                searchTags.some(st =>
                    tag.toLowerCase().includes(st.toLowerCase()) ||
                    st.toLowerCase().includes(tag.toLowerCase())
                )
            );

            // Calculate relevance score
            const tagScore = (matchedTags.length / Math.max(searchTags.length, 1)) * 50;
            const categoryScore = searchTags.some(t =>
                skill.category.toLowerCase().includes(t.toLowerCase())
            ) ? 30 : 0;
            const nameScore = searchTags.some(t =>
                skill.name.toLowerCase().includes(t.toLowerCase())
            ) ? 20 : 0;

            return {
                skill,
                relevance: Math.min(100, tagScore + categoryScore + nameScore),
                matchedTags
            };
        })
            .filter(s => s.relevance > 10) // Only include skills with some relevance
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, limit);

        // Format for injection
        const formattedContext = formatSkillsForInjection(scoredSkills);

        return {
            skills: scoredSkills,
            formattedContext,
            hasSkills: scoredSkills.length > 0
        };
    } catch (e) {
        console.warn('[Memory] Pre-flight check failed:', e);
        return {
            skills: [],
            formattedContext: '',
            hasSkills: false
        };
    }
}

/**
 * Extract keywords from a task description
 */
function extractKeywords(text: string): string[] {
    // Remove common words and extract meaningful terms
    const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
        'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
        'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
        'this', 'that', 'these', 'those', 'it', 'its', 'i', 'you', 'we',
        'they', 'he', 'she', 'who', 'which', 'what', 'where', 'when', 'how',
        'create', 'define', 'implement', 'design', 'build', 'make', 'write',
        'using', 'use', 'specify', 'describe', 'explain'
    ]);

    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3 && !stopWords.has(word))
        .slice(0, 10); // Max 10 keywords
}

/**
 * Format matched skills for prompt injection
 */
function formatSkillsForInjection(matches: SkillMatch[]): string {
    if (matches.length === 0) return '';

    let output = `## RELATED SOLVED PROBLEMS (Pre-Flight Injection)\n\n`;
    output += `The following ${matches.length} skill(s) may be relevant to your task:\n\n`;

    matches.forEach((match, i) => {
        output += `### ${i + 1}. ${match.skill.name} (Relevance: ${match.relevance}%)\n`;
        output += `**Category:** ${match.skill.category}\n`;
        output += `**Tags:** ${match.skill.tags.join(', ')}\n\n`;
        output += `${match.skill.content}\n\n`;
        output += `---\n\n`;
    });

    return output;
}

// ============================================================================
// THE LIBRARIAN (Skill Extraction)
// ============================================================================

/**
 * Extract a successful pattern from a verified brick and store as a skill
 * Called at the end of a session for learning
 * 
 * @param name - Name for the skill
 * @param category - Category (e.g., 'React', 'Authentication')
 * @param content - The actual skill content/pattern
 * @param tags - Tags for searchability
 */
export async function extractAndStoreSkill(
    name: string,
    category: string,
    content: string,
    tags: string[]
): Promise<string> {
    const id = `skill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const skill: DBSkill = {
        id,
        name,
        category,
        tags,
        content,
        source: 'learned',
        createdAt: Date.now(),
        usageCount: 0
    };

    await db.skills.add(skill);

    return id;
}

/**
 * Increment usage count for a skill (track utility)
 */
export async function incrementSkillUsage(skillId: string): Promise<void> {
    const skill = await db.skills.get(skillId);
    if (skill) {
        await db.skills.update(skillId, { usageCount: skill.usageCount + 1 });
    }
}

// ============================================================================
// THE ANTI-PATTERN LIBRARY
// ============================================================================

// In-memory store for anti-patterns (persisted per session)
// In a full implementation, this would be stored in Dexie.js
let antiPatterns: AntiPattern[] = [];

/**
 * Learn an anti-pattern from an Antagonist rejection
 * 
 * @param failureMode - What went wrong
 * @param description - What NOT to do
 * @param categories - Applicable categories
 */
export function learnAntiPattern(
    failureMode: string,
    description: string,
    categories: string[] = []
): void {
    // Check if we already have this anti-pattern
    const existing = antiPatterns.find(ap =>
        ap.description.toLowerCase() === description.toLowerCase()
    );

    if (existing) {
        existing.hitCount++;
        return;
    }

    antiPatterns.push({
        id: `ap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        description,
        failureMode,
        categories,
        learnedAt: Date.now(),
        hitCount: 1
    });
}

/**
 * Get anti-patterns relevant to a task/category
 */
export function getRelevantAntiPatterns(
    taskDescription: string,
    categories: string[] = [],
    limit: number = 5
): AntiPattern[] {
    const keywords = extractKeywords(taskDescription);

    return antiPatterns
        .filter(ap => {
            // Match by category
            if (categories.some(c => ap.categories.includes(c))) return true;
            // Match by keywords in description
            if (keywords.some(k => ap.description.toLowerCase().includes(k))) return true;
            return false;
        })
        .sort((a, b) => b.hitCount - a.hitCount)
        .slice(0, limit);
}

/**
 * Format anti-patterns for prompt injection as "Negative Constraints"
 */
export function formatAntiPatternsForInjection(patterns: AntiPattern[]): string {
    if (patterns.length === 0) return '';

    let output = `## NEGATIVE CONSTRAINTS (Anti-Patterns to Avoid)\n\n`;
    output += `⚠️ The following patterns have caused failures in the past:\n\n`;

    patterns.forEach((ap, i) => {
        output += `${i + 1}. **DON'T:** ${ap.description}\n`;
        output += `   _Reason: ${ap.failureMode}_\n\n`;
    });

    return output;
}

/**
 * Clear all anti-patterns (for new sessions)
 */
export function clearAntiPatterns(): void {
    antiPatterns = [];
}

// ============================================================================
// PROJECT INSIGHT LAYER
// ============================================================================

// In-memory store for project insights
let projectInsights: ProjectInsight[] = [];

/**
 * Add a project-level insight
 * Called every 5-10 bricks during a "Reflection Pass"
 */
export function addProjectInsight(
    observation: string,
    brickIds: string[]
): void {
    projectInsights.push({
        observation,
        timestamp: Date.now(),
        brickIds
    });
}

/**
 * Get all project insights
 */
export function getProjectInsights(): ProjectInsight[] {
    return [...projectInsights];
}

/**
 * Format project insights for injection
 */
export function formatProjectInsightsForInjection(): string {
    if (projectInsights.length === 0) return '';

    let output = `## PROJECT INSIGHTS (Style Guide)\n\n`;
    output += `The following observations apply to this project:\n\n`;

    projectInsights.forEach(insight => {
        output += `- ${insight.observation}\n`;
    });

    return output;
}

/**
 * Clear project insights (for new sessions)
 */
export function clearProjectInsights(): void {
    projectInsights = [];
}

// ============================================================================
// COMBINED CONTEXT BUILDER
// ============================================================================

/**
 * Build full memory context for a Specialist
 * Combines Pre-Flight skills, Anti-patterns, and Project Insights
 */
export async function buildMemoryContext(
    taskDescription: string,
    tags: string[] = []
): Promise<string> {
    let context = '';

    // 1. Pre-Flight Check (Top 3 related skills)
    const preFlight = await performPreFlightCheck(taskDescription, tags);
    if (preFlight.hasSkills) {
        context += preFlight.formattedContext;
    }

    // 2. Anti-Patterns
    const antiPatternContext = getRelevantAntiPatterns(taskDescription, tags);
    if (antiPatternContext.length > 0) {
        context += formatAntiPatternsForInjection(antiPatternContext);
    }

    // 3. Project Insights
    const insightsContext = formatProjectInsightsForInjection();
    if (insightsContext) {
        context += insightsContext;
    }

    return context;
}

// ============================================================================
// SESSION LIFECYCLE
// ============================================================================

/**
 * Reset all session-scoped memory (for new sessions)
 */
export function resetSessionMemory(): void {
    clearAntiPatterns();
    clearProjectInsights();
}

/**
 * Get memory statistics
 */
export async function getMemoryStats(): Promise<{
    skillCount: number;
    goldenSeedCount: number;
    learnedSkillCount: number;
    antiPatternCount: number;
    insightCount: number;
}> {
    const allSkills = await db.skills.toArray();

    return {
        skillCount: allSkills.length,
        goldenSeedCount: allSkills.filter(s => s.source === 'golden_seed').length,
        learnedSkillCount: allSkills.filter(s => s.source === 'learned').length,
        antiPatternCount: antiPatterns.length,
        insightCount: projectInsights.length
    };
}
