# LLM PROMPTS REFERENCE GUIDE
## The Ouroboros Engine - Agent & Prompt Directory

> **Last Updated:** 2026-01-14  
> **Purpose:** This document provides a comprehensive directory of all LLM prompts and agent calls in the Ouroboros Engine codebase. Use this as a reference when you need to modify how agents behave, adjust task decomposition, or customize the AI's output style.

---

## 🗂️ TABLE OF CONTENTS

1. [Core Architecture Agents](#core-architecture-agents)
2. [Factory Protocol Agents](#factory-protocol-agents)
3. [Quality Assurance Agents](#quality-assurance-agents)
4. [Memory & Learning Agents](#memory--learning-agents)
5. [Utility Agents](#utility-agents)

---

## 📁 FILE QUICK REFERENCE

| File | Primary Agent | Key Prompts |
|------|--------------|-------------|
| `prism-controller.ts` | Prism (Decomposer) | Domain classification, council, atomic tasks |
| `engine/OuroborosEngine.ts` | Oracle (Interviewer) | Interview & Context Fusion |
| `engine/specialist.ts` | Specialist (Worker) | Main work execution |
| `engine/genesis-protocol.ts` | Genesis (Originator) | Constitution generation |
| `engine/saboteur.ts` | Saboteur (Antagonist) | Adversarial critique |
| `engine/antagonist-mirror.ts` | Tribunal (Judges) | Multi-judge scoring |
| `engine/reflexion-loop.ts` | Reflexion (Improver) | Iterative improvement |
| `engine/lossless-compiler.ts` | Compiler (Merger) | Final output compilation |
| `engine/security-patcher.ts` | Security (Scanner) | Vulnerability detection |
| `engine/blackboard-surveyor.ts` | Surveyor (QA) | Pattern-based checks (no LLM) |
| `agent-memory-manager.ts` | Memory (Learner) | Skill extraction |
| `knowledge-graph.ts` | Graph (Knowledge) | Entity extraction |
| `multi-round-voting.ts` | Voting (Democracy) | Multi-agent voting |

---

## CORE ARCHITECTURE AGENTS

### 0. The Oracle (Interviewer) - `engine/OuroborosEngine.ts`

**Purpose:** Conducts the initial interview to clarify the user's vision and uncover "unknown unknowns" before the project starts.

| Location | Line ~460 | `runOracle()` |
|----------|-----------|---------------|
| **What it does** | Acts as a proactive requirements analyst to interview the user |
| **Inputs** | Conversation history, user message |
| **Outputs** | Conversation response + Clarity Score (0-100) |
| **When to modify** | To change the interviewer's personality or questioning strategy |
| **Temperature** | Derived from model settings |

| Location | Line ~525 | `performContextFusion()` |
|----------|-----------|--------------------------|
| **What it does** | Synthesizes the chaotic interview transcript into a structured "Prima Materia" spec |
| **Inputs** | Full interview transcript |
| **Outputs** | Structured JSON with Project Name, Objective, Features, Constraints, Personas |
| **When to modify** | To change the structure of the initial project specification |

---

### 1. Genesis Protocol - `engine/genesis-protocol.ts`

**Purpose:** Creates the foundational "Constitution" for a project by analyzing the user's goal and establishing constraints, domain context, and success criteria.

| Location | Line ~336 | `generateConstitutionFromScratch()` |
|----------|-----------|-------------------------------------|
| **What it does** | Generates a project Constitution when no template is found in the library |
| **Inputs** | User's goal, project domain |
| **Outputs** | Constitution with constraints, domain info, and forbidden patterns |
| **When to modify** | If constitutions are too restrictive, too permissive, or missing key constraints for your use case |
| **Temperature** | 0.5 (moderate creativity) |

| Location | Line ~424 | `evolveConstitutionForPhase()` |
|----------|-----------|--------------------------------|
| **What it does** | Evolves an existing constitution for a new phase of the project |
| **When to modify** | If phase transitions need different rule adjustments |

---

### 2. Prism Controller - `prism-controller.ts`

**Purpose:** Decomposes user goals into atomic tasks and creates specialist councils.

| Location | Line ~200-240 | `stepA_DomainClassification()` |
|----------|---------------|--------------------------------|
| **What it does** | Classifies the user's goal into a domain (e.g., "Software Architecture", "Legal", "Data Science") |
| **Inputs** | User's original goal text |
| **Outputs** | Domain, sub-domain, required expertise list |
| **When to modify** | To add new domains, improve classification accuracy, or adjust domain-specific routing |
| **Temperature** | 0.3 (low, for consistent classification) |

| Location | Line ~343-400 | `generateCouncil()` |
|----------|---------------|----------------------|
| **What it does** | Creates a council of specialized agents tailored to the project domain |
| **Inputs** | Domain result, user's goal |
| **Outputs** | Array of specialist definitions with roles, personas, capabilities |
| **When to modify** | To change how specialists are named, their temperature, or default council composition |
| **Key Directive** | 🔴 Specialists design ARCHITECTURE, not code |

| Location | Line ~418-496 | `generateAtomicTasks()` |
|----------|---------------|-------------------------|
| **What it does** | Breaks down the goal into atomic, single-step tasks |
| **Inputs** | Goal, domain, constitution, council |
| **Outputs** | Array of `AtomicTask` objects with dependencies |
| **When to modify** | To change task granularity, add new task types, or modify the atomic task structure |
| **Key Directive** | 🔴 Tasks should be ARCHITECTURE-FOCUSED, not implementation-focused |
| **Temperature** | 0.5 (default), increased on retry |

| Location | Line ~1073-1130 | `retryWithExplicitJson()` |
|----------|-----------------|---------------------------|
| **What it does** | Retries JSON generation with explicit formatting instructions after parse failure |
| **When to modify** | To improve JSON repair success rate or change retry strategy |
| **Temperature** | 0.3 (lower for consistency) |

| Location | Line ~1143-1180 | `predictNextStep()` |
|----------|-----------------|---------------------|
| **What it does** | Speculatively predicts the next task during execution (Predictive Scheduling) |
| **When to modify** | To change how speculation works or disable it |

---

### 3. Specialist Worker - `engine/specialist.ts`

**Purpose:** Executes individual atomic tasks, generating architectural specifications.

| Location | Line ~92-210 | `buildSpecialistPrompt()` |
|----------|--------------|---------------------------|
| **What it does** | Constructs the full prompt for a specialist worker |
| **Sections** |
| - NO-CODE DIRECTIVE | Prominently forbids implementation code |
| - PERSONA | The specialist's assigned role |
| - LIVING CONSTITUTION | Project constraints |
| - ATOMIC INSTRUCTION | The specific task to complete |
| - OUTPUT REQUIREMENTS | TRACE, BLACKBOARD DELTA, ARTIFACT structure |
| **When to modify** |
| - Add/remove output sections |
| - Change the no-code directive strength |
| - Add new output formats |
| **Key Directive** | 🔴 NOT A CODING AGENT - generates specifications, not code |

---

## FACTORY PROTOCOL AGENTS

### 4. Saboteur (Antagonist) - `engine/saboteur.ts`

**Purpose:** Critiques and challenges specialist outputs to ensure quality.

| Location | Line ~225 | `runAntagonistCritique()` |
|----------|-----------|---------------------------|
| **What it does** | Provides adversarial critique of an artifact |
| **Inputs** | Specialist output, task context |
| **Outputs** | Critique score, issues found, improvement suggestions |
| **When to modify** | To make critiques more/less harsh, focus on specific quality aspects |
| **Temperature** | 0.7 (higher for creative criticism) |

| Location | Line ~426 | `runSelfCritique()` |
|----------|-----------|---------------------|
| **What it does** | Self-reflection mode for the saboteur to improve its own critiques |
| **When to modify** | To change meta-critique behavior |

---

### 5. Antagonist Mirror (Tribunal) - `engine/antagonist-mirror.ts`

**Purpose:** Multi-judge tribunal that scores and validates specialist outputs.

| Location | Line ~240 | `runTribunal()` |
|----------|-----------|-----------------|
| **What it does** | Creates multiple independent judges to score an artifact |
| **Inputs** | Artifact, task instruction, constitution |
| **Outputs** | Tribunal verdict with scores from each judge |
| **When to modify** | To change scoring criteria, number of judges, or consensus thresholds |
| **Temperature** | Varies per judge (0.3, 0.5, 0.7 for diversity) |

---

### 6. Reflexion Loop - `engine/reflexion-loop.ts`

**Purpose:** Iterative self-improvement loop for artifacts that fail quality gates.

| Role                | Prompt Function | Purpose |
|---------------------|-----------------|---------|
| **Self-Critique**   | `buildCritiquePrompt()` (Line ~202) | Asks model to find 3 flaws in its own work |
| **Fast Repair**     | `buildRepairPrompt()` (Line ~263) | Asks model to fix specific flaws without changing other parts |

| Location | Line ~165 | `runReflexionCycle()` |
|----------|-----------|----------------------|
| **What it does** | Orchestrates the critique-then-repair loop |
| **Inputs** | Original artifact, atomic instruction |
| **Outputs** | Improved artifact, convergence status |
| **When to modify** | To change the loop logic or thresholds |
| **Temperature** | 0.3 (Critique) / 0.5 (Repair) |

| Location | Line ~187 | `generateImprovementPlan()` |
|----------|-----------|---------------------------|
| **What it does** | Creates a structured plan for addressing critique points |
| **When to modify** | To change the improvement planning strategy |

---

### 7. Lossless Compiler - `engine/lossless-compiler.ts`

**Purpose:** Compiles all specialist outputs into a coherent final deliverable.

| Location | Line ~322 | `compileWithLLM()` |
|----------|-----------|-------------------|
| **What it does** | Uses LLM to intelligently merge and format multiple artifacts |
| **Inputs** | Array of specialist outputs, compilation rules |
| **Outputs** | Unified markdown document |
| **When to modify** | To change final output format, add section types, or modify compilation rules |
| **Temperature** | 0.3 (low for consistent formatting) |

---

### 8. Security Patcher - `engine/security-patcher.ts`

**Purpose:** Scans outputs for security vulnerabilities and suggests mitigations.

| Location | Line ~264 | `scanForVulnerabilities()` |
|----------|-----------|---------------------------|
| **What it does** | Analyzes artifact for security issues |
| **Inputs** | Artifact text, domain context |
| **Outputs** | List of vulnerabilities with severity and suggested fixes |
| **When to modify** | To add new vulnerability patterns or change severity ratings |
| **Temperature** | 0.2 (very low for consistent security analysis) |

---

## QUALITY ASSURANCE AGENTS

### 9. Blackboard Surveyor - `engine/blackboard-surveyor.ts`

**Purpose:** Fast, regex-based quality checks on outputs. NOT an LLM-based agent.

| Location | N/A | Pattern-Based Only |
|----------|-----|-------------------|
| **What it does** | Checks for red flags: hedging language, AI refusals, code generation, JSON errors |
| **When to modify** | To add new patterns, change severity levels, or adjust thresholds |
| **Key Patterns** |
| - `HEDGING_PATTERNS` - "I think", "maybe", "possibly" |
| - `REFUSAL_PATTERNS` - "I cannot", "I'm sorry" |
| - `IMPLEMENTATION_CODE_PATTERNS` - import, function, class statements |
| - `CODE_GENERATION_PATTERNS` - large code blocks |

---

### 10. Multi-Round Voting - `multi-round-voting.ts`

**Purpose:** Democratic voting system for specialists on controversial decisions.

| Location | Line ~179 | `runVotingRound()` |
|----------|-----------|-------------------|
| **What it does** | Has multiple agents vote on options with reasoning |
| **When to modify** | To change voting mechanics or tie-breaking rules |

---

## MEMORY & LEARNING AGENTS

### 11. Agent Memory Manager - `agent-memory-manager.ts`

**Purpose:** Stores and retrieves learned patterns from previous sessions.

| Location | Line ~21 | `extractSkillFromSession()` |
|----------|----------|---------------------------|
| **What it does** | Analyzes completed tasks to extract reusable skills |
| **Inputs** | Completed task output, session context |
| **Outputs** | Skill definition for vector storage |
| **When to modify** | To change what's considered a reusable skill |

---

### 12. Knowledge Graph - `knowledge-graph.ts`

**Purpose:** Builds and queries entity relationships.

| Location | Line ~121 | `extractEntities()` |
|----------|-----------|---------------------|
| **What it does** | Extracts named entities and relationships from text |
| **When to modify** | To change entity types or relationship extraction |

| Location | Line ~153 | `answerFromGraph()` |
|----------|-----------|---------------------|
| **What it does** | Uses the graph to answer queries with entity context |
| **When to modify** | To change how graph knowledge is incorporated |

---

## UTILITY AGENTS

### 13. Micro-Agent Decomposer - `micro-agent-decomposer.ts`

**Purpose:** Further breaks down complex tasks into micro-steps.

| Location | Line ~34 | `decomposeNode()` |
|----------|----------|-------------------|
| **What it does** | Takes a "still-complex" task and splits it further into 3-6 micro-tasks |
| **Inputs** | Context/Specification, Persona |
| **Outputs** | JSON array of micro-tasks with ID, Title, Description, Complexity |
| **When to modify** | To change decomposition granularity or output format |
| **Temperature** | Derived from model settings |

---

### 14. Main Engine Utilities - `engine/OuroborosEngine.ts`

| Location | Line ~495 | Generic prompt execution |
|----------|-----------|-------------------------|
| **What it does** | Low-level LLM call wrapper |

| Location | Line ~548 | `generateWithFallback()` |
|----------|-----------|-------------------------|
| **What it does** | Generates content with Hydra failover |
| **When to modify** | To change failover behavior |

---

## 🔧 HOW TO MODIFY PROMPTS

### General Guidelines

1. **Find the right file** using the table above
2. **Look for `const prompt =` ** or a function that builds the prompt
3. **Test changes** incrementally - small tweaks are safer
4. **Preserve JSON output format** if the response needs parsing
5. **Keep the no-code directive** in specialist-related prompts

### Common Modifications

| Goal | Location | What to Change |
|------|----------|---------------|
| Make tasks more granular | `prism-controller.ts:generateAtomicTasks()` | Reduce complexity threshold, add "MICRO-TASKS" directive |
| Allow code output | `specialist.ts:buildSpecialistPrompt()` | ⚠️ DISCOURAGED - Remove NO-CODE sections |
| Stricter quality | `antagonist-mirror.ts:runTribunal()` | Add more judges, increase consensus threshold |
| Different output format | `lossless-compiler.ts:compileWithLLM()` | Change the compilation template |
| Add new domain | `prism-controller.ts:stepA_DomainClassification()` | Add to domain examples in prompt |
| Change temperature | Look for `temperature:` in the `config` object of each call |

---

## 📊 TEMPERATURE REFERENCE

| Agent | Temperature | Reason |
|-------|-------------|--------|
| Domain Classification | 0.3 | Low = consistent classification |
| Task Generation | 0.5 | Moderate = creative decomposition |
| Specialist Work | 0.5 | Moderate = balanced output |
| Tribunal Judge 1 | 0.3 | Low = strict evaluation |
| Tribunal Judge 2 | 0.5 | Moderate = balanced evaluation |
| Tribunal Judge 3 | 0.7 | High = creative criticism |
| Saboteur | 0.7 | High = adversarial creativity |
| Reflexion | 0.4 | Focused improvement |
| Compiler | 0.3 | Low = consistent formatting |
| JSON Retry | 0.3 | Low = format compliance |

---

## 🔴 CRITICAL: "NOT A CODING AGENT" PHILOSOPHY

The Ouroboros Engine is designed to generate **"Project Soul" artifacts** - architectural specifications, not implementation code. This philosophy is enforced at multiple levels:

1. **Specialist Prompt** (`specialist.ts`) - Explicit NO-CODE directive at top
2. **Prism Tasks** (`prism-controller.ts`) - Architecture-focused task examples
3. **Council Generation** (`prism-controller.ts`) - Specialists are "Architects" not "Developers"
4. **Blackboard Surveyor** (`blackboard-surveyor.ts`) - Detects and flags code generation

**If you modify prompts, maintain this philosophy unless explicitly changing the engine's purpose.**

---

*This document should be updated whenever new LLM calls are added or existing prompts are significantly modified.*
