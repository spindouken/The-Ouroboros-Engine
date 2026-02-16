# ♾️ Ouroboros V2.99: The Integrated Master Architecture
**Subtitle:** The Pragmatic Brick Factory
**Status:** Active Source of Truth with Reality Sync Addendum (Code-verified Feb 16, 2026)
**Philosophy:** Adversarial Engineering & Industrialized Truth

> **🔖 Note:** Features marked with `[Future Enhancement]` are deferred to V3.0. See `V3.0_Enhancement_Task_List.md`.
> **🔖 Note:** See `V2.99_Refinement_Strategy.md` for the "Blackboard Shift" protocol updates being implemented.

## Reality Sync Addendum (Code-verified 2026-02-16)

If this addendum conflicts with older text below, the addendum is authoritative.

- Active now in code:
  - Antagonist duel validation pipeline with guided repair controls (default path).
  - Multi-domain mode propagation and mode-aware specialist/saboteur/surveyor/antagonist prompts.
  - Decomposition strategy (`off | bounded | fixpoint_recursive`) plus execution strategy (`linear` default, optional parallel modes).
  - Dependency enrichment, attempt history telemetry, and Node Inspector transparency improvements.
  - Optional soul-document layer on top of canonical lossless manifests.
- Partial or legacy:
  - Multi-round voting module is retained for compatibility but not used by default runtime orchestration.
  - `JsonRetryDialog.tsx` exists, but JSON retry behavior is currently settings/runtime driven (`jsonRetryMode`).
  - Vector-embedding retrieval remains deferred; current Genesis/seed retrieval is Dexie keyword/tag matching.
- Future/deferred:
  - Phases 11-15 in `.kiro/specs/multi-domain-expansion/tasks.md` are planned and mostly not implemented by default.
  - MCP/tooling/browser expansion remains low-priority and off-by-default design work.

---

## System Overview
The "Soul" of Ouroboros V2.99 is the rejection of "AI as Art" in favor of **"AI as Engineering."** It acknowledges that LLMs are probabilistic engines prone to the "illusion of thinking" and counters this with rigorous statistical process control.

The Ouroboros Engine is a recursive, self-improving AI system architected around the **Verified Synthesis** protocol. It replaces traditional "consensus-seeking" agent swarms with a rigorous pipeline of **Divergent Generation** followed by **Convergent Verification**.

The system is a **Local-First Web Application** built with React, TypeScript, Dexie.js (IndexedDB), and Zustand. It is designed to run entirely in the browser, orchestrating complex interactions between local models (Ollama), cloud models (Groq, Gemini, OpenAI), and the user.

* **Constraint - NOT a Coding Agent:** Ouroboros does **not** generate implementation code. It generates the **"Project Soul"**—System Architecture, Legal Strategy, Scientific Methodology, and Master Plans.

---

## 🏛️ Part 1: The Core Philosophy
**Adversarial Engineering**

The main goal of Ouroboros V2.99 is the rejection of high-latency "Voting" systems in favor of **"Proven Conflict."** We acknowledge that LLMs are probabilistic engines prone to "Sycophancy" (agreeing with the group). A committee of 3 agreeing agents is often just a "Shared Hallucination."

**The Core Truth:**
1.  **Conflict > Consensus:** A single "Antagonist" providing a concrete counter-example is worth more than 10 "Voters" giving a 9/10 score.
2.  **State > Memory:** The "Blackboard" is not just a notepad; it is a **Living Constitution**. Every decision made by an agent must be contractually binding on all future agents.
3.  **Atomic Decomposition:** We do not generate "Features." We generate "Atomic Bricks" (Single functions, single paragraphs). If one brick fails, we do not burn down the factory; we replace the brick.
4.  **Lossless Assembly:** The final step must not "rewrite" the work. It must "stitch" it. "Creative Synthesis" is a failure mode that introduces regression.

---

## 🏗️ Part 2: The Foundation (Infrastructure)
*The bedrock systems that remain unchanged and robust.*

### **2.1 The Hydra (Tiered API Failover)**
A robust reliability layer ensuring 99.9% uptime.
*   **Mechanism:** Client-side failover with "Penalty Box" quarantining.
*   **Tiers:**
    *   **Tier 1 (Architects):** Claude 3.5 Sonnet / GPT-4o.
    *   **Tier 2 (Workers):** Gemini 1.5 Pro / Llama 3 (Groq).
    *   **Tier 3 (Speed):** Haiku / Flash.
    *   **Local (Cost-Free):** Ollama (Qwen, Llama, Mistral, etc.)
*   **Local-First:** Prioritizes local JSON parsing to prevent API-induced data malformation.
*   **V2.99 Implementation Notes:**
    *   [PARTIAL] **Granular Model Defaults:** Some role-specific model settings inherit global default when empty (`model_antagonist` etc.), but others still have explicit defaults (e.g., `model_reflexion`, `model_compiler`) in store defaults.
    *   ✅ **SecurityPatcher Dynamic Model:** `updateConfig()` method added to ensure Security Patcher respects user's model selection.
    *   ✅ **Global Token Tracking:** Implemented `onUsageCallback` pattern in `UnifiedLLMClient` to capture tokens from *all* models (OpenAI, Gemini, Local, Groq) at the source. Metrics persist to `projects` DB and display in the **Project Bible** ("Efficiency Report").
    *   ✅ **Local Model Support:**
        *   Full Ollama integration with CORS proxy support.
        *   **Dual Engine Routing (Local):** Added `local-custom` (standard) and `local-custom-small` (fast) model IDs.
        *   **The "Leviathan" Sandwich:** Small local models (e.g., `gemma:2b`) automatically receive `Leviathan.sandwich()` constraint repetition to improve adherence. (Verified: `engine/leviathan.ts`, `UnifiedLLMClient.ts`)
        *   **JSON Mode Enforcement:** Local small models force `response_format: { type: "json_object" }` to prevent markdown bleed.
    *   [PARTIAL] **Dual-Interface Adapter:** The hybrid `generateContent` + `models.generateContent` adapter is implemented in `engine/OuroborosEngine.ts` as `llmAdapter` for subsystem compatibility; `UnifiedLLMClient` itself primarily exposes `models.generateContent`.

### **2.2 The Manifestation Log (Visual Interface)**
The user's window into the factory floor.
*   **The Brick Wall:** Visualizes the DAG of Atomic Bricks. `[Future Enhancement: Full 🟢🟡🔴 state visualization]`
    *   🟢 **Verified:** Locked & Committed to Dexie.js.
    *   🟡 **Auditing:** Undergoing Antagonist Review.
    *   🔴 **Failed:** Rejected (Reason displayed).
*   **The Delta Stream:** `[Future Enhancement]` A side-panel showing the "Living Constitution" updating in real-time as agents add rules.
*   **Diff Viewer:** `[Future Enhancement]` Shows the exact changes between a Specialist's Draft and the Repair Loop output.
*   **Verified Templates:** A UI selector in the Settings Panel offering pre-validated project constitutions (Implemented Stacks: React+Vite+Supabase, Next.js+Prisma, Python+FastAPI).
*   **V2.99 Implementation Notes:**
    *   ✅ **Prism Node Visualization:** Purple-themed node showing council/task counts in FlowCanvas.
    *   ✅ **Constitution Node Visualization:** Amber-themed node showing constraints/decisions/warnings.
    *   ✅ **"View Original Prompt" Button:** Modal overlay to view the original PRIMA MATERIA after factory runs.
    *   ✅ **Legacy Department Buttons Deprecated:** UI updated to use Dynamic Prism's Council instead of hardcoded departments.

### **2.3 The Masonry (State & Persistence)**
*   **Technology:** Dexie.js (IndexedDB wrapper).
*   **Role:** Checkpointing & Time Travel.
*   **Features:**
    *   **Resume Capability:** If the user refreshes the page or the browser crashes, the "Factory" resumes exactly at the last verified brick.
    *   **The Session Codex:** Maintains a versioned history of the Blackboard for viewing.
    *   **Auto-Save Architecture:** The system uses a dedicated `'current_session'` slot for high-frequency auto-saves (every step), keeping "Named Saves" pristine until explicitly overwritten.
    *   **Time-Travel Rollback:** `[Future Enhancement]` Allows undoing the last N Bricks and resetting state to that exact moment.

### **2.4 Global Control (The Pause Button)**
*   **Role:** Manual "Break Glass" Intervention.
*   **Function:** Allows the user to **HARD PAUSE** the Factory at any split-second. The system serializes the current state to disk and halts.
*   **Usage:** `[Future Enhancement: Full Pause-Inspect-Resume Workflow]` User inspects the "Auditing" state, manually patches a hallucination in the Blackboard, and clicks **RESUME**.

---

## 🧠 Part 3: The Setup Phase (High-Intelligence)
*Before the factory starts, we must design the blueprint.*

### **3.1 The Oracle (Proactive Consultant)**
*   **Role:** The Interviewer.
*   **Input:** User's raw, vague idea.
*   **Mechanism:** A chat interface that conducts a **Contextual Interview**. (Basic implementation exists in `components/oracle/`)
*   **Features:**
    *   **Shadow Contextualizer (Vibes):** ✅ **IMPLEMENTED (V2.99)**
        *   Instantly generates 3 distinct "Potential Constitutions" (e.g., MVP vs Enterprise vs Experimental) from a single sentence.
        *   Reduces "Oracle Fatigue" by offering choices instead of 20 questions.
    *   **Deep Prompt Refinement:** ✅ **IMPLEMENTED (V2.99)**
        *   Takes the selected "Vibe" and transforms the user's idea into a strict Technical Specification (Project Bible).
    *   **Branching Interviews:** `[Future Enhancement]` Dynamically follows lines of inquiry based on user answers.
    *   **Unknown Unknowns:** `[Future Enhancement]` Forces the user to clarify ambiguity (e.g., "Do you want SQL or NoSQL?") *before* we burn tokens on generation.

### **3.2 The Genesis Protocol (Constitution & Templates)**
*   **Role:** The Constraint Setter.
*   **Philosophy:** "The system never 'just starts.' It establishes Global Constraints first."
*   **Step A: The Library Scan (Layer 1):** ✅ **IMPLEMENTED (Opt-In)**
    *   Queries the **Pre-Seed Library** (currently Keyword/Tag Matcher via Dexie.js).
    *   *Action:* Seeds the Blackboard with high-level competencies so agents start with Senior-level context.
    *   *Note:* The "Vector DB" implementation is deferred. Current implementation uses `anyOf` keyword matching.
    *   *Future Requirement:* Upgrade to true Vector Embeddings for semantic matching.
    *   *Config constraint:* This feature is **Disabled by Default** in Settings to prevent overriding custom user architectures (e.g. asking for Python but getting a React template). Users can enable it in the Settings Panel.
*   **Step B: Genesis Fallback (Magic Mode):**
    *   *Trigger:* If NO template is found.
    *   *Action:* Spawns a high-reasoning **Genesis Agent** to analyze the user's intent and generate a custom Constitution (Constraints, Roles, Tech Stack) from scratch.
    *   *Architecture Note:* Uses a **"Regex Rescue"** fallback if the LLM's YAML output is malformed, attempting to extract domain/tech stack via pattern matching before failing.
*   **Step C: The Conflict Check:** 
    *   The system analyzes the User's specific Prompt against the selected Template to catch fundamental contradictions (e.g., "User asked for Python, but Template requires Node.js") before execution.

### **3.3 The Dynamic Prism (Atomic Decomposition)**
*   **Role:** The Team Builder & Atomizer.
*   **Step A: Domain Classification:**
    *   Analyzes [Constitution + User Prompt] to determine the specific domain (e.g., "Corporate Law" vs. "Quantum Physics").
*   **Step B: Atomic Council Proposal (m=1):**
    *   The Prism proposes a custom **Council of Specialists** tailored to the domain.
    *   **Atomic Questions:** Breaks the request into single-step questions/tasks (e.g., "Define the Zod Schema" instead of "Build the Page").
*   **Step C: Adaptive Routing (ACT):** ✅ **VERIFIED (V2.99)**
    *   Assigns a **Complexity Score** to each atomic question.
    *   *Action:* Simple questions (< 5) -> "Fast Path" (Flash). Complex questions -> "Slow Path" (Sonnet/Pro).
    *   *Config:* Configurable via Settings Panel (Adaptive Routing & Fast Model Selector).
*   **Step D: User Review:**
    *   The user is presented with the Council list and tasks as buttons in the UI and can toggle members/tasks **ON/OFF**.
*   **V2.99 Implementation Notes:**
    *   ✅ **Fallback Task Generation:** If Prism returns 0 tasks (JSON parse failure), the system retries with higher temperature (0.8), then generates basic fallback tasks.
    *   [LEGACY/PARTIAL] **JSON Retry UI:** `JsonRetryDialog.tsx` exists, but active retry behavior is currently driven by Prism/runtime `jsonRetryMode` settings rather than a wired manual dialog flow.
    *   ✅ **Atomicity Validator:** Implemented robust validation logic (`validateAtomicity()`) that rejects tasks containing:
        *   **Multiple Action Verbs:** "Create AND validate" (Non-atomic).
        *   **Compound Conjunctions:** "and", "then", "also".
        *   **Vague Scope:** Tasks with no clear deliverables.
        *   *Action:* Triggers `redecomposeTask()` (max 3 passes) to force granular breakdown.

### **3.4 The Saboteur (Scope Stress Test)**
*   **Role:** The Adversary.
*   **Input:** The Prism's proposed Task List.
*   **Mechanism:** A hostile agent ("The Red Team") that tries to identify missing requirements or logic gaps.
*   **Outcome:** It forces the Prism to inject "Missing Bricks" into the list before execution begins.
    *   **Domain Checklists:** Uses strictly defined checklists for **Web Apps** (Auth, DB, UI), **APIs** (Rate Limits, Docs), **Mobile** (Offline, Push), **Data Pipelines**, and **ML Ops** to ensure completeness. (Verified: `engine/saboteur.ts`)
*   **V2.99 Implementation Notes:**
    *   ✅ **Zero-Tasks Handling:** If Prism generates 0 tasks, Saboteur skips domain completeness check (prevents generic "error handling" / "security" brick injection on empty lists).
    *   ✅ **assignedSpecialist Fix:** Injected missing bricks now correctly receive a specialist assignment (Council Lead as fallback).

---

## 🏭 Part 4: The Factory Floor (Production)
*The Core Execution Loop: Specialist -> Self-Correction -> Surveyor -> Antagonist -> Mason.*

### **4.1 The Specialist Worker (The Generator)**
*   **Role:** The Single-Threaded Expert.
*   **Input:** `AtomicInstruction` + `LivingConstitution` + `SkillInjections`.
*   **The Refusal Directive:**
    *   **Rule:** If context is missing/ambiguous, the Agent **MUST** output `[UNKNOWN]` or `[CONFLICT]`.
    *   *Result:* Triggers a "User Intervention Pause" instead of a hallucinated guess.
*   **The Output Schema:**
    1.  `### TRACE`: Internal chain-of-thought (Hidden).
    2.  `### BLACKBOARD DELTA`: Proposed updates to global rules.
    3.  `### ARTIFACT`: The actual content/code.

### **4.2 The Reflexion Loop (Worker Self-Correction)**
*   **Role:** The Cheap Mirror.
*   **Concept:** Don't send garbage to the expensive Audit.
*   **Mechanism:**
    *   Immediately after generation, the Specialist runs a fast call (Gemini Flash): *"Critique your own work. List EXACTLY 3 potential flaws."* (Verified Prompt)
    *   If flaws are found, it performs a **Fast Repair** before submitting to the Surveyor.
    *   *Cost:* Negligible. *Benefit:* Drastically reduces Antagonist rejection rate.

### **4.3 The Blackboard Surveyor (The Fast Gate)**
*   **Role:** The Cheap "Sanity Check" before expensive compute.
*   **Mechanism:** A strictly regex/code-based filter (Zero Cost).
*   **Action:** Scans for **Red Flags**:
    *   **Hedging Language:** "I think", "Maybe", "It depends", "Possibly", "It seems" (Immediate Discard - Threshold: 3+ matches).
    *   **Formatting:** Broken JSON or missing `### ARTIFACT` blocks.
    *   **Refusals:** "I cannot do that", "As an AI", "I am not programmed", "I must decline" (Immediate Discard).
    *   **Runaway Loops:** Token count > 3,000 (Indicates likely repetition loop or failure to converge; Atomic Bricks should be concise).
    *   **Implementation Code Detection:** ✅ (V2.99 Addition) Detects `import`, `function`, `class` statements to enforce the "NOT A CODING AGENT" constraint. (Verified: `engine/blackboard-surveyor.ts`)
    *   **Granular Controls:** ✅ (V2.99 Verified) Specific flags can be disabled in Settings (e.g. allow "Too Generic" for broad tasks).
*   **Outcome:** Immediate Discard & Retry ($0 Cost).

### **4.4 The Antagonist Mirror (The Auditor)**
*   **Philosophy:** "Trust is a weakness. Prove me wrong." (A 1-on-1 Duel).
*   **Mechanism:** A hostile agent reviews the `ARTIFACT` against the `CONSTITUTION`.
    *   *Architecture Note:* The Antagonist is **Architecture Agnostic**. It does not enforce "Local-First" or "No-Cloud" biases unless they are explicitly written in the `LivingConstitution`. It judges solely on **Internal Consistency** and **Format Compliance** (e.g. No Implementation Code).
*   **The "Habeas Corpus" Rule:**
    *   The Antagonist **CANNOT** reject a brick without citing **Evidence**.
    *   **Mechanism:** Returns an `EvidenceItem[]` array where each item requires `{ type, content, explanation }`.
    *   **Auto-Pass Rule:** If the `evidence` array is empty, the parser automatically overrides a "Fail" verdict to "Pass" (Habeas Corpus enforced by code).
    *   It must provide a **Direct Quote** from the Constitution or the Artifact that demonstrates the contradiction.
*   **The Repair Loop:** 
    *   **Fail:** Returns the specific "Evidence of Failure" to the Specialist for **One** focused repair attempt.
    *   **Pass:** Marking the Brick as `verified`.
*   **Predictive Cost Scaling (Efficiency Governor):** ✅ **VERIFIED (V2.99)**
    *   If the Antagonist rejects a brick, the system automatically **upgrades** the model (to S-Tier) and **lowers** the temperature (to 0.2) for the retry attempt to force convergence.

### **4.5 The Blackboard Delta (The Living Constitution)**
*   **Concept:** Global State Synchronization.
*   **Mechanism:**
    *   When a Brick is verified, its `### BLACKBOARD DELTA` is merged into the Global Context.
    *   **Effect:** Agent B (Step 10) can explicitly see the decisions made by Agent A (Step 5).

---

## 🧠 Part 5: Memory & Assembly (The "Soul")

### **5.1 The Memory System (Client-Side RAG)**
*Bringing the "Agent Bible" Tenets to the Browser.*

*   **1. The Librarian (Skill Extraction):** `[Future Enhancement: Full skill extraction]`
    *   Basic memory exists in `agent-memory-manager.ts`.
    *   **Golden Standards Seeding:** On first boot, the system pre-loads `seed_skills.json` (The "Teflon Stack") to ensure Senior-level competence from Day 1.
*   **2. The Project Insight Layer (Mid-Term Memory):** `[ACTIVE / V2.99 Implemented]`
    *   **Mechanism:** Every 5 verified Bricks, the `ProjectInsightManager` runs a background "Reflection Pass."
    *   [PARTIAL] **Action:** Synthesizes high-level observations into a markdown insights payload managed by runtime/store and persisted with project/session state (not currently written as a standalone `project_insights.md` file in repo).
    *   **Injection:** This file is fed into every Specialist's context (via prompt injection) to prevent style drift and enforce architectural inconsistencies.
    *   **Reflexion Loop:** Now Constitution-aware using these insights.
*   **3. The Pre-Flight Check (Injection):**
    *   Before a Specialist starts a task, the system queries `db.skills` and injects "Top 3 Related Solved Problems".
*   **4. The Anti-Pattern Library (The Cautionary DB):** `[Future Enhancement]`
    *   When the Antagonist rejects a brick, the failure mode is generalized and stored (e.g., "Don't use `eval()`").
    *   These are injected as "Negative Constraints" in future prompts.

### **5.2 The Security Patcher (The Additive Judge)**
*   **Role:** Red Team Consultant & Composition Discriminator.
*   **Timing:** Runs *after* all Bricks are verified but *before* final assembly.
*   **Mechanism:** Reads the entire collection of Verified Bricks checking for **Security Gaps** and **Dropped Warnings**.
*   **Action:** If critical, it rejects back to the Masonry. If minor, it appends a "Security Addendum" brick.
*   **Security Override:** ✅ **VERIFIED (V2.99)** - The "Allow Code Generation" setting explicitly bypasses the implementation code veto for experimental coding runs.

### **5.3 The Lossless Compiler (Assembly)**
*   **Role:** The Stitcher.
*   **Philosophy:** "Assembly, not Synthesis."
*   **Input:** Array of `VerifiedBricks` + `SecurityAddendum`.
*   **Mechanism (Artifact Passthrough):**
    *   Receives the **Raw JSON Array** of artifacts (bypassing generic summarization context).
    *   **Chain of Density:** Prompted to "Retain all Named Entities (functions, variables) exactly as they appear."
    *   **Strict Prohibition:** "DO NOT CHANGE A SINGLE WORD OF THE ARTIFACT CONTENT."
*   **Goal:** To preserve the specific, verified "Truth" generated by the specialists.

---

## ⚙️ Part 6: Operational Directives

### **6.1 Operational Directives (The Settings Purge)**
*Strict codebase cleanup required to enforce the Factory/Standard.*

*   **Hardcode Flags:**
    *   `enableRedFlagging = true` (Safety is not optional).
    *   `enableAgentMemory = true` (Learning is not optional).
    *   [LEGACY WORDING] `enableAntagonistProtocol = true` is the active setting; `enableMultiRoundVoting` remains deprecated/backward-compatibility naming.
*   **Remove Deprecated Settings:**
    *   `initialJudgeCount` (Replaced by Antagonist Duel).
    *   `maxMicroAgentDepth` (Architectural constant, not user choice).

### **6.2 The Paraphraser Strategy (Deadlock Breaking)** `[Future Enhancement]`
*   If the Antagonist and Specialist get stuck in a "Reject -> Repair -> Reject" loop (Deadlock):
*   **Action:** The system pauses and spawns a **Paraphraser Agent** to rewrite the original instruction with increased "Noise" (Decorrelation) to shake the model out of its local minima.

### **6.3 Model Role Mapping (Recommended Configuration)**

| Component | Recommended Model | Role |
| :--- | :--- | :--- |
| **Genesis** | GPT-4o / Sonnet 3.5 | Constitution Generation (High Reasoning) |
| **Prism** | GPT-4o | Council Spawning & Task Splitting |
| **Saboteur** | Claude 3.5 Sonnet | Stress Testing (Adversarial Logic) |
| **Specialist** | Adaptive (Tier 1-3) | Content Generation (Routed by Complexity) |
| **Reflexion** | Gemini Flash | **Self-Correction** (Fast/Cheap) |
| **Antagonist** | Claude 3.5 Sonnet | Logic Auditing & Evidence finding (Slow/Expensive) |
| **Compiler** | GPT-4o | Formatting & Assembly (High instruction following) |

---

## 🔧 Part 7: V2.99 Refinement Strategy Additions

*These are architectural improvements implemented to address the "Limp Mode" reliability issues. See `V2.99_Refinement_Strategy.md` for full details.*

### **7.1 The "Soft-Strict" Protocol (Communication Loop)**
*Replacing fragile JSON blobs with a Notebook State Model.*

*   **Problem:** JSON inter-agent communication causes "Cognitive Choke" in smaller models.
*   **Solution:** "Think in Markdown, Commit in YAML."
    1.  **Thinking Phase:** Agents write reasoning in Natural Language Markdown.
    2.  **Commit Phase:** At the end, agents output a delimited ` ```yaml ` block with structured data.
    3.  **Storage:** Merged into project/session state (`projects.livingConstitution` + verified-brick flows) in Dexie-backed persistence; there is no dedicated `db.blackboard` table in current schema.
*   **Status:** ✅ **IMPLEMENTED**
    *   `utils/safe-json.ts` - Added `extractYaml`, `parseYamlText`, `safeYamlParse` functions (Verified)
    *   `engine/blackboard-delta.ts` - YAML-first parsing with JSON fallback (Verified)
    *   `engine/genesis-protocol.ts` - Soft-Strict output format
    *   `engine/antagonist-mirror.ts` - Tribunal uses YAML output
    *   `engine/saboteur.ts` - Red Team uses YAML for gap analysis
    *   `engine/reflexion-loop.ts` - Self-Correction uses YAML commits
    *   ✅ **Type-Safe Delta Sanitizer:** `engine/blackboard-delta.ts` now includes a `sanitizeDelta()` layer that strictly enforces `string[]` types, preventing crashes from LLM Object/Null hallucinations (e.g. `trim() is not a function`).

### **7.2 ReCAP (Recursive Context-Aware Planning)**
*Moving from flat task lists to hierarchical decomposition.*

*   **Problem:** A flat list of 50 tasks loses hierarchical context.
*   **Solution:** Fractal Tree decomposition.
    1.  **Level 0:** Prism generates 3-5 high-level "Epics."
    2.  **Recursive Expansion:** Engine spawns Prism Workers for each Epic until `type: "atomic"`.
    3.  **Vertical Context Injection:** Child workers receive parent's intent summary.
*   **Status:** ✅ **IMPLEMENTED**
    *   `types.ts` - Extended `Node` interface with `childrenIds`, `parentId`, `decompositionStatus`, `depth`
    *   `db/ouroborosDB.ts` - Database schema Version 3 with tree field indexes (Verified)
    *   `engine/OuroborosEngine.ts` - `executeRecursivePrism(nodeId)` method (Verified)
    *   `prism-controller.ts` - `parentContext` injection, removed task limits ("Existential Explosion")
    *   `components/GraphView.tsx` - Tree View mode with vertical layout, depth-based coloring
    *   `store/ouroborosStore.ts` - `maxRecursiveDepth` setting (default: 3)

### **7.3 Prompt Repetition (The "Leviathan Pattern")**
*Research-backed technique for improving non-reasoning model adherence.*

### **2.5 The Local Engine (Pragmatic Optimization)**
*   **Philosophy:** "Dual Engine Architecture" to run Ouroboros on consumer hardware (<12GB VRAM).
*   **Mechanism:** Splits execution into **Power Engine** (Reasoning) and **Speed Engine** (Repetition).
*   **Power Engine (Standard):**
    *   **Target:** `llama3:70b`, `qwen:72b` (Local) or Cloud Models.
    *   **Usage:** Genesis, Prism, Compiler.
    *   **Mode:** Standard Full-Context Prompting.
*   **Speed Engine (Lite):**
    *   **Target:** `gemma3:4b`, `llama3:8b` (Local).
    *   **Usage:** Specialist, Surveyor, Antagonist.
    *   **Trigger:** Activated via `local-custom-small` model ID.
    *   **Lite Mode:**
        *   **Specialist:** Switches identity to "System Architect" (Strict JSON, No Persona Fluff).
        *   **Antagonist:** Switches identity to "Checklist Validator" (Binary Pass/Fail).
        *   **Context:** Pruned Constitution (Summary only) to save context window.

---

## 🧠 Part 3: The Setup Phase (High-Intelligence)

[... no changes to existing content ...]

### **7.3 Prompt Repetition (The "Leviathan Pattern")**
*   **Source:** `arXiv:2512.14982v1` (Google Research, Leviathan et al. 2025)
*   **Mechanism:** Repeating critical constraints at the start **AND** end of the prompt ("Doppler Sandwich").
*   **Status:** ✅ **IMPLEMENTED (V2.99)** via `engine/leviathan.ts`.
*   **Integration:**
    *   Automatically wraps prompts for **Small Models** (`local-custom-small`).
    *   Core Constraint: "NO IMPLEMENTATION CODE" is reinforced at the tail.
    *   Forcefully enables `json_object` mode for Ollama 4B models to prevent format bleeding.

### **7.4 The Scaffolder (Bridging the Value Gap)**
*Generating downloadable project skeletons.*

*   **Artifact A: "Project Soul":** The Master Specification (unified Markdown from all bricks).
*   **Artifact B: "The Scaffolder":** A `.zip` file with directory structure, config files, and empty file stubs (interfaces only, no implementation).
*   **Philosophy:** Ouroboros generates the blueprint; coding agents fill in the blanks.
*   **Status:** ✅ **IMPLEMENTED**
    *   `engine/scaffolder.ts` - Complete Scaffolder class (~1200 lines) (Verified)
        *   `ScaffoldConfig`, `FileNode`, `ScaffoldResult` interfaces
        *   `generateFileTree()` - Full project directory structure
        *   `generateZip()` - JSZip client-side ZIP creation
        *   Tech-aware templates: React, Next.js, Express, Tailwind, Prisma, Vite detection
        *   Generates: package.json, tsconfig.json, README.md, .gitignore
        *   Service stubs with CRUD methods and JSDoc
        *   TypeScript interfaces from brick instructions
        *   React component stubs (when React detected)
        *   Test stubs with `it.todo()` markers
    *   `engine/OuroborosEngine.ts` - Extended `downloadProject('scaffold')` method
    *   `components/ControlPanel.tsx` - ZIP button with `FolderArchive` icon
    *   `package.json` - Added `jszip` dependency (`^3.10.1`)

---
## Part 8: Post-Jan Implementation Reality (Tasks + Code Cross-Reference)

- [ACTIVE] Phase 7-10 trajectory is reflected in code: decomposition hardening, retry/tribunal transparency, scheduling controls, and canonical+soul output pipeline.
- [ACTIVE] Settings-gated controls now exist for decomposition strategy, execution strategy, dependency enrichment, output profile, strictness, guided repair, and compatibility mode.
- [CHECKPOINT PENDING] Several task checkpoints are still open (for example Phases 9-10 validation gates) and should be treated as not fully production-validated yet.
- [FUTURE/LOW PRIORITY] MCP/tool/browser/tool-market style expansions are documented in tasks as deferred and should remain off by default until security/synergy gates pass.

### Future Implementation Notes (Atlas Alignment)

- MCP is a protocol boundary, not an automatic compute multiplier by itself; overhead depends on enabled tools and call policy.
- Provider-native browsing/tool use is not implicitly "on" for all model calls; it requires explicit model/provider/tool configuration and policy gates.
- Recommended insertion point for future MCP: between orchestration planning and tool execution adapters, with append-only audit logging and strict allowlists.

*Atlas Updated: Feb 16, 2026*

