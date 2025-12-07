// ============================================================================
// OUROBOROS EVOLUTION - ENHANCED TYPE SYSTEM
// ============================================================================
// This file contains all type definitions for the MDAP (Massively Decomposed
// Agentic Processes) evolution of OUROBOROS, including micro-agent decomposition,
// red-flagging, multi-round voting, agent memory, and all advanced features.
// ============================================================================

// --- CORE TYPES (Extended from MVP) ---

export type NodeStatus =
  | 'pending'
  | 'running'
  | 'critiquing'
  | 'synthesizing'
  | 'evaluating'
  | 'planning'
  | 'complete'
  | 'error'
  | 'verifying'
  | 'decomposing'
  | 'voting'
  | 'planned';

export type NodeType =
  | 'specialist'
  | 'domain_lead'
  | 'synthesizer'
  | 'gatekeeper'
  | 'architect'
  | 'tech_lead'
  | 'estimator';

export type AppMode = 'refine' | 'plan';

// --- EXTENDED NODE MODEL (Requirements 1.1, 1.2) ---

export interface Node {
  id: string;
  type: NodeType;
  mode: AppMode;
  label: string;
  instruction: string;
  persona: string;
  department?: string;
  dependencies: string[];
  status: NodeStatus;
  output: string | null;
  score?: number;
  layer?: number;
  depth?: number;
  x?: number;
  y?: number;
  data?: any;

  // New fields for MDAP features
  microTasks?: MicroTask[];
  redFlags?: RedFlag[];
  retryCount?: number;
  executionTime?: number;
  tokenCount?: number;
  cost?: number;
  streaming?: boolean;
  memory?: AgentMemory[];
  performanceMetrics?: NodePerformance;

  // Verified Synthesis Artifacts
  artifacts?: {
    code?: string;
    specification?: string;
    proof?: string;
  };

  // Persistence Fields
  parentId?: string;
  timestamp?: number;

  // Debug / Quality Control Data
  debugData?: {
    lastPrompt?: string;
    rawResponse?: string;
    timestamp?: number;
    modelUsed?: string;
    executionTimeMs?: number;
  };
}

// --- MICRO-AGENT DECOMPOSITION (Requirements 1.1, 1.2, 1.3, 1.4, 1.5) ---

export interface MicroTask {
  id: string;
  parentId: string;
  instruction: string;
  minimalContext: string;
  output: string | null;
  confidence: number;
  status: NodeStatus;
}

export interface AgentConfig {
  id: string;
  role: string;
  persona: string;
  capabilities: string[];
  temperature: number;
}

export interface MicroAgentDecomposer {
  decomposeNode(nodeId: string, context: string, ai: any, model: string, persona?: string): Promise<MicroTask[]>;
  aggregateResults(microTasks: MicroTask[]): Promise<string>;
  calculateConfidence(microTasks: MicroTask[]): number;
}

// --- RED-FLAGGING SYSTEM (Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7) ---

export type RedFlagType =
  | 'too_short'
  | 'too_generic'
  | 'contradictory'
  | 'low_confidence';

export type RedFlagSeverity = 'low' | 'medium' | 'high';

export interface RedFlag {
  type: RedFlagType;
  severity: RedFlagSeverity;
  message: string;
  pattern?: string;
}

export interface ValidationResult {
  passed: boolean;
  flags: RedFlag[];
  shouldRetry: boolean;
  suggestedTemperature?: number;
}

export interface RedFlagValidator {
  validate(output: string, confidence: number): ValidationResult;
  retry(nodeId: string, temperature: number): Promise<string>;
}

// --- MULTI-ROUND VOTING SYSTEM (Requirements 3.1, 3.2, 3.3, 3.4, 3.5) ---

export interface JudgeOutput {
  judgeId: string;
  score: number;
  reasoning: string;
  focus: string;
}

export interface VotingResult {
  round: number;
  judgeCount: number;
  scores: number[];
  averageScore: number;
  variance: number;
  needsEscalation: boolean;
  requiresHumanReview: boolean;
  judgeOutputs: JudgeOutput[];
}

export interface MultiRoundVotingSystem {
  conductVoting(spec: string, round: number, ai: any, models: { default: string; cheap: string; advanced: string }, context?: string, originalRequirements?: string): Promise<VotingResult>;
  calculateVariance(scores: number[]): number;
}

// --- AGENT MEMORY SYSTEM (Requirements 14.1, 14.2, 14.3, 14.4, 14.5) ---

export interface AgentMemory {
  cycle: number;
  feedback: string;
  outcomeScore: number;
  timestamp: number;
  adopted: boolean;
}

export interface AgentMemoryManager {
  storeMemory(agentId: string, memory: AgentMemory, ai?: any, model?: string, votingSystem?: MultiRoundVotingSystem): Promise<void>;
  getMemory(agentId: string, limit?: number): Promise<AgentMemory[]>;
  injectMemoryContext(agentId: string, prompt: string): Promise<string>;
  clearMemory(agentId: string): Promise<void>;
}

// --- EXTENDED GRAPH MODEL ---

export interface GraphMetadata {
  sessionId: string;
  cycleNumber: number;
  mode: AppMode;
  timestamp: number;
  tribunalScore?: number;
}

export interface LayoutConfig {
  type: 'hierarchical' | 'force-directed' | 'circular';
  spacing: number;
  direction: 'horizontal' | 'vertical';
}

export interface GraphSnapshot {
  timestamp: number;
  cycleNumber: number;
  nodes: Record<string, Node>;
  edges: { source: string; target: string }[];
  tribunalScore: number;
}

export interface Edge {
  source: string;
  target: string;
  weight?: number;
}

export interface Graph {
  nodes: Record<string, Node>;
  edges: Edge[];
  metadata?: GraphMetadata;
  layout?: LayoutConfig;
  history?: GraphSnapshot[];
}

// --- KNOWLEDGE GRAPH (The Blackboard) ---

export type KnowledgeGraphLayer = 'domain' | 'lexical' | 'subject';

export interface KnowledgeNode {
  id: string;
  label: string;
  type: string;
  layer: KnowledgeGraphLayer;
  content: string;
  metadata: Record<string, any>;
  densityScore?: number; // Chain of Density score
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  relation: string;
  weight: number;
}

export interface KnowledgeGraph {
  nodes: Record<string, KnowledgeNode>;
  edges: KnowledgeEdge[];
}

// --- VOTING STATE ---

export interface VotingState {
  nodeId: string;
  candidateSpec: string;
  votes: {
    voterId: string;
    verdict: 'pass' | 'fail';
    reason: string;
    role: 'logic' | 'requirements' | 'proof';
  }[];
  passCount: number;
  failCount: number;
  status: 'active' | 'passed' | 'failed';
  startTime: number;
}

// --- EXTENDED APP SETTINGS ---

export interface AppSettings {
  model: string;
  concurrency: number;
  rpm: number; // Requests per minute
  rpd: number; // Requests per day
  apiKey?: string; // Google API Key
  openaiApiKey?: string; // OpenAI API Key
  openRouterApiKey?: string; // OpenRouter API Key

  // New settings for MDAP features
  autoSaveInterval: number;
  enableRedFlagging: boolean;
  enableMultiRoundVoting: boolean;
  enableStreaming: boolean;
  enableWebWorkers: boolean;
  enableAgentMemory: boolean;
  enableSoundEffects?: boolean;
  baseFontSize?: number; // New setting for UI scaling
  maxMicroAgentDepth?: number;
  initialJudgeCount?: number;
  budgetLimit?: number;
  gitIntegration: boolean;
  redTeamMode: boolean;
  debugMode: boolean;

  // Tiered Model Settings
  model_specialist?: string;
  model_lead?: string;
  model_synthesizer?: string;
  model_judge?: string;
  model_architect?: string;
  model_manifestation?: string;
  model_prism?: string;
  model_oracle?: string;

  // Local LLM Config
  localBaseUrl?: string;
  localModelId?: string;

  // New settings
  consensusThreshold?: number; // Tribunal passing score (0-100)
}

// --- THE ORACLE (Requirements 3.0) ---

export interface OracleMessage {
  role: 'user' | 'oracle';
  content: string;
  timestamp: number;
}

export interface OracleContext {
  originalRequest: string;
  interviewTranscript: OracleMessage[];
  fusedSpec?: any; // The JSON output from Context Fusion
}

// --- LOG ENTRY ---

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success' | 'system';
  message: string;
  nodeId?: string;
}

// --- PLAN ITEM ---

export interface PlanItem {
  id: string;
  title: string;
  description: string;
  type: 'module' | 'task';
  children?: PlanItem[];
  complexity?: string;
}

// --- TASK EXECUTION ENGINE (Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7) ---

export type ExecutorType = 'code_gen' | 'file_write' | 'test_gen' | 'api_call';
export type ValidationStrategy = 'syntax' | 'voting' | 'comprehensive';
export type RetryStrategy = 'exponential' | 'vote_based';

export interface ExecutableTask extends PlanItem {
  executor: ExecutorType;
  inputs: Record<string, any>;
  validation: ValidationStrategy;
  retryStrategy: RetryStrategy;
  maxRetries: number;
}

export type ArtifactType = 'source' | 'test' | 'config' | 'documentation';
export type ArtifactStatus = 'pending' | 'passed' | 'failed';

export interface CodeArtifact {
  id: string;
  taskId: string;
  filePath: string;
  content: string;
  language: string;
  type: ArtifactType;
  validationStatus: ArtifactStatus;
  validationErrors: string[];
  votingScore?: number;
}

export interface ExecutionResult {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  artifacts: CodeArtifact[];
  executionTime: number;
  totalCost: number;
}

export interface ExecutionEngine {
  executePlan(plan: PlanItem[]): Promise<ExecutionResult>;
  generateCode(task: ExecutableTask): Promise<CodeArtifact>;
  validateArtifact(artifact: CodeArtifact): Promise<ValidationResult>;
  writeToOutput(artifact: CodeArtifact): Promise<void>;
}

// --- CODE VALIDATION (Requirements 5.1, 5.2, 5.3, 5.4, 5.5) ---

export interface SyntaxError {
  line: number;
  column: number;
  message: string;
}

export interface SyntaxValidation {
  valid: boolean;
  errors: SyntaxError[];
  warnings: string[];
}

export interface CompletenessCheck {
  complete: boolean;
  missingElements: string[];
  suggestions: string[];
}

export interface VotingValidation {
  passed: boolean;
  averageScore: number;
  votes: { agentId: string; score: number; feedback: string }[];
}

export interface CodeValidator {
  validateSyntax(code: string, language: string): Promise<SyntaxValidation>;
  validateCompleteness(code: string): Promise<CompletenessCheck>;
  runVotingValidation(artifact: CodeArtifact): Promise<VotingValidation>;
}

// --- PERSISTENCE & SESSION MANAGEMENT (Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6) ---

export interface AppState {
  sessionId: string;
  timestamp: number;
  documentContent: string;
  graph: Graph;
  logs: LogEntry[];
  cycleCount: number;
  projectPlan: PlanItem[];
  settings: AppSettings;
  usageMetrics: UsageMetrics;
  agentMemories: Record<string, AgentMemory[]>;
  manifestation: string | null;
}

export interface SessionMetadata {
  id: string;
  timestamp: number;
  cycleCount: number;
  tribunalScore: number;
  projectName: string;
  mode: AppMode;
}

export type ExportFormat = 'markdown' | 'json' | 'html' | 'pdf';

export interface PersistenceManager {
  autoSave(state: AppState): Promise<void>;
  loadSession(sessionId: string): Promise<AppState>;
  listSessions(): Promise<SessionMetadata[]>;
  deleteSession(sessionId: string): Promise<void>;
  exportSession(sessionId: string, format: ExportFormat): Promise<Blob>;
}

// --- GIT INTEGRATION (Requirements 7.1, 7.2, 7.3, 7.4, 7.5) ---

export interface GitCommit {
  hash: string;
  message: string;
  timestamp: number;
  cycleNumber: number;
  tribunalScore: number;
  files: string[];
}

export interface DiffLine {
  lineNumber: number;
  content: string;
  type: 'add' | 'delete' | 'modify';
}

export interface DiffResult {
  additions: DiffLine[];
  deletions: DiffLine[];
  modifications: DiffLine[];
}

export interface GitIntegration {
  initRepository(): Promise<void>;
  commitCycle(cycleNumber: number, score: number, files: string[]): Promise<string>;
  getHistory(): Promise<GitCommit[]>;
  getDiff(commitA: string, commitB: string): Promise<DiffResult>;
  checkout(commitHash: string): Promise<void>;
}

// --- USAGE TRACKING & ANALYTICS (Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6) ---

export interface CycleMetric {
  cycleNumber: number;
  startTime: number;
  endTime: number;
  duration: number;
  tokens: number;
  cost: number;
  tribunalScore: number;
  nodesExecuted: number;
}

export interface UsageMetrics {
  totalTokens: number;
  totalCost: number;
  avgCycleTime: number;
  nodesExecuted: number;
  errorRate: number;
  successRate: number;
  modelBreakdown: Record<string, { tokens: number; cost: number }>;
  cycleMetrics: CycleMetric[];
}

export interface UsageTracker {
  trackAPICall(model: string, tokens: number): void;
  calculateCost(tokens: number, model: string): number;
  getMetrics(): UsageMetrics;
  resetMetrics(): void;
  exportMetrics(): Promise<Blob>;
}

// --- PERFORMANCE PROFILING (Requirements 28.1, 28.2, 28.3, 28.4, 28.5) ---

export interface NodePerformance {
  nodeId: string;
  executionTime: number;
  tokenCount: number;
  retryCount: number;
  status: NodeStatus;
}

export interface CyclePerformance {
  totalTime: number;
  nodeMetrics: NodePerformance[];
  slowestNodes: NodePerformance[];
  averageNodeTime: number;
}

export type BottleneckImpact = 'high' | 'medium' | 'low';

export interface Bottleneck {
  nodeId: string;
  issue: string;
  impact: BottleneckImpact;
  suggestion: string;
}

export interface PerformanceProfiler {
  startProfiling(nodeId: string): void;
  endProfiling(nodeId: string): void;
  getNodeMetrics(nodeId: string): NodePerformance;
  getCycleMetrics(): CyclePerformance;
  identifyBottlenecks(): Bottleneck[];
}

// --- ADVERSARIAL NETWORK (RED TEAM) (Requirements 10.1, 10.2, 10.3, 10.4, 10.5) ---

export type VulnerabilitySeverity = 'critical' | 'high' | 'medium' | 'low';
export type VulnerabilityCategory = 'security' | 'performance' | 'usability' | 'scalability';

export interface Vulnerability {
  id: string;
  severity: VulnerabilitySeverity;
  category: VulnerabilityCategory;
  description: string;
  impact: string;
  mitigation: string;
  discoveredBy: string;
}

export interface EdgeCase {
  id: string;
  scenario: string;
  expectedBehavior: string;
  potentialIssue: string;
}

export interface AttackSurface {
  vulnerabilities: Vulnerability[];
  edgeCases: EdgeCase[];
  report: string;
}

export interface RedTeamResult {
  vulnerabilities: Vulnerability[];
  edgeCases: EdgeCase[];
  attackSurfaceReport: string;
  recommendations: string[];
}

export interface AdversarialNetwork {
  spawnRedTeam(spec: string): Promise<RedTeamResult>;
  generateAttackSurface(spec: string): Promise<AttackSurface>;
}

// --- SPEC EVOLUTION HEATMAP (Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7) ---

export type ChangeType = 'unchanged' | 'minor' | 'major' | 'new';

export interface AgentDiscussion {
  agentId: string;
  agentLabel: string;
  insight: string;
  confidence: number;
  adopted: boolean;
}

export interface HeatmapSegment {
  startPos: number;
  endPos: number;
  text: string;
  changeType: ChangeType;
  color: string;
  agentDiscussions: AgentDiscussion[];
}

export interface DiffHeatmap {
  segments: HeatmapSegment[];
  totalChanges: number;
  changeIntensity: number;
}

export interface HeatmapVisualization {
  html: string;
  interactive: boolean;
  clickableSegments: boolean;
}

export interface SpecEvolutionHeatmap {
  computeDiff(oldSpec: string, newSpec: string): DiffHeatmap;
  generateVisualization(heatmap: DiffHeatmap): HeatmapVisualization;
  getChangeHistory(position: number): AgentDiscussion[];
}

// --- HUMAN-IN-THE-LOOP APPROVAL GATES (Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7) ---

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'revised';
export type ApprovalRequirement = 'user' | 'stakeholder';

export interface ApprovalResponse {
  gateId: string;
  selectedOption: string;
  feedback?: string;
  timestamp: number;
}

export interface ApprovalGate {
  id: string;
  nodeId: string;
  requiredApproval: ApprovalRequirement;
  question: string;
  options: string[];
  context: string;
  status: ApprovalStatus;
  response?: ApprovalResponse;
}

export interface HumanApprovalGate {
  createGate(nodeId: string, question: string, options: string[]): ApprovalGate;
  waitForApproval(gateId: string): Promise<ApprovalResponse>;
  processResponse(gateId: string, response: ApprovalResponse): void;
}

// --- DEBATE MODE (Requirements 15.1, 15.2, 15.3, 15.4, 15.5) ---

export interface Message {
  agentId: string;
  agentLabel: string;
  turn: number;
  content: string;
  timestamp: number;
}

export interface DebateSummary {
  keyArguments: string[];
  consensus: string;
  dissent: string[];
  resolution: string;
}

export interface DebateResult {
  topic: string;
  transcript: Message[];
  summary: DebateSummary;
  finalVote: VotingResult;
  duration: number;
}

export interface DebateMode {
  initiateDebate(topic: string, agents: Node[]): Promise<DebateResult>;
  conductRound(agents: Node[], transcript: Message[]): Promise<Message[]>;
  summarizeDebate(transcript: Message[]): DebateSummary;
}

// --- TEMPLATE LIBRARY (Requirements 16.1, 16.2, 16.3, 16.4, 16.5) ---

export type TemplateCategory = 'saas' | 'crypto' | 'mobile' | 'api' | 'custom';

export interface PersonaConfig {
  id: string;
  label: string;
  instruction: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  departments: string[];
  customPersonas?: Record<string, PersonaConfig[]>;
  autoLoop: boolean;
  tribunalThreshold: number;
  starterContent: string;
  constraints?: Constraint[];
}

export interface TemplateLibrary {
  loadTemplate(templateId: string): Template;
  listTemplates(): Template[];
  saveCustomTemplate(template: Template): Promise<string>;
  deleteTemplate(templateId: string): Promise<void>;
}

// --- AGENT PERFORMANCE LEADERBOARD (Requirements 17.1, 17.2, 17.3, 17.4, 17.5) ---

export interface AgentMetrics {
  agentId: string;
  agentLabel: string;
  avgConfidenceScore: number;
  adoptionRate: number;
  cyclesParticipated: number;
  avgTribunalImpact: number;
  totalInsights: number;
  rank: number;
}

export interface AgentLeaderboard {
  trackAgentPerformance(agentId: string, output: string, adopted: boolean): void;
  calculateMetrics(agentId: string): AgentMetrics;
  getRankings(): AgentMetrics[];
  getTopPerformers(count: number): AgentMetrics[];
}

// --- CONSTRAINT SYSTEM (Requirements 18.1, 18.2, 18.3, 18.4, 18.5) ---

export type ConstraintType =
  | 'must_include'
  | 'must_avoid'
  | 'max_complexity'
  | 'budget_limit'
  | 'custom';

export type ConstraintPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Constraint {
  id: string;
  type: ConstraintType;
  value: string | number;
  validator: (spec: string) => boolean;
  errorMessage: string;
  priority: ConstraintPriority;
}

export interface ConstraintViolation {
  constraintId: string;
  message: string;
  severity: string;
}

export interface ConstraintValidation {
  passed: boolean;
  violations: ConstraintViolation[];
  warnings: string[];
}

export interface ConstraintSystem {
  addConstraint(constraint: Constraint): void;
  validateConstraints(spec: string): ConstraintValidation;
  removeConstraint(constraintId: string): void;
  listConstraints(): Constraint[];
}

// --- MULTIMODAL INPUT (Requirements 19.1, 19.2, 19.3, 19.4, 19.5) ---

export interface ImageAnalysis {
  description: string;
  detectedElements: string[];
  suggestedRequirements: string[];
  confidence: number;
}

export interface VoiceTranscript {
  text: string;
  confidence: number;
  language: string;
  duration: number;
}

export interface DocumentExtraction {
  text: string;
  structure: any;
  metadata: Record<string, any>;
}

export interface MultimodalProcessor {
  processImage(file: File): Promise<ImageAnalysis>;
  processVoice(audioBlob: Blob): Promise<VoiceTranscript>;
  processDocument(file: File): Promise<DocumentExtraction>;
}

// --- PLUGIN SYSTEM (Requirements 20.1, 20.2, 20.3, 20.4, 20.5) ---

export interface PluginHooks {
  beforeExecute?: (node: Node) => void | Promise<void>;
  afterExecute?: (node: Node, output: string) => string | Promise<string>;
  onError?: (node: Node, error: Error) => void | Promise<void>;
}

export interface AgentPlugin {
  id: string;
  name: string;
  version: string;
  type: NodeType;
  persona: string;
  instruction: string;
  department?: string;
  hooks?: PluginHooks;
  config?: Record<string, any>;
}

export interface PluginManager {
  registerPlugin(plugin: AgentPlugin): void;
  unregisterPlugin(pluginId: string): void;
  listPlugins(): AgentPlugin[];
  executePlugin(pluginId: string, context: any): Promise<any>;
}

// --- STREAMING SYSTEM (Requirements 21.1, 21.2, 21.3, 21.4, 21.5) ---

export interface StreamingHandler {
  streamGenerateContent(nodeId: string, prompt: string): AsyncGenerator<string>;
  handleChunk(nodeId: string, chunk: string): void;
  completeStream(nodeId: string): void;
}

// --- WEB WORKER SYSTEM (Requirements 22.1, 22.2, 22.3, 22.4, 22.5) ---

export type WorkerTaskType = 'AGENT_EXECUTION' | 'VALIDATION' | 'DIFF_COMPUTATION';

export interface WorkerTask {
  type: WorkerTaskType;
  payload: any;
}

export interface WorkerPool {
  acquire(): Promise<Worker>;
  release(worker: Worker): void;
  execute(task: WorkerTask): Promise<any>;
  terminate(): void;
}

// --- CYCLE HISTORY (Requirements 23.1, 23.2, 23.3, 23.4, 23.5) ---

export interface CycleHistory {
  storeSnapshot(snapshot: GraphSnapshot): Promise<void>;
  getTimeline(): Promise<GraphSnapshot[]>;
  loadCycle(cycleNumber: number): Promise<GraphSnapshot>;
  compareCycles(cycleA: number, cycleB: number): Promise<DiffResult>;
  restoreCycle(cycleNumber: number): Promise<void>;
}

// --- BUDGET MANAGEMENT (Requirements 24.1, 24.2, 24.3, 24.4, 24.5) ---

export interface BudgetAlert {
  threshold: number;
  message: string;
  timestamp: number;
}

export interface BudgetManager {
  setBudgetLimit(limit: number): void;
  checkBudget(currentCost: number): BudgetAlert | null;
  pauseExecution(): void;
  logOverage(amount: number): void;
}

// --- NOTIFICATION SYSTEM (Requirements 29.1, 29.2, 29.3, 29.4, 29.5) ---

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'approval_required';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';
export type NotificationActionStyle = 'primary' | 'secondary' | 'danger';

export interface NotificationAction {
  label: string;
  action: () => void;
  style: NotificationActionStyle;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  priority: NotificationPriority;
  actionable: boolean;
  actions?: NotificationAction[];
  dismissed: boolean;
}

export interface NotificationSystem {
  addNotification(notification: Notification): void;
  dismissNotification(id: string): void;
  groupNotifications(): Record<NotificationType, Notification[]>;
  clearAll(): void;
}

// --- COLLABORATION (Requirements 26.1, 26.2, 26.3, 26.4, 26.5) ---

export interface Collaborator {
  id: string;
  name: string;
  avatar: string;
  cursorPosition?: { x: number; y: number };
  connected: boolean;
}

export interface CollaborationSession {
  sessionUrl: string;
  collaborators: Collaborator[];
  hostId: string;
}

export interface CollaborationManager {
  generateSessionUrl(): string;
  joinSession(url: string): Promise<void>;
  broadcastChange(change: any): void;
  addCollaborator(collaborator: Collaborator): void;
  removeCollaborator(id: string): void;
}

// --- CONSTANTS ---

export const RED_FLAG_RULES = {
  tooShort: (output: string) => output.length < 50,
  tooGeneric: (output: string) => /TODO|placeholder|example|lorem ipsum/i.test(output),
  contradictory: (output: string) => {
    const markers = output.match(/but|however|on the other hand|conversely/gi);
    return markers && markers.length > 3;
  },
  lowConfidence: (score: number) => score < 40
};

export const VOTING_ESCALATION_RULES = {
  round1: { judges: 3, varianceThreshold: 20 },
  round2: { judges: 5, varianceThreshold: 20 },
  round3: { judges: 7, varianceThreshold: 20 },
  humanReview: { triggered: true }
};

export const MODEL_PRICING = {
  'gemini-2.5-flash': { input: 0.000075, output: 0.0003 },
  'gemini-flash-lite-latest': { input: 0.00001, output: 0.00004 },
  'gemini-3-pro-preview': { input: 0.00125, output: 0.005 }
};

export const ADVERSARIAL_PERSONAS = {
  saboteur: 'Find security vulnerabilities and attack vectors',
  pessimist: 'Assume worst-case scenarios and identify failure modes',
  contrarian: 'Argue against every design decision and find alternatives',
  chaosMonkey: 'Inject edge cases and boundary conditions'
};
