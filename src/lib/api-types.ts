/** Alinhado a clientService / planService + modelos Mongoose. */

export type MonitoringConcentratorHealth = "healthy" | "warning" | "degraded" | "critical";

export type MonitoringConcentratorItem = {
  id: string;
  name: string;
  type: string;
  protocol: string;
  host: string;
  port: number | null;
  enabled: boolean;
  status: string;
  lastTestAt: string | null;
  lastErrorSafe: string;
  cpuPercent: number;
  memoryPercent: number;
  pppOnline: number;
  pppOffline: number;
  pppUnknown: number;
  pppTotal: number;
  interfaceRunning: number;
  interfaceTotal: number;
  version: string;
  uptime: string;
  boardName: string;
  architectureName: string;
  telemetryAt: string | null;
  healthScore: number;
  health: MonitoringConcentratorHealth;
  openAlerts: number;
  criticalAlerts: number;
  warningAlerts: number;
};

export type MonitoringConcentratorsResponse = {
  ok: boolean;
  generatedAt: string;
  total: number;
  online: number;
  offline: number;
  unknown: number;
  warning: number;
  critical: number;
  pppOnline: number;
  pppTotal: number;
  interfaceRunning: number;
  interfaceTotal: number;
  openAlerts: number;
  criticalAlerts: number;
  warningAlerts: number;
  items: MonitoringConcentratorItem[];
};

export type MonitoringConcentratorAlert = {
  id?: string;
  _id?: string;
  concentratorId: string;
  concentratorName: string;
  type: "CPU_HIGH" | "RAM_HIGH" | "PPP_DROP" | "OFFLINE" | "TELEMETRY_STALE";
  severity: "warning" | "critical";
  status: "open" | "resolved";
  title: string;
  description: string;
  metricValue: number | string | null;
  thresholdValue: number | string | null;
  openedAt: string;
  resolvedAt: string | null;
};

export type MonitoringConcentratorAlertsResponse = {
  ok: boolean;
  total: number;
  items: MonitoringConcentratorAlert[];
};

export type MonitoringConcentratorTelemetrySnapshot = {
  createdAt: string;
  cpuPercent: number;
  memoryPercent: number;
  pppOnline: number;
  interfaceRunning: number;
  interfaceTotal: number;
  health: MonitoringConcentratorHealth;
};

export type MonitoringConcentratorDetailResponse = {
  ok: boolean;
  generatedAt: string;
  item: MonitoringConcentratorItem;
  telemetryHistory: MonitoringConcentratorTelemetrySnapshot[];
};

/** GET /health — sem autenticação no backend XPDCNET. */
export type HealthFromApi = {
  status: "ok" | "error";
  database: "connected" | "disconnected";
  uptime?: number;
  timestamp?: string;
  systemMode?: string;
};

export type SystemUpdateCurrentRepoFromApi = {
  branch: string | null;
  commit: string | null;
  tag: string | null;
  dirty: boolean;
  path: string;
};

export type SystemUpdateRuntimeServiceFromApi = {
  pm2Status: string;
  port: number;
  uptimeMs: number | null;
  memoryBytes: number | null;
};

export type SystemUpdateStatusResponseFromApi = {
  status: "ok";
  current: {
    admin: SystemUpdateCurrentRepoFromApi;
    backend: SystemUpdateCurrentRepoFromApi;
  };
  runtime: {
    admin: SystemUpdateRuntimeServiceFromApi;
    api: SystemUpdateRuntimeServiceFromApi;
  };
  health: {
    frontend: string;
    api: string;
    mongodb: string;
    nginx: string;
  };
  availableTags: string[];
  lastUpdate: {
    action: string;
    targetTag: string | null;
    status: string;
    summary: string;
    createdAt: string | null;
    completedAt: string | null;
  } | null;
};

export type SystemUpdatePlanResponseFromApi = {
  status: "ok";
  currentVersion: {
    admin: { branch: string | null; commit: string | null; tag: string | null };
    backend: { branch: string | null; commit: string | null; tag: string | null };
  };
  targetVersion: string;
  commits: string[];
  commitCount: number;
  changedFiles: string[];
  packageJsonChanged: boolean;
  packageLockChanged: boolean;
  migrationsDetected: boolean;
  requiresNpmCi: boolean;
  requiresBuild: boolean;
  servicesAffected: string[];
  risks: string[];
  expectedTestResult: string;
  executable: false;
};

export type SystemUpdateHistoryEntryFromApi = {
  id: string;
  action: string;
  targetTag: string | null;
  requestedBy: string | null;
  requestedByRole: string | null;
  sourceIp: string | null;
  userAgent: string | null;
  status: "success" | "error";
  summary: string;
  details: Record<string, unknown> | null;
  createdAt: string | null;
  completedAt: string | null;
};

export type FinancePolicyFromApi = {
  financeAutomationEnabled: boolean;
  financeGraceDays: number;
  financeMinOverdueInvoices: number;
  financeCutoffWindowEnabled: boolean;
  financeCutoffStartHour: number;
  financeCutoffEndHour: number;
  financeAutoReactivateWhenClear: boolean;
  /** Minutos entre transições automáticas de status pelo rollup; 0 desliga anti-flapping. */
  financeAutomationMinHoldMinutes: number;
  financeTimezone: string;
  updatedBy?: string;
  updatedAt?: string | null;
};

export type TenantFinancePolicyFromApi = {
  tenantId: string;
  tenantSlug: string;
  financePolicy: FinancePolicyFromApi;
};

export type FinanceConfigurationFromApi = {
  id: string | null;
  tenantId: string;
  version: number;
  active: boolean;
  simulationMode: boolean;
  timezone: string;
  currency: string;
  due: {
    defaultDueDay: number;
    graceDays: number;
    processingHour: number;
    allowWeekendDue: boolean;
    moveToNextBusinessDay: boolean;
  };
  penalties: {
    lateFee: {
      enabled: boolean;
      percent: number;
      minimumAmount: number;
      maximumAmount: number;
      applyAfterDays: number;
    };
    interest: {
      enabled: boolean;
      monthlyPercent: number;
      dailyProRata: boolean;
      maximumPercent: number;
      applyAfterDays: number;
    };
  };
  notifications: {
    enabled: boolean;
    beforeDueDays: number[];
    afterDueDays: number[];
    channels: {
      whatsapp: boolean;
      email: boolean;
      sms: boolean;
    };
    template: string;
  };
  suspension: {
    enabled: boolean;
    daysAfterDue: number;
    processingHour: number;
    markOnlyDelinquent: boolean;
    suspendPppoe: boolean;
    suspendMikrotik: boolean;
    suspendOlt: boolean;
    suspendBeesweb: boolean;
  };
  reactivation: {
    enabled: boolean;
    onPaymentConfirmation: boolean;
    delayMinutes: number;
    maximumRetries: number;
    allowManualEmergency: boolean;
  };
  security: {
    requireConfirmation: boolean;
    emergencyStop: boolean;
    maximumActionsPerRun: number;
    maximumActionsPerDay: number;
  };
  scope: {
    global: boolean;
    plans: string[];
    clients: string[];
    groups: string[];
  };
  exceptions: {
    protectedClients: string[];
    protectedPlans: string[];
    protectedGroups: string[];
  };
  installment: {
    enabled: boolean;
    minimumEntryPercent: number;
    maximumInstallments: number;
    monthlyInterestPercent: number;
    maximumDiscountPercent: number;
    requireApproval: boolean;
  };
  createdBy: string;
  updatedBy: string;
  createdAt: string | null;
  updatedAt: string | null;
  activatedAt: string | null;
  changeReason: string;
  restoredFromVersion: number | null;
  contentHash: string;
  summary: string;
  isPersisted: boolean;
};

export type FinanceConfigurationValidationIssueFromApi = {
  field: string;
  message: string;
};

export type FinanceConfigurationValidationResponseFromApi = {
  valid: boolean;
  invalid: boolean;
  normalized: FinanceConfigurationFromApi;
  errors: FinanceConfigurationValidationIssueFromApi[];
  warnings: string[];
  conflicts: FinanceConfigurationValidationIssueFromApi[];
  estimatedImpact: {
    notificationChannelsEnabled: number;
    suspensionTargetsEnabled: number;
    penaltiesEnabled: number;
    reactivationEnabled: boolean;
    emergencyStop: boolean;
    simulationProtected: boolean;
  };
  contentHash: string;
};

export type ClientStatus =
  | "active"
  | "suspended"
  | "cancelled"
  | "pending"
  | "delinquent"
  | "blocked"
  | "disabled";

export type PlanSummary = {
  _id: string;
  name: string;
  speedMbps: number;
  price: number;
  authType?: string;
};

/** Bloco `address` em GET/PUT quando o backend o devolve (Mongoose). */
export type ClientAddressFromApi = {
  zip?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  reference?: string;
};

export type ClientGeoFromApi = { lat: number; lng: number };

/** Estado preparado para sync MikroTik (sem monitoramento nem RouterOS executado no painel). */
export type ClientMikrotikSyncFromApi = {
  state?: "never" | "pending" | "in_sync" | "drift" | "error" | "skipped";
  lastAttemptAt?: string | null;
  lastSuccessAt?: string | null;
  lastErrorMessage?: string;
};

export type ClientTrustReleaseFromApi = {
  enabled?: boolean;
  until?: string | null;
  reason?: string;
  setAt?: string | null;
  setBy?: string;
};

export type ClientMikrotikFromApi = {
  enabled?: boolean;
  serverId?: string | { _id: string };
  profile?: string;
  comment?: string;
  syncedAt?: string | null;
  sync?: ClientMikrotikSyncFromApi;
};

export type ClientFromApi = {
  _id: string;
  fullName: string;
  document?: string;
  phone?: string;
  email?: string;
  planId: string | PlanSummary;
  monthlyPrice: number;
  dueDay?: number;
  status: ClientStatus;
  access: { username: string; password?: string; authType?: string };
  notes?: string;
  address?: ClientAddressFromApi;
  geo?: ClientGeoFromApi | null;
  contract?: Record<string, unknown>;
  networkAccess?: Record<string, unknown>;
  mikrotik?: ClientMikrotikFromApi;
  trustRelease?: ClientTrustReleaseFromApi;
};

/** GET /mikrotik/servers — password pode vir na API; o painel não exibe. */
export type MikrotikServerFromApi = {
  _id: string;
  name: string;
  host: string;
  port?: number;
  username?: string;
  isActive?: boolean;
  executionMode?: "auto" | "direct" | "agent" | string;
  agentId?: string | null;
  networkNodeId?: string | null;
};

/** GET /mikrotik/servers/monitoring — snapshot operacional por equipamento (sem password). */
export type MikrotikServerMonitoringInterfaceFromApi = {
  name: string;
  /** Presente quando a API devolve metadados de estado (lista resumida). */
  running?: boolean;
  disabled?: boolean;
  rxBytes?: string;
  txBytes?: string;
};

/** GET /mikrotik/servers/:id/monitoring — interfaces com metadados NOC. */
export type MikrotikServerMonitoringInterfaceDetailFromApi = {
  name: string;
  running: boolean;
  disabled: boolean;
  rx: string | null;
  tx: string | null;
  rxBytes?: string | null;
  txBytes?: string | null;
  rxRate?: string | null;
  txRate?: string | null;
  rxMax: string | null;
  txMax: string | null;
  comment: string | null;
  type: string | null;
  macAddress?: string | null;
  mtu?: string | null;
  linkSpeed?: string | null;
};

export type MikrotikServerPppLinkedClientFromApi = {
  clientId: string;
  fullName: string;
  matchesThisServer: boolean;
};

export type MikrotikServerPppActiveSessionFromApi = {
  name: string;
  service: string;
  callerId: string;
  address: string;
  uptime: string;
  encoding: string;
  sessionId: string;
  radius?: string;
  limitBytesIn?: string;
  limitBytesOut?: string;
  localAddress?: string;
  remoteAddress?: string;
  profile?: string;
  server?: string;
  linkedClient?: MikrotikServerPppLinkedClientFromApi | null;
};

export type MikrotikOperationalAlertLevel = "critical" | "warning" | "info";

export type MikrotikOperationalAlertFromApi = {
  level: MikrotikOperationalAlertLevel;
  code: string;
  title: string;
  message: string;
};

export type MikrotikServerSnapshotHistoryRowFromApi = {
  id: string;
  generatedAt: string;
  online: boolean;
  cpuPercent: number | null;
  memoryTotalBytes: number | null;
  memoryFreeBytes: number | null;
  diskTotalBytes: number | null;
  diskFreeBytes: number | null;
  interfaceCount: number;
  activePppTotal: number;
  lastError: string | null;
  topInterfaces: { name: string; rx?: string; tx?: string }[];
  /** Amostra por porta (quando o backend grava histórico leve). */
  interfaceTraffic?: { name: string; rxBytes?: string; txBytes?: string }[];
};

export type MikrotikNetworkNodeSummaryFromApi = {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
};

/** Agente usado na consulta de monitoramento quando monitoringChannel = REMOTE_AGENT. */
export type MikrotikExecutionAgentNodeFromApi = {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
};

/** GET /network-nodes */
export type NetworkNodeFromApi = {
  _id: string;
  name: string;
  code: string;
  type: "LOCAL" | "REMOTE_AGENT";
  status: string;
  connectionMode: string;
  isActive: boolean;
  host?: string;
  timeoutMs?: number;
  agentLastSeenAt?: string | null;
  agentMeta?: unknown;
  createdAt?: string;
  updatedAt?: string;
};

/** POST /network-nodes/:id/agent-token/rotate */
export type NetworkNodeRotateTokenFromApi = {
  node: NetworkNodeFromApi;
  agentTokenPlain: string;
  warning: string;
};

export type MikrotikServerMonitoringRowFromApi = {
  id: string;
  name: string;
  host: string;
  port?: number;
  isActive: boolean;
  executionMode?: string;
  agentId?: string | null;
  networkNodeId?: string | null;
  networkNode?: MikrotikNetworkNodeSummaryFromApi | null;
  /** LOCAL_DIRECT | REMOTE_AGENT | ERROR quando aplicável. */
  monitoringChannel?: string | null;
  executionAgentNode?: MikrotikExecutionAgentNodeFromApi | null;
  totalClients: number;
  online: boolean;
  lastError: string | null;
  lastPolledAt: string | null;
  lastSyncAt: string | null;
  lastJobStatus: string | null;
  identityName: string | null;
  version: string | null;
  board: string | null;
  uptime: string | null;
  cpuPercent: number | null;
  memoryTotalBytes: number | null;
  memoryFreeBytes: number | null;
  diskTotalBytes: number | null;
  diskFreeBytes: number | null;
  interfaces: MikrotikServerMonitoringInterfaceFromApi[];
  pppSecretCount: number | null;
  /** Total de sessões em /ppp/active no equipamento (consulta global). */
  activePppSessionsTotal?: number | null;
  alerts?: MikrotikOperationalAlertFromApi[];
  alertsCount?: number;
  criticalAlertsCount?: number;
  warningAlertsCount?: number;
  infoAlertsCount?: number;
};

export type MikrotikServersMonitoringSummaryFromApi = {
  totalServers: number;
  onlineServers: number;
  offlineServers: number;
  totalClients: number;
  totalPppSessions: number;
  criticalAlerts: number;
  warningAlerts: number;
  infoAlerts: number;
  generatedAt: string;
};

export type MikrotikServersMonitoringFromApi = {
  generatedAt: string;
  summary?: MikrotikServersMonitoringSummaryFromApi;
  servers: MikrotikServerMonitoringRowFromApi[];
};

/** GET /mikrotik/servers/:id/monitoring — detalhe operacional (sem password). */
export type MikrotikServerMonitoringDetailFromApi = Omit<MikrotikServerMonitoringRowFromApi, "interfaces"> & {
  generatedAt: string;
  interfaces: MikrotikServerMonitoringInterfaceDetailFromApi[];
  networkNode?: MikrotikNetworkNodeSummaryFromApi | null;
  /** Fase 4+ — omitido em APIs antigas. */
  activePppSessions?: MikrotikServerPppActiveSessionFromApi[];
  activePppSessionsTotal?: number;
  activePppSessionsTruncated?: boolean;
  alerts?: MikrotikOperationalAlertFromApi[];
  recentSnapshots?: MikrotikServerSnapshotHistoryRowFromApi[];
};

/** GET /mikrotik-monitoring/client/:id — leitura RouterOS + expectativa (intent). */
export type MikrotikDeviceStatus = "active" | "blocked" | "missing";

export type MikrotikClientMonitoringFromApi = {
  exists: boolean;
  disabled: boolean;
  profile: string | null;
  status: MikrotikDeviceStatus;
  intent: {
    recommendedSyncGoal: string;
    effectiveAccess: string;
  };
  expected: {
    deviceStatus: MikrotikDeviceStatus | null;
    profileHint: string | null;
  };
  divergent: boolean | null;
  divergenceReason: string | null;
  queryError: string | null;
  skipReason?: string | null;
};

/** GET /mikrotik-sync/summary */
export type MikrotikSyncSummaryFromApi = {
  pending: number;
  processing: number;
  done: number;
  failed: number;
};

export type MikrotikSyncJobStatus = "pending" | "processing" | "done" | "failed";

/** Auditoria da última execução terminal (worker). */
export type MikrotikSyncJobAuditFromApi = {
  executionMode: string | null;
  executionAction: string | null;
  executionMessage: string;
  executionError: string;
  executedAt: string | null;
  expectedSnapshot?: {
    clientId?: string | null;
    status?: string | null;
    recommendedSyncGoal?: string | null;
    effectiveAccess?: string | null;
  } | null;
};

/** GET /mikrotik-sync/jobs — populate opcional em clientId / tenantId */
export type MikrotikSyncJobFromApi = {
  _id: string;
  tenantId: string | { _id: string; name?: string; slug?: string };
  tenantName?: string;
  clientId: string | { _id: string; fullName?: string };
  serverId?: string | null;
  triggerReason?: string | null;
  triggerSource?: string | null;
  triggerContext?: Record<string, unknown> | null;
  intentSnapshot?: Record<string, unknown> | null;
  audit?: MikrotikSyncJobAuditFromApi | null;
  status: MikrotikSyncJobStatus;
  attempts: number;
  lastError: string;
  createdAt: string;
  updatedAt: string;
};

export type MikrotikSyncJobsListFromApi = {
  items: MikrotikSyncJobFromApi[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export function mikrotikSyncJobClientLabel(job: MikrotikSyncJobFromApi): string {
  const c = job.clientId;
  if (c && typeof c === "object" && "fullName" in c) return c.fullName || "—";
  return typeof c === "string" ? c : "—";
}

export function mikrotikSyncJobTenantLabel(job: MikrotikSyncJobFromApi): string {
  if (job.tenantName) return job.tenantName;
  const t = job.tenantId;
  if (t && typeof t === "object" && "name" in t) return t.name || "—";
  return typeof t === "string" ? t : "—";
}

/** Resposta GET /clients/:id/network-intent (política derivada; não executa RouterOS). */
export type ClientNetworkIntentFromApi = {
  clientId: string | null;
  status: ClientStatus;
  trustRelease: {
    configured: boolean;
    active: boolean;
    until: string | null;
    reason: string;
  };
  effectiveAccess: string;
  mikrotik: {
    serverLinked: boolean;
    serverId: string | null;
    syncState: string;
    lastSyncAttemptAt: string | null;
    lastSuccessAt: string | null;
    lastErrorMessage: string | null;
  };
  recommendedSyncGoal: string;
  messages: string[];
  execution: { routerOsInvoked: boolean; note: string };
};

export type PlanAuthType = "pppoe" | "hotspot";
export type PlanBillingCycle = "monthly" | "weekly" | "daily";

export type PlanNetworkRef = { id: string; name: string; code?: string; host?: string };

export type PlanFromApi = {
  _id: string;
  name: string;
  speedMbps: number;
  downloadMbps?: number;
  uploadMbps?: number | null;
  price: number;
  monthlyPrice?: number;
  billingCycle?: PlanBillingCycle | string;
  authType?: PlanAuthType | string;
  isActive?: boolean;
  status?: "active" | "inactive";
  networkNodeId?: string | { _id: string };
  serverId?: string | { _id: string; name?: string; host?: string };
  concentratorId?: string | { _id: string; name?: string; host?: string };
  popName?: string;
  description?: string;
  routerosProfileName?: string;
  mikrotik?: { profile?: string; rateLimit?: string; priority?: number };
  networkNode?: PlanNetworkRef | null;
  linkedNodes?: PlanNetworkRef[];
  linkedConcentrators?: PlanNetworkRef[];
  stats?: { clients: number; accesses: number; concentrators: number };
};

/** Populate em GET /invoices (invoiceService.list). */
export type InvoiceClientPopulated = {
  _id: string;
  fullName?: string;
  phone?: string;
  email?: string;
};

export type InvoicePlanPopulated = {
  _id: string;
  name?: string;
  speedMbps?: number;
  price?: number;
};

export type InvoiceStatus = "pending" | "paid" | "overdue" | "cancelled";

export type InvoiceFromApi = {
  _id: string;
  tenantId?: string;
  clientId: string | InvoiceClientPopulated;
  planId: string | InvoicePlanPopulated;
  amount: number;
  dueDate: string;
  status: InvoiceStatus;
  paidAt: string | null;
  competence: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
};

/** Resposta de POST /invoices/generate-month */
export type InvoiceGenerateMonthResult = {
  competence: string;
  eligibleCount: number;
  createdCount: number;
  skippedDuplicateCount: number;
  skippedOtherCount: number;
  warnings: string[];
};

/** Bloco de agregado por estado — GET /invoices/summary */
export type InvoiceSummaryBlock = {
  count: number;
  amount: number;
};

/** Resposta de GET /invoices/summary (filtros opcionais: status, clientId, competence) */
export type InvoiceSummaryFromApi = {
  pending: InvoiceSummaryBlock;
  paid: InvoiceSummaryBlock;
  overdue: InvoiceSummaryBlock;
  cancelled: InvoiceSummaryBlock;
  totalInvoices: number;
  totalAmount: number;
  filters: {
    competence: string | null;
    clientId: string | null;
    status: InvoiceStatus | null;
  };
};

export type FinancePolicyImpactItemFromApi = {
  clientId: string;
  clientName: string;
  clientStatus: string;
  overdueCount: number;
  maxDaysLate: number;
  inGrace: boolean;
  blockedByCutoffWindow: boolean;
  protectedStatus: boolean;
  eligibleForDelinquent: boolean;
  wouldReactivateWhenClear: boolean;
  antiFlap?: {
    holdMinutes: number;
    lastAutomaticTransitionAt: string | null;
    lastAutomaticTransitionReason: string;
    inHoldWindow: boolean;
    remainingMs: number | null;
  };
  diagnosis: string;
};

export type FinancePolicyImpactFromApi = {
  tenant: { id: string; slug: string };
  now: string;
  policy: {
    financeAutomationEnabled: boolean;
    financeGraceDays: number;
    financeMinOverdueInvoices: number;
    financeCutoffWindowEnabled: boolean;
    financeCutoffStartHour: number;
    financeCutoffEndHour: number;
    financeAutoReactivateWhenClear: boolean;
    financeAutomationMinHoldMinutes: number;
    financeTimezone: string;
  };
  evaluation: {
    cutoffWindowActiveNow: boolean;
    limit: number;
  };
  totals: {
    withOverdue: number;
    inGrace: number;
    eligibleForDelinquent: number;
    blockedByCutoffWindow: number;
    protectedStatus: number;
    totalDelinquent: number;
    wouldReactivateWhenClear: number;
    impactItems: number;
  };
  items: FinancePolicyImpactItemFromApi[];
};

export function invoiceClientName(c: InvoiceFromApi["clientId"]): string {
  if (c && typeof c === "object" && "fullName" in c) return c.fullName || "—";
  return "—";
}

export function invoicePlanName(p: InvoiceFromApi["planId"]): string {
  if (p && typeof p === "object" && "name" in p) return p.name || "—";
  return "—";
}

export function planDisplayName(planId: ClientFromApi["planId"]): string {
  if (planId && typeof planId === "object" && "name" in planId) return planId.name;
  return "—";
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}


export type ExecutiveDashboardFromApi = {
  now: string;
  tenant: { id: string; slug: string };
  executive: {
    willBlockToday: number;
    inGrace: number;
    alreadyBlocked: number;
    protected: number;
    divergent: number;
    failedExecutionsToday: number;
    operationalSuccessRate: number;
    doneExecutionsToday: number;
  };
  details: {
    policyImpactTotals: FinancePolicyImpactFromApi["totals"];
    divergenceTotals: {
      items: number;
      divergent: number;
      inSync: number;
      unknown: number;
      queryErrors: number;
    };
    failedJobsToday: Array<{
      id: string;
      clientId: string;
      clientName: string;
      attempts: number;
      lastError: string;
      executedAt: string | null;
    }>;
  };
};

export type ClientTimelineEventFromApi = {
  at: string;
  type: string;
  title: string;
  detail: string;
};

export type ClientTimelineFromApi = {
  now: string;
  client: { id: string; fullName: string; status: string };
  snapshot: {
    financeDiagnosis: string;
    eligibleForDelinquent: boolean;
    wouldReactivateWhenClear: boolean;
    syncState: string;
  };
  totals: {
    invoices: number;
    jobs: number;
    events: number;
  };
  events: ClientTimelineEventFromApi[];
};

/** GET /operations/logs */
export type OperationLogItemFromApi = {
  id: string;
  tenantId: string | null;
  userId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  payload: unknown;
  result: unknown;
  status: "success" | "error";
  errorMessage: string;
  requestId: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type OperationLogsPageFromApi = {
  items: OperationLogItemFromApi[];
  total: number;
  page: number;
  pageSize: number;
  tenantSlug?: string;
};

/** GET /monitoring/session-board — painel PPP vs cadastro por servidor. */
export type MonitoringSessionBoardPppStatus =
  | "online"
  | "sem_sessao"
  | "equipamento_indisponivel"
  | "nao_pppoe"
  | "sem_servidor"
  | string;

export type MonitoringSessionBoardSessionFromApi = {
  address: string | null;
  uptime: string | null;
  profile: string | null;
  service: string | null;
};

export type MonitoringSessionBoardRowFromApi = {
  clientId: string;
  fullName: string;
  username: string;
  authType: string;
  status: string;
  planName: string | null;
  planRateLabel: string | null;
  pppStatus: MonitoringSessionBoardPppStatus;
  session: MonitoringSessionBoardSessionFromApi | null;
  geo: { lat: number; lng: number } | null;
};

export type MonitoringSessionBoardServerBlockFromApi = {
  server: {
    id: string;
    name: string;
    host: string;
    isActive: boolean;
    online: boolean;
    lastError: string | null;
    monitoringChannel: string | null;
    cpuPercent: number | null;
    memoryFreeBytes: number | null;
    memoryTotalBytes: number | null;
    uptime: string | null;
    identityName: string | null;
    /** Presente quando a API de session-board incluir metadados do detalhe RouterOS. */
    version?: string | null;
    board?: string | null;
  };
  summary: {
    totalClients: number;
    pppOnline: number;
    pppSemSessao: number;
    naoPppoe: number;
    equipamentoIndisponivel: number;
    cadastroActive: number;
    cadastroPending: number;
    cadastroBloqueadosOuSimilares: number;
    pppActiveTotalRouter: number;
  };
  rows: MonitoringSessionBoardRowFromApi[];
};

export type MonitoringSessionBoardFromApi = {
  generatedAt: string;
  servers: MonitoringSessionBoardServerBlockFromApi[];
};

/** GET /monitoring/client/:id — resumo leve para ficha (sem session-board completo). */
export type MonitoringClientSummaryConnectionFromApi = {
  uptime: string | null;
  address: string | null;
  profile: string | null;
  service: string | null;
};

export type MonitoringClientSummaryFromApi = {
  generatedAt: string;
  clientId: string;
  fullName: string;
  status: string;
  ip: string | null;
  login: string | null;
  authType: string;
  pppStatus: MonitoringSessionBoardPppStatus;
  activeConnection: MonitoringClientSummaryConnectionFromApi | null;
  serverId: string | null;
  serverName: string | null;
  equipmentOnline: boolean;
  equipmentLastError: string | null;
  planName: string | null;
  planRateLabel: string | null;
};

/** Marcador derivado do session-board para mapa Leaflet. */
export type MonitoringMapMarker = {
  lat: number;
  lng: number;
  row: MonitoringSessionBoardRowFromApi;
  serverName: string;
};
