# ♾️ THE OUROBOROS ENGINE V2.99 - USER GUIDE & DEEP CONTEXT

> **"A council that eats its own errors to birth perfection."**

This guide provides an intense, deep-dive explanation of how the Ouroboros Engine functions, how its components interconnect, and how you—the Architect—can influence its deterministic outcomes.

---

## 🏗️ DEEP ARCHITECTURE: HOW IT THINKS

The Ouroboros Engine is **NOT a coding agent**. It is an **Architectural Specification Engine**. It does not write your app; it writes the *perfect plan* for your app so that a coding agent (like Cursor/Windsurf) can build it without thinking.

### 1. 🔮 THE PRISM (The Decomposer)
The Prism is the most critical component. It is the "Manager" that breaks your vague dreams into concrete tasks.

*   **How it works:**
    1.  **Domain Classification:** It analyzes your prompt + Constitution to figure out if you are building a "Crypto Exchange," "SaaS," or "Game." (It classifies *specifically*, avoiding generic terms like "Web App").
    2.  **Council Proposal:** It invents 3-5 "Specialist Personas" (e.g., *Database Architect*, *Security Auditor*) tailored to that domain.
    3.  **Atomic Decomposition:** It asks the LLM to break the goal into single-step tasks.
    4.  **Atomicity Validation:** It runs a grammar check. If a task has "AND" or multiple verbs, it rejects it and splits it again.
    5.  **Adaptive Routing:** It assigns "Complexity Scores" (1-10). Complex logic goes to Slow Models (GPT-4), simple boilerplate goes to Fast Models (Flash).

*   **Behavioral Bias:** The Prism is biased towards **Over-Decomposition**. It prefers 20 small tasks over 1 big task. This is intentional (MDAP Principle).

### 2. 📜 THE GENESIS PROTOCOL & CONSTITUTION
The Constitution is the "God Object" of your project. It is strictly hierarchical.

*   **How it is made:**
    1.  **Library Scan:** It first checks your `db/seeds` for "Golden Templates." If you ask for a "React App," it might load a pre-validated strict template.
    2.  **Genesis Fallback (Magic Mode):** If no template is found, a high-reasoning "Genesis Agent" spawns. It is **opinionated**. It will force strict constraints (e.g., "Must use strict TypeScript," "No `any` types") even if you didn't ask for them, to prevent project rot.
    3.  **Conflict Resolution:** It checks your prompt against the template. If you ask for "Vue" but the template is "React," it flags a conflict.

*   **Partiality/Bias:**
    *   **Yes, it is biased.** It favors **Modern, Type-Safe Stacks** (TypeScript > JS, PostgreSQL > Mongo).
    *   It favors **Stability over Newness**. It will reject experimental beta libraries unless explicitly overridden.

### 3. 🧠 DECISIONS (ACCUMULATED) vs. WARNINGS
The "Blackboard" is the shared brain.

*   **DECISIONS (Immutable):**
    *   *How they come to be:* When a Specialist finishes a task, they output a `### BLACKBOARD DELTA` JSON block.
    *   *Example:* `{"decisions": ["Use JWT for auth", "API timeout set to 5000ms"]}`.
    *   *Impact:* Once verified, these Strings are **copied into the prompt of EVERY future agent**. Agent #5 *cannot* choose Cookie Auth if Agent #2 already committed to JWT.
    *   *Correction:* The only way to undo a Decision is to **Time Travel (Rollback)** the brick that made it.

*   **WARNINGS (Advisory):**
    *   *How they come to be:* The **Saboteur** or **Specialist** can flag risks.
    *   *Example:* "Warning: This auth flow may expose XSS if not careful."
    *   *Impact:* These are injected into prompts as "Things to watch out for," but they do not strict-block logic like Decisions do.

---

## ⚙️ V2.99 FACTORY PROTOCOLS (SETTINGS EXPLAINED)

These settings control the "rigor" of the factory.

### 🚩 Red Flagging (The "Bouncer")
*   **What it is:** A REGEX-based (non-LLM) filter.
*   **How it works:** It scans output for "lazy words" (e.g., "I think", "Maybe", "TODO", "Placeholder").
*   **Impact:** If it finds them, it **kills the task immediately** (0 cost). It forces the model to be decisive.
*   **Advice:** Keep this **ON**. If turned off, agents become sycophantic wafflers.

### 🎭 Antagonist Protocol (The "Mean Reviewer")
*   **What it is:** The Adversarial Agent (Saboteur/Tribunal) that reviews work.
*   **How it works:** It is prompted to be "Hostile." It looks for reasons to reject work.
*   **Impact:** High settings mean almost *perfect* code, but SLOW progress (many rejections).
*   **Advice:**
    *   **Strict Mode:** For Core Architecture / Security tasks.
    *   **Lax Mode:** For simple UI/Content tasks (to save money/time).

### 🧠 Agent Memory Consensus Threshold (%)
*   **What it is:** (Experimental) When agents vote, what % must agree?
*   **Context:** Used in the `Tribunal` voting system.
*   **Impact:** Higher = More deadlocks (requires unanimity). Lower = Faster, but riskier.
*   **Recommendation:** 60-70% is usually the sweet spot.

### 🧱 MAX ATOMIC TASKS
*   **What it is:** Hard limit on how many tasks Prism can generate at once.
*   **Impact:**
    *   **Low (5-10):** Good for "MVP" sprints. Keeps context tight.
    *   **High (30-50):** Good for massive deep-dives, but risks context window overflow later in the chain.

### 🔄 MAX DECOMPOSITION PASSES
*   **What it is:** How many times Prism tries to split a task that failed "Atomicity Check".
*   **Context:** If a task says "Design AND Build AND Test," Prism splits it. This setting limits recursion depth.
*   **Current State:** **⚠️ Semi-Hardcoded.** The UI setting exists, but the core engine often defaults to `3`.
*   **Advice:** Treat this as a "read-only" concept for now—the system naturally tries 3 times.

### 👥 MAX COUNCIL SIZE
*   **What it is:** How many distinct "Personas" are created.
*   **Impact:**
    *   **Small (3):** Domain Expert, Architect, QA. (Fast, consistent).
    *   **Large (10):** Specific roles like "GDPR Specialist." (Deep, but high token cost).

### ♻️ JSON RETRY MODE
*   **What it is:** How the system handles malformed JSON (the #1 LLM error).
*   **Options:**
    *   **Prompt:** Ask the LLM nicely to fix it (Costs tokens, slower).
    *   **All:** Aggressive auto-fix using regex (Fast, but might truncate data).
    *   **None:** Just fail and ask User.

### 📉 RECURSIVE DECOMPOSITION
*   **What it is:** The "Micro-Agent" toggle.
*   **How it works:** If a *single* Atomic Task is still too big (e.g., >2000 tokens), this spawns a `MicroAgentDecomposer` to split that ONE task into sub-tasks dynamically at runtime.
*   **Advice:** **Enable for complex backends.** Disable for simple UI work (it adds latency).

---

## 💡 PRO TIPS & "OFF-THE-RECORD" ADVICE

### 1. The "Prompt-Fu" for Ouroboros
Don't prompt it like ChatGPT. Prompt it like you are hiring a contractor.
*   **BAD:** "Make me a twitter clone." (Result: Generic garbage).
*   **GOOD:** "I need a scalable micro-blogging architecture. Focus on high-throughput feed ingestion using Redis fan-out strategies. Stack: Next.js + Go backend."
*   **WHY:** The Prism looks for *keywords* (Redis, Go, High-throughput) to classify the domain. Give it meat to chew on.

### 2. "The Oracle" is your best friend
Before hitting "Start Factory," use the **Oracle (Interviewer)**.
*   Click the **Crystal Ball** icon.
*   Tell it your vague idea.
*   Let it grill you with 3-4 questions.
*   After the interview, click **"Perform Context Fusion"**.
*   **Outcome:** This generates a "Prima Materia" text block that is 10x better than anything you could write manually. Feed *that* into the Factory.

### 3. Handle "Zero Tasks" Bug
Sometimes Prism gets confused and yields 0 tasks (usually due to a JSON parse error that was silently swallowed).
*   **Fix:** If you see 0 tasks, **Refresh the Page**. The state is saved in `IndexedDB`. A refresh often clears the "bad context" and lets you retry the Prism step cleanly.

### 4. Influence the Constitution
If you hate the default stack (e.g. it always picks Tailwind):
*   In your **Initial Prompt**, write: `NEGATIVE CONSTRAINT: Do NOT use Tailwind. Use Vanilla CSS Modules.`
*   The **Genesis Protocol** has a specific "Conflict Check" step that looks for these ALL-CAPS constraints and binds them into the Constitution permanently.

### 5. Temperature Tuning
*   **Genesis/Prism:** Keep temperature moderate (`0.5-0.7`) for creativity in planning.
*   **Specialists:** If they are hallucinating APIs, lower the global temperature to `0.2`.
*   **Antagonist:** Keep high (`0.7+`). You want a "creative" hater, not a boring one.

---

## 🧩 TROUBLESHOOTING

*   **"All Heads Severed" Error:**
    *   Means your API key is dead or rate-limited.
    *   **Fix:** Check `Settings -> Model Configuration`. Switch to a "Backup" model (e.g., if GPT-4 fails, manually select Claude Sonnet).

*   **"Lackluster" Decomposition:**
    *   Means Prism classified the domain as "General."
    *   **Fix:** Add specialized keywords to your prompt (e.g., "Enterprise," "Compliance," "High-Frequency"). The Prism needs signal to trigger specialized decomposition paths.

*   **System feels stuck/slow:**
    *   It's likely the **Antagonist** is rejecting everything.
    *   **Check:** Look at the "Brick Wall" (visualization). If you see many RED bricks, the Antagonist is winning.
    *   **Fix:** Improve your prompt rigor or (temporarily) lower the Antagonist usage.

---
*Generated by Antigravity for The Ouroboros Engine V2.99*
