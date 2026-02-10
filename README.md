<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React"/>
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite"/>
  <img src="https://img.shields.io/badge/Zustand-000000?style=for-the-badge&logo=react&logoColor=white" alt="Zustand"/>
  <img src="https://img.shields.io/badge/IndexedDB-FF6F00?style=for-the-badge&logo=databricks&logoColor=white" alt="IndexedDB"/>
</p>

<p align="center">
  <strong>Status: V2.99 (MVP) - Stable Release</strong><br/>
  <em>Some features listed in the Atlas (V3.0) are currently in development. See <a href="#-roadmap--future-work">Roadmap</a>.</em>
</p>

<h1 align="center">♾️ The Ouroboros Engine</h1>

<p align="center">
  <strong>A council that eats its own errors to birth perfection.</strong><br/>
  <em>Creation through destruction. Perfection through recursion.</em>
</p>

**GitHub Repository:** [github.com/spindouken/The-Ouroboros-Engine](https://github.com/spindouken/The-Ouroboros-Engine)  
**Deployed Demo:** [the-ouroboros-engine.vercel.app](https://the-ouroboros-engine.vercel.app/)  
**Project Type:** Solo/Individual Project  
**Role:** Sole Developer, Architect, and Designer  
**Tech Stack:** TypeScript, React, Zustand, Dexie.js (IndexedDB), Vite

<p align="center">
  <a href="#-core-capabilities">Capabilities</a> •
  <a href="#-architecture-overview">Architecture</a> •
  <a href="#%EF%B8%8F-the-named-systems">Named Systems</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-the-origin-story">Origin Story</a>
</p>

---

## 🎯 TL;DR — AI Engineering Keyword Summary

| Category | Technologies & Concepts |
|----------|------------------------|
| **Agentic AI** | ReAct Loop • Multi-Agent Orchestration • Reflexion • Chain-of-Thought (CoT) • Iterative Self-Correction • Adversarial Verification |
| **LLM Engineering** | Prompt Engineering • Temperature Tuning • Model Tiering • Token Optimization • Hallucination Mitigation • Maximal Agentic Decomposition (MAD) |
| **Architecture** | Microservice-Style Agents • DAG Scheduling • State Machines • Event-Driven Design • Client-Side RAG • Vector Embeddings |
| **Reliability** | Red-Flagging • Multi-Round Voting • Tiered Failover • Penalty Box Quarantining • Rate Limiting • Quota-Aware Scheduling |
| **State & Memory** | State Persistence • Agent Memory Systems • Knowledge Graphs • Blackboard Architecture • Checkpointing • Time-Travel Debugging |
| **Data Engineering** | IndexedDB (Dexie.js) • Local-First Architecture • JSON/Markdown Uniformity • Schema Validation • Chain-of-Density |
| **UX & Control** | Human-in-the-Loop (HITL) • Pause/Resume State Serialization • Manual Intervention Gates • Real-Time Visualization |
| **Observability** | Internal Reasoning Traces • Extensive Debug Logs • Execution Timelines • Replayable Sessions • Diff Visualization |
| **ML Ops Patterns** | Small-Model Specialization + Large-Model Synthesis • Adaptive Complexity Routing • Anti-Pattern Libraries • Golden Seed Injection |

---

## 🌟 What is The Ouroboros Engine?

**The Ouroboros Engine** is a **recursive, self-improving AI orchestration system** that fundamentally rejects the "AI as Art" paradigm in favor of **"AI as Engineering."** It acknowledges that Large Language Models are probabilistic engines prone to the "illusion of thinking" and counters this with rigorous **statistical process control**, **adversarial verification**, and **industrialized truth production**.

Most AI workflows are linear: `Input → Output`. Ouroboros is **circular and self-referential**—the only way to achieve high-fidelity results without constant human hand-holding.

---

## 📖 The Origin Story

> *I started Ouroboros with a huge v1 scope, and pretty quickly I realized what I actually want this project to solve is a real problem I personally have.*

> *My ideal workflow looks something like this: I take an idea—or even just a rough concept—give it to an AI, and ask it to flesh out a project. I review what it gives me, notice what feels missing, tweak or clarify things, then ask the AI for suggestions. From there, I have it finalize a plan. Then I do some outside research, come back, ask the AI to update the plan based on what I learned, and eventually break everything down into practical, step-by-step tasks that reflect how the project would actually be built.*

> *That loop can repeat endlessly.*

> *At some point, I realized it might even make more sense to have the AI think about the project the way multiple real-world roles would—engineering, product, research, architecture, and so on. You can do this with prompt templates and role-based prompting, but that quickly runs into context limits. Once that happens, things start to bleed together: the model’s thinking gets polluted, nuance drops off, hallucinations creep in, and important details get lost.*

> *Reading about MDAPs in the recent MAKER paper was the spark that pushed this idea further. It inspired me to design a system that breaks this entire process into many small, focused LLM micro-agents, each responsible for a specific perspective or task, with a voting or consensus mechanism to reduce hallucinations. The final output is then composed from all of them working together.*

### Core Philosophy: Adversarial Engineering

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. CONFLICT > CONSENSUS                                             │
│     A single Antagonist providing a concrete counter-example is      │
│     worth more than 10 "Voters" giving a 9/10 score.                │
│                                                                      │
│  2. STATE > MEMORY                                                   │
│     The Blackboard is not a notepad—it is a Living Constitution.    │
│     Every decision is contractually binding on all future agents.   │
│                                                                      │
│  3. ATOMIC DECOMPOSITION                                             │
│     We don't generate "Features." We generate "Atomic Bricks."      │
│     If one brick fails, we don't burn down the factory—we replace   │
│     the brick.                                                       │
│                                                                      │
│  4. LOSSLESS ASSEMBLY                                                │
│     The final step must not "rewrite" the work. It must "stitch."   │
│     Creative Synthesis is a failure mode that introduces regression.│
└─────────────────────────────────────────────────────────────────────┘
```

### What Ouroboros Generates

> **Critical Constraint:** Ouroboros is **NOT** a coding agent. It generates the **"Project Soul"**—System Architecture, Legal Strategy, Scientific Methodology, and Master Plans—the high-fidelity blueprints that coding agents can then execute upon.

---

## 💡 Core Capabilities

### 🔄 The Verified Synthesis Protocol
Ouroboros replaces traditional "consensus-seeking" agent swarms with a rigorous pipeline:

```
┌──────────────────────┐      ┌──────────────────────┐
│  DIVERGENT           │ ───► │  CONVERGENT          │
│  GENERATION          │      │  VERIFICATION        │
│  (Multiple Agents)   │      │  (Adversarial Audit) │
└──────────────────────┘      └──────────────────────┘
```

### 📊 Multi-Stage Validation Pipeline
1. **Red-Flagging** — Fast heuristics detecting poor outputs (hedging language, broken JSON, refusals)
2. **Reflexion Loop** — Agent self-correction before expensive auditing
3. **Antagonist Mirror** — Hostile agent conducting 1-on-1 duels with evidence-based rejections
4. **Tribunal Voting** — Multi-round voting with K-threshold early termination
5. **Human Escalation** — Critical veto triggers human review

### 🧠 Adaptive Model Routing
- **Complexity Scoring** — Simple questions → Fast Path (Flash/Haiku), Complex questions → Slow Path (Sonnet/GPT-4)
- **Tiered Failover** — Automatic fallback from Tier 1 (Architects) → Tier 2 (Workers) → Tier 3 (Speed)
- **Penalty Box Quarantining** — Failed API endpoints are temporarily quarantined

### 💾 Persistent State & Memory
- **Resume Capability** — Browser crashes? Page refresh? Factory resumes exactly at the last verified brick
- **Time-Travel (Rollback)** — Undo the last N bricks and reset state to that exact moment
- **Agent Memory Extraction** — Successful patterns are vector-embedded for future injection
- **Anti-Pattern Library** — Failure modes are generalized and stored as negative constraints

---

## 🏛️ The Named Systems

> Ouroboros features evocatively named components designed to be memorable in technical interviews and demonstrations. Listed below in **logical data flow order**—the sequence a user experiences when running the engine.

---

### **PHASE 1: INFRASTRUCTURE**

### 🐉 **The Hydra** — Tiered API Failover
A multi-headed reliability layer ensuring 99.9% uptime through intelligent failover. This runs throughout all phases.

| Tier | Role | Models |
|------|------|--------|
| **Tier 1** | Architects | Claude 3.5 Sonnet, GPT-4o |
| **Tier 2** | Workers | Gemini 1.5 Pro, Llama 3 (Groq) |
| **Tier 3** | Speed | Haiku, Flash |
| **Local** | Cost-Free | Ollama (Qwen, Llama, Mistral, etc.) |

- **Penalty Box Quarantining** — Failed endpoints are quarantined with exponential backoff
- **Local-First JSON Parsing** — Prevents API-induced data malformation
- **Adaptive Routing** — Automatically falls back through tiers on failure

---

### **PHASE 2: SETUP (High-Intelligence)**
*Before the factory starts, we must design the blueprint.*

### 🔮 **The Oracle** — Proactive Consultant
**Step 1 of User Experience.** The contextual interviewer that conducts branching conversations to eliminate ambiguity.

- **Context Analysis** — Analyzes prompt for ambiguity
- **Prompt Refinement** — Rewrites vague ideas into technical specifications

### 🌱 **The Genesis Protocol** — Constitution & Template Bootstrap
**Step 2.** "The system never 'just starts.' It establishes Global Constraints first."

**Three-Step Process:**
1. **Library Scan** — Queries "Golden Seed" Vector DB for pre-validated templates
2. **Genesis Fallback (Magic Mode)** — If no template found, spawns high-reasoning Genesis Agent
3. **Conflict Check** — Analyzes User Prompt vs Template for fundamental contradictions

### 🔮 **The Prism** — Dynamic Instantiation & Decomposition
**Step 3.** The crystalline gateway that refracts user intentions into focused specialist beams.

```
                    ┌──────────────┐
                    │   User       │
                    │   Intent     │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   🔮 PRISM   │
                    │              │
                    └──────┬───────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
    ┌─────────┐      ┌─────────┐      ┌─────────┐
    │ Domain  │      │ Atomic  │      │Adaptive │
    │Classify │      │ Tasks   │      │ Routing │
    └─────────┘      └─────────┘      └─────────┘
```

- **Domain Classification** — Analyzes [Constitution + Prompt] to determine specific domain
- **Atomic Council Proposal** — Proposes custom Council of Specialists tailored to domain
- **Adaptive Complexity Routing (ACT)** — Assigns complexity scores; routes appropriately
- **User Review Gates** — User can toggle specialists/tasks ON/OFF before execution

### **The Saboteur** — Scope Stress Test
**Step 4.** A hostile agent (Red Team) that attacks the Prism's task list.

- **Input:** The Prism's proposed Task List
- **Mission:** Identify missing requirements or logic gaps
- **Outcome:** Forces injection of "Missing Bricks" before execution begins

---

### **PHASE 3: FACTORY FLOOR (Production)**
*The Core Execution Loop: Specialist → Reflexion → Surveyor → Antagonist → Mason.*

### 👷 **The Specialist Worker** — The Generator
**Step 5 (Repeated for each brick).** The single-threaded expert that generates atomic content.

- **Input:** `AtomicInstruction` + `LivingConstitution` + `SkillInjections`
- **The Refusal Directive:** If context is missing/ambiguous, agent **MUST** output `[UNKNOWN]` or `[CONFLICT]`
- **The Output Schema:**
  1. `### TRACE`: Internal chain-of-thought (Hidden)
  2. `### BLACKBOARD DELTA`: Proposed updates to global rules
  3. `### ARTIFACT`: The actual content/code

### 🪞 **The Reflexion Loop** — Worker Self-Correction
**Step 6.** "Don't send garbage to the expensive Audit."

- **Mechanism:** Immediately after generation, Specialist runs a fast call: *"Critique your own work. List 3 potential flaws."*
- **Fast Repair:** If flaws found, performs repair before submitting to Surveyor
- **Cost:** Negligible. **Benefit:** Drastically reduces Antagonist rejection rate.

### 🏭 **The Blackboard Surveyor** — Zero-Cost Fast Gate
**Step 7.** A strictly regex/code-based filter (Zero LLM Cost).

**Scans for Red Flags:**
| Flag Type | Detection | Action |
|-----------|-----------|--------|
| Hedging Language | "I think", "Maybe", "It depends" | Immediate Discard |
| Formatting | Broken JSON, missing `### ARTIFACT` | Immediate Discard |
| Refusals | "I cannot do that as an AI..." | Immediate Discard |
| Runaway Loops | Token count > 3,000 | Immediate Discard |

### 🎭 **The Antagonist Mirror** — Adversarial Auditor
**Step 8.** "Trust is a weakness. Prove me wrong."

- **Philosophy:** 1-on-1 Duel, not group consensus
- **The "Habeas Corpus" Rule:**
  - **CANNOT** reject a brick without citing **Evidence**
  - Must provide a **Direct Quote** from Constitution or Artifact demonstrating contradiction
- **Repair Loop:** Failed bricks get ONE focused repair attempt before escalation



### 📜 **The Living Constitution** — Dynamic System Axioms
**Ongoing.** A contractually binding document that evolves with each verified decision.

- **Blackboard Delta** — When a brick is verified, its delta merges into Global Context
- **Constitutional Drift Prevention** — Agent B (Step 10) explicitly sees decisions from Agent A (Step 5)
- **Constitutional Drift Prevention** — Agent B (Step 10) explicitly sees decisions from Agent A (Step 5)

### **The Masonry** — State & Persistence Layer
**Ongoing.** Built on Dexie.js (IndexedDB), providing enterprise-grade checkpointing.

- **Technology:** Dexie.js (IndexedDB wrapper) + Zustand for runtime state
- **Resume Capability** — Factory resumes exactly at the last verified brick

- **The Brick Wall:** Visualizes the DAG of Atomic Bricks (🟢 Verified, 🟡 Auditing, 🔴 Failed)

---

### **PHASE 4: FINAL ASSEMBLY**
*After all bricks are verified, we assemble the final output.*

### 🛡️ **The Security Patcher** — Additive Judge
**Step 9.** Red Team Consultant running *after* all bricks verified, *before* final assembly.

- **Role:** Scans for Security Gaps and Dropped Warnings
- **Critical Issues:** Rejects back to Masonry
- **Minor Issues:** Appends "Security Addendum" brick

### ⚗️ **The Alchemist** — Grand Synthesis (Lossless Compiler)
**Step 10 (Final).** The final assembly stage that stitches verified bricks into gold without "creative rewriting."

- **Philosophy:** "Assembly, not Synthesis"
- **Artifact Passthrough** — Receives raw JSON array, bypassing summarization
- **Chain of Density** — Retains all Named Entities (functions, variables) exactly as they appear
- **Strict Prohibition:** "DO NOT CHANGE A SINGLE WORD OF THE ARTIFACT CONTENT"

---



## 🏗️ Architecture Overview

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18 + TypeScript | Component-based UI |
| **State Management** | Zustand | Lightweight, reactive state |
| **Visualization** | ReactFlow | DAG visualization |
| **Persistence** | Dexie.js (IndexedDB) | Client-side database |
| **Build Tool** | Vite | Fast development & builds |
| **Testing** | Vitest | Unit & integration tests |
| **LLM Clients** | Unified LLM Client | Multi-provider abstraction |

### File Structure

```
The-Ouroboros-Engine/
├── engine/                        # 🏭 Core Engine Components
│   ├── OuroborosEngine.ts         # Main orchestrator
│   ├── UnifiedLLMClient.ts        # Multi-provider LLM abstraction
│   ├── PenaltyBoxRegistry.ts      # Failed endpoint quarantining
│   ├── genesis-protocol.ts        # Constitution & template bootstrap
│   ├── specialist.ts              # Specialist worker agents
│   ├── reflexion-loop.ts          # Self-correction loop
│   ├── blackboard-surveyor.ts     # Zero-cost fast gate
│   ├── blackboard-delta.ts        # Living constitution updates
│   ├── antagonist-mirror.ts       # Adversarial auditor
│   ├── saboteur.ts                # Scope stress tester
│   ├── lossless-compiler.ts       # Final assembly (Alchemist)
│   ├── security-patcher.ts        # Security addendum generator
│   ├── prism-controller.ts        # 🔮 The Prism - Decomposition
│   ├── antagonist-mirror.ts       # Adversarial auditor
│   ├── saboteur.ts                # Scope stress tester
│   ├── blackboard-surveyor.ts     # Zero-cost fast gate
│   ├── blackboard-delta.ts        # Living constitution updates
│   ├── agent-memory-manager.ts    # 💭 Memory persistence
│   ├── knowledge-graph.ts         # 🧠 Blackboard architecture
│   ├── red-flag-validator.ts      # 🚩 Red-flagging engine
│   ├── rate-limiter.ts            # ⏱️ Quota-aware scheduling
│   └── micro-agent-decomposer.ts  # 🔬 MDAP decomposition
│
├── components/                    # 🎨 React UI Components
│   ├── ControlPanel.tsx           # Main control interface
│   ├── SettingsPanel.tsx          # Configuration UI
│   ├── FlowCanvas.tsx             # DAG visualization
│   ├── GraphView.tsx              # Knowledge graph view
│   ├── LogViewer.tsx              # Debug log display
│   ├── NodeInspector.tsx          # Brick inspection
│   ├── SessionCodex.tsx           # Time-travel UI
│   ├── JsonRetryDialog.tsx        # JSON repair interface
│   ├── oracle/                    # 🔮 The Oracle components
│   ├── nodes/                     # 🧩 Custom ReactFlow nodes
│   └── settings/                  # ⚙️ Granular settings components
│
├── db/                            # 💾 Database Layer
│   ├── ouroborosDB.ts             # Dexie.js schema & operations
│   └── seed-loader.ts             # Golden seed data population
│
├── store/                         # 📊 State Management
│   └── ouroborosStore.ts          # Zustand store
│
├── utils/                         # 🛠️ Utilities
│   ├── safe-json.ts               # Robust JSON parsing
│   ├── graphLayout.ts             # DAG layout logic
│   └── system-constraints.ts      # Hardware/capability checks
│
├── hooks/                         # 🪝 Custom Hooks
│   └── useSoundEffects.ts         # Audio feedback
│
├── types.ts                       # 📝 TypeScript definitions
└── constants.ts                   # ⚙️ Configuration & personas
```

### The Factory Floor Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        🏭 THE FACTORY FLOOR                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐       │
│  │ ORACLE  │──►│ GENESIS │──►│  PRISM  │──►│SABOTEUR │──►│ USER    │       │
│  │Interview│   │Protocol │   │Decompose│   │Red Team │   │ Review  │       │
│  └─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘       │
│                                                              │               │
│                                                              ▼               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    🧱 BRICK PRODUCTION LOOP                            │  │
│  │                                                                        │  │
│  │   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐          │  │
│  │   │SPECIALIST│──►│REFLEXION │──►│ SURVEYOR │──►│ANTAGONIST│          │  │
│  │   │ Generate │   │Self-Check│   │ Red Flag │   │  Audit   │          │  │
│  │   └──────────┘   └──────────┘   └──────────┘   └────┬─────┘          │  │
│  │        ▲                                            │                 │  │
│  │        │                              ┌─────────────┴─────────────┐   │  │
│  │        │                              │           │               │   │  │
│  │        │                              ▼           ▼               ▼   │  │
│  │   ┌────┴────┐                   ┌─────────┐ ┌─────────┐    ┌─────────┐│  │
│  │   │ REPAIR  │◄──────────────────│  FAIL   │ │DEADLOCK │    │  PASS   ││  │
│  │   │  Loop   │                   │(1 retry)│ │Paraphrase│   │ Verify  ││  │
│  │   └─────────┘                   └─────────┘ └─────────┘    └────┬────┘│  │
│  │                                                                  │     │  │
│  └──────────────────────────────────────────────────────────────────┼────┘  │
│                                                                      │       │
│  ┌───────────────────────────────────────────────────────────────────▼────┐  │
│  │                    🧱 VERIFIED BRICKS (Masonry)                         │  │
│  │   🟢 Verified  │  🟡 Auditing  │  🔴 Failed (Reason displayed)          │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                          │                                   │
│                                          ▼                                   │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐                 │
│  │ SECURITY │──►│LOSSLESS  │──►│ MANIFEST │──►│  EXPORT  │                 │
│  │ PATCHER  │   │ COMPILER │   │ Output   │   │(Optional)│                 │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Model Role Mapping

| Component | Recommended Model | Role |
|-----------|-------------------|------|
| **Genesis** | GPT-4o / Sonnet 3.5 | Constitution Generation (High Reasoning) |
| **Prism** | GPT-4o | Council Spawning & Task Splitting |
| **Saboteur** | Claude 3.5 Sonnet | Stress Testing (Adversarial Logic) |
| **Specialist** | Adaptive (Tier 1-3) | Content Generation (Routed by Complexity) |
| **Reflexion** | Gemini Flash | Self-Correction (Fast/Cheap) |
| **Antagonist** | Claude 3.5 Sonnet | Logic Auditing & Evidence Finding (Slow/Expensive) |
| **Compiler** | GPT-4o | Formatting & Assembly (High Instruction Following) |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18+ recommended
- API keys for your preferred LLM providers (Gemini, OpenAI, Anthropic, Groq, OpenRouter)
- (Optional but Recommended) **Ollama** for local model support (free, private, no API costs)

### Installation

```bash
# Clone the repository
git clone https://github.com/spindouken/The-Ouroboros-Engine.git
cd The-Ouroboros-Engine

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your API keys
```

### Configuration (Cloud APIs)

Edit `.env.local`:
```env
GEMINI_API_KEY=your_gemini_key_here
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
GROQ_API_KEY=your_groq_key_here
```

### 🦙 Local LLM Setup with Ollama (Recommended)

Ouroboros supports **local models via Ollama**, enabling cost-free operation and complete data privacy. This is the recommended setup for development and testing.

#### Step 1: Install Ollama

**Windows:**
```bash
# Download from https://ollama.com/download/windows
# Or use winget:
winget install Ollama.Ollama
```

**macOS:**
```bash
brew install ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

#### Step 2: Download Models

```bash
# Start Ollama service (runs in background)
ollama serve

# Pull recommended models for Ouroboros:

# For Specialist/Worker tasks (fast, good quality):
ollama pull qwen2.5:7b
ollama pull llama3.2:3b

# For complex reasoning (Genesis, Prism):
ollama pull qwen2.5:14b
ollama pull deepseek-r1:8b

# For quick tasks (Reflexion, simple checks):
ollama pull qwen2.5:1.5b
ollama pull llama3.2:1b
```

#### Step 3: Enable CORS for Browser Access

Ouroboros runs in the browser and needs to communicate with Ollama. You must set up a CORS proxy:

**Option A: Using `local-cors-proxy` (Recommended)**
```bash
# Install globally
npm install -g local-cors-proxy

# Run proxy (in a separate terminal)
lcp --proxyUrl http://localhost:11434 --port 8080

# Ollama is now accessible at http://localhost:8080/proxy
```

**Option B: Set Ollama Environment Variable**
```bash
# Windows (PowerShell)
$env:OLLAMA_ORIGINS="*"
ollama serve

# macOS/Linux
OLLAMA_ORIGINS="*" ollama serve
```

#### Step 4: Configure Ouroboros to Use Local Models

In the Ouroboros Settings Panel:
1. Navigate to **Model Configuration**
2. Set **Local Model Endpoint** to `http://localhost:8080/proxy` (if using cors-proxy) or `http://localhost:11434` (if using OLLAMA_ORIGINS)
3. Select your downloaded models for each role:
   - **Specialist:** `qwen2.5:7b` or `llama3.2:3b`
   - **Reflexion:** `qwen2.5:1.5b` (fast/cheap)
   - **Genesis/Prism:** `qwen2.5:14b` (higher reasoning)

#### Recommended Model Mapping for Local-First Operation

| Component | Local Model | Cloud Fallback |
|-----------|-------------|----------------|
| **Genesis** | `qwen2.5:14b` | GPT-4o |
| **Prism** | `qwen2.5:14b` | GPT-4o |
| **Saboteur** | `deepseek-r1:8b` | Claude 3.5 Sonnet |
| **Specialist** | `qwen2.5:7b` | Gemini 1.5 Pro |
| **Reflexion** | `qwen2.5:1.5b` | Gemini Flash |
| **Antagonist** | `deepseek-r1:8b` | Claude 3.5 Sonnet |
| **Compiler** | `qwen2.5:7b` | GPT-4o |

### Running Locally

```bash
# Start Ollama (if using local models)
ollama serve

# In another terminal, start the CORS proxy (if needed)
lcp --proxyUrl http://localhost:11434 --port 8080

# In another terminal, start the dev server
npm run dev

# Open http://localhost:5173
```

### Running Tests

```bash
npm run test
```

---

## 🔬 Technical Deep-Dives

### Maximal Agentic Decomposition (MAD)

The MAKER paper established that under Maximal Agentic Decomposition (MAD), where granularity is set to `m=1` (each agent handles a single step), the expected cost scales **log-linearly** (`Θ(s ln s)`) with the number of steps.

When decomposition is not maximal (`m>1`), costs grow **exponentially** (`Θ(p^-m c s ln s)`).

**Ouroboros applies MAD principles:**
1. **Prism's Role in Focus** — Translates goals into the most specific, minimal insight sub-questions
2. **Specialists as Micro-Role Solvers** — Each specialist solves a complex single step with constrained focus
3. **Divergent Generation** — 3-5 Specialist reports as independent candidate samples enable statistical error correction

### Chain-of-Density

All knowledge nodes are scored for "information density" and automatically refined:

```typescript
interface DensityScore {
  score: number;        // 0.0 - 1.0
  hedging_detected: string[];
  vague_terms: string[];
  concrete_entities: string[];
}

// If densityScore < 0.5, system prompts for rewrite:
// "Make this dense, crisp, and concrete. Remove hedging. Add versions/entities."
```

### Red-Flagging Heuristics

```typescript
const RED_FLAGS = {
  hedging: /\b(I think|maybe|perhaps|possibly|probably|might|could be)\b/gi,
  refusal: /\b(as an AI|I cannot|I'm unable|I don't have|I am not able)\b/gi,
  tooShort: (content: string) => content.length < 100,
  tooLong: (content: string) => content.split(/\s+/).length > 3000,
  brokenJSON: (content: string) => !isValidJSON(content),
  missingArtifact: (content: string) => !content.includes('### ARTIFACT'),
};
```

### Adversarial Verification (Habeas Corpus Rule)

The Antagonist **CANNOT** reject output without:
1. **Direct Quote** from the Living Constitution showing requirement
2. **Direct Quote** from the Artifact showing violation
3. **Explicit Contradiction** explanation

This prevents arbitrary rejection and forces evidence-based auditing.

## 📊 Engineering Decisions

| Decision | Rationale |
|----------|-----------|
| **Client-Side (Local-First)** | Full user data ownership, offline capability, no server costs |
| **IndexedDB via Dexie.js** | Mature, transactional, handles complex queries |
| **Zustand over Redux** | Lighter, less boilerplate, sufficient for this scope |
| **Adversarial over Consensus** | Sycophancy in LLMs makes voting unreliable; conflict forces evidence |
| **"Brick" Atomic Units** | Failed bricks can be replaced without rebuilding entire output |
| **Lossless Assembly** | Prevents "creative rewriting" that introduces regression |
| **Evidence-Based Rejection** | Prevents arbitrary vetoes, creates audit trail |

---

## 🔮 Roadmap & Future Work

- [ ] **Smart Oracle** — Branching Interviews & Unknown Unknowns discovery
- [ ] **Deadlock Breaking** — Paraphraser Agent for loop resolution
- [ ] **Advanced Memory** — The Librarian, Golden Seeds, and Project Insight Layer
- [ ] **State Rollback** — Full "Time-Travel" session restoration
- [ ] **Server-Side Proxy** — Move API keys to secure backend
- [ ] **Neo4j Integration** — Graph database for production knowledge graph
- [ ] **Worker Pool Expansion** — Parallel brick generation with job queue
- [ ] **Vector DB Integration** — ChromaDB/Pinecone for semantic search
- [ ] **Git Integration** — Auto-commit verified manifests
- [ ] **Collaborative Mode** — Multi-user sessions with shared constitution
- [ ] **Metrics Dashboard** — Per-session analytics (acceptance rate, model costs, latency)

---

## 📜 License

**© 2025 All Rights Reserved**

This project is shared publicly for **portfolio and interview demonstration purposes only**.

- ✅ **Permitted:** Viewing, reading, and reviewing the code for evaluation purposes
- ✅ **Permitted:** Discussing the architecture and design in interviews
- ✅ **Permitted:** Running locally for personal evaluation
- ❌ **Not Permitted:** Copying, modifying, or distributing this code
- ❌ **Not Permitted:** Using this code in commercial or personal projects
- ❌ **Not Permitted:** Creating derivative works

If you are interested in licensing this project for commercial use, please contact me directly.

---

## 🙏 Acknowledgments

- **MAKER Paper** — Inspiration for Massively Decomposed Agentic Processes (MDAPs)
- **Agent Bible Principles** — Foundational guidelines for agent memory systems
- The open-source community for React, Dexie.js, Zustand, and Vite

---

<p align="center">
  <strong>♾️ Ouroboros: Where AI eats its own errors to birth perfection.</strong>
</p>

<p align="center">
  <em>"A committee of 3 agreeing agents is often just a Shared Hallucination."</em>
</p>
