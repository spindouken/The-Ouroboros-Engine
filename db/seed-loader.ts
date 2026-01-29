/**
 * Golden Seed Loader (Section 3.2 - Genesis Protocol)
 * 
 * Loads pre-validated templates ("The Teflon Stack") on first boot
 * to ensure Senior-level competence from Day 1.
 * 
 * @module db/seed-loader
 * @version V2.99
 */

import { db, DBSkill, DBProjectStack } from './ouroborosDB';

// Import the seed data
import seedData from './seeds/skills.json';

export interface SeedLoadResult {
    skillsLoaded: number;
    stacksLoaded: number;
    isFirstBoot: boolean;
    errors: string[];
}

/**
 * Loads the Golden Seeds into the database on first boot
 * 
 * This implements the Genesis Protocol Step A: Library Scan
 * Query the "Golden Seed" Vector DB for templates and seed Blackboard
 * with high-level competencies.
 */
export async function loadGoldenSeeds(): Promise<SeedLoadResult> {
    const result: SeedLoadResult = {
        skillsLoaded: 0,
        stacksLoaded: 0,
        isFirstBoot: false,
        errors: []
    };

    try {
        // Check if this is first boot (no seeds exist)
        const existingSkills = await db.skills.count();
        const existingStacks = await db.project_stacks.count();

        if (existingSkills > 0 || existingStacks > 0) {
            // Not first boot - seeds already loaded
            console.log('[Genesis] Golden Seeds already loaded. Skipping...');
            return result;
        }

        result.isFirstBoot = true;
        console.log('[Genesis] First boot detected. Loading Golden Seeds...');

        // Load Skills
        const skills = (seedData as any).skills || [];
        for (const skill of skills) {
            try {
                const dbSkill: DBSkill = {
                    id: skill.id,
                    name: skill.name,
                    category: skill.category,
                    tags: skill.tags,
                    content: skill.content,
                    source: skill.source as 'golden_seed' | 'learned',
                    createdAt: Date.now(),
                    usageCount: 0
                };
                await db.skills.put(dbSkill);
                result.skillsLoaded++;
            } catch (err: any) {
                result.errors.push(`Failed to load skill ${skill.id}: ${err.message}`);
            }
        }

        // Load Project Stacks
        const stacks = (seedData as any).project_stacks || [];
        for (const stack of stacks) {
            try {
                const dbStack: DBProjectStack = {
                    id: stack.id,
                    name: stack.name,
                    description: stack.description,
                    techStack: stack.techStack,
                    preloadSkills: stack.preloadSkills,
                    constraints: stack.constraints,
                    isBuiltIn: stack.isBuiltIn,
                    createdAt: Date.now()
                };
                await db.project_stacks.put(dbStack);
                result.stacksLoaded++;
            } catch (err: any) {
                result.errors.push(`Failed to load stack ${stack.id}: ${err.message}`);
            }
        }

        console.log(`[Genesis] Golden Seeds loaded: ${result.skillsLoaded} skills, ${result.stacksLoaded} stacks`);
        return result;

    } catch (err: any) {
        result.errors.push(`Seed loading failed: ${err.message}`);
        console.error('[Genesis] Failed to load Golden Seeds:', err);
        return result;
    }
}

/**
 * Query skills by tags (vector-like search using Dexie's anyOf)
 * 
 * This implements client-side skill retrieval for Pre-Flight Check Injection
 */
export async function querySkillsByTags(tags: string[], limit: number = 3): Promise<DBSkill[]> {
    try {
        const skills = await db.skills
            .where('tags')
            .anyOf(tags)
            .limit(limit)
            .toArray();

        // Sort by usage count (most used first)
        return skills.sort((a, b) => b.usageCount - a.usageCount);
    } catch (err) {
        console.error('[Genesis] Failed to query skills:', err);
        return [];
    }
}

/**
 * Get skills by category
 */
export async function getSkillsByCategory(category: string): Promise<DBSkill[]> {
    try {
        return await db.skills
            .where('category')
            .equals(category)
            .toArray();
    } catch (err) {
        console.error('[Genesis] Failed to get skills by category:', err);
        return [];
    }
}

/**
 * Get all available project stacks
 */
export async function getAllProjectStacks(): Promise<DBProjectStack[]> {
    try {
        return await db.project_stacks.toArray();
    } catch (err) {
        console.error('[Genesis] Failed to get project stacks:', err);
        return [];
    }
}

/**
 * Increment usage count for a skill (for learning/ranking)
 */
export async function incrementSkillUsage(skillId: string): Promise<void> {
    try {
        await db.skills
            .where('id')
            .equals(skillId)
            .modify(skill => {
                skill.usageCount = (skill.usageCount || 0) + 1;
            });
    } catch (err) {
        console.error('[Genesis] Failed to increment skill usage:', err);
    }
}

export default {
    loadGoldenSeeds,
    querySkillsByTags,
    getSkillsByCategory,
    getAllProjectStacks,
    incrementSkillUsage
};
