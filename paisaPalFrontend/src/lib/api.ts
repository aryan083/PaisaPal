type ApiResponse<T> = {
  data: T | null;
  error: string | null;
  message?: string;
};

function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_URL ?? '/api';
}

function getAuthToken(): string | null {
  try {
    const stored = localStorage.getItem('auth-storage')
    if (!stored) return null
    const parsed = JSON.parse(stored)
    return parsed?.state?.token ?? null
  } catch {
    return null
  }
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResponse<T>> {
  const token = getAuthToken()
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const json = (await res.json()) as ApiResponse<T>;
  return json;
}

export type ApiTransaction = {
  _id: string;
  date: string;
  particulars: string;
  amount: number;
  category: string;
  mode: 'Online' | 'Cash';
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ListTransactionsData = {
  transactions: ApiTransaction[];
  total: number;
  page: number;
  pages: number;
};

export type TransactionFilters = {
  search?: string;
  category?: string;
  mode?: 'Online' | 'Cash';
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  hasNotes?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
};

function buildQueryParams(filters: TransactionFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.category) params.set('category', filters.category);
  if (filters.mode) params.set('mode', filters.mode);
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.minAmount !== undefined) params.set('minAmount', String(filters.minAmount));
  if (filters.maxAmount !== undefined) params.set('maxAmount', String(filters.maxAmount));
  if (filters.hasNotes !== undefined) params.set('hasNotes', String(filters.hasNotes));
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.order) params.set('order', filters.order);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  const str = params.toString();
  return str ? `?${str}` : '';
}

export async function fetchTransactions(filters?: TransactionFilters): Promise<ApiTransaction[]> {
  const query = filters ? buildQueryParams(filters) : '?limit=100';
  const res = await requestJson<ListTransactionsData>(`/transactions${query}`);
  if (!res.data || res.error) {
    throw new Error(res.error ?? 'Failed to fetch transactions');
  }
  return res.data.transactions;
}

export async function fetchTransactionsPaginated(filters?: TransactionFilters): Promise<ListTransactionsData> {
  const query = filters ? buildQueryParams(filters) : '?limit=50';
  const res = await requestJson<ListTransactionsData>(`/transactions${query}`);
  if (!res.data || res.error) {
    throw new Error(res.error ?? 'Failed to fetch transactions');
  }
  return res.data;
}

export async function createTransactionApi<T>(body: T): Promise<ApiTransaction> {
  const res = await requestJson<ApiTransaction>('/transactions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.data || res.error) {
    throw new Error(res.error ?? 'Failed to create transaction');
  }
  return res.data;
}

export async function updateTransactionApi<T>(
  id: string,
  body: T,
): Promise<ApiTransaction> {
  const res = await requestJson<ApiTransaction>(`/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!res.data || res.error) {
    throw new Error(res.error ?? 'Failed to update transaction');
  }
  return res.data;
}

export async function deleteTransactionApi(id: string): Promise<void> {
  const res = await requestJson<null>(`/transactions/${id}`, { method: 'DELETE' });
  if (res.error) {
    throw new Error(res.error);
  }
}

export async function exportTransactionsCsv(filters?: TransactionFilters): Promise<string> {
  const query = filters ? buildQueryParams(filters) : '';
  const res = await fetch(`${getApiBaseUrl()}/transactions/export/csv${query}`);
  if (!res.ok) {
    throw new Error('Failed to export transactions');
  }
  return res.text();
}

export type ImportResult = {
  inserted: number;
  failed: number;
  duplicates: number;
  errors: Array<{ row: number; error: string }>;
  duplicateDetails?: Array<{
    row: number;
    particulars: string;
    amount: number;
    date: string;
    reason: string;
  }>;
  preview?: Array<{
    row: number;
    data: {
      date: string;
      particulars: string;
      amount: number;
      category: string;
      mode: string;
      notes: string;
    };
    isDuplicate: boolean;
  }>;
};

export async function importTransactionsCsv(
  file: File,
  options?: { dryRun?: boolean; skipDuplicates?: boolean },
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);

  const params = new URLSearchParams();
  if (options?.dryRun) params.set('dryRun', 'true');
  if (options?.skipDuplicates) params.set('skipDuplicates', 'true');
  const query = params.toString();

  // Get auth token from localStorage
  const authStorage = localStorage.getItem('auth-storage');
  let token: string | undefined;
  if (authStorage) {
    try {
      const parsed = JSON.parse(authStorage);
      token = parsed.state?.token;
    } catch {
      // ignore parse errors
    }
  }

  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${getApiBaseUrl()}/transactions/import/csv${query ? `?${query}` : ''}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const json = (await res.json()) as ApiResponse<ImportResult>;
  if (!json.data || json.error) {
    throw new Error(json.error ?? 'Failed to import transactions');
  }
  return json.data;
}

export type ApiSettings = { stipend: number; extra: number };

export async function fetchSettings(): Promise<ApiSettings> {
  const res = await requestJson<ApiSettings>('/settings');
  if (!res.data || res.error) {
    throw new Error(res.error ?? 'Failed to fetch settings');
  }
  return res.data;
}

export async function updateSettingsApi(
  body: Partial<ApiSettings>,
): Promise<ApiSettings> {
  const res = await requestJson<ApiSettings>('/settings', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!res.data || res.error) {
    throw new Error(res.error ?? 'Failed to update settings');
  }
  return res.data;
}

export type ApiStats = Record<string, unknown>;

export async function fetchStats(): Promise<ApiStats> {
  const res = await requestJson<ApiStats>('/stats');
  if (!res.data || res.error) {
    throw new Error(res.error ?? 'Failed to fetch stats');
  }
  return res.data;
}

// Recurring Rules API
export type ApiRecurringRule = {
  _id: string;
  name: string;
  particulars: string;
  amount: number;
  category: string;
  mode: 'Online' | 'Cash';
  notes: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  dayOfMonth?: number;
  dayOfWeek?: number;
  startDate: string;
  endDate?: string;
  lastGenerated?: string;
  nextDue: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RecurringRuleInput = {
  name: string;
  particulars: string;
  amount: number;
  category: string;
  mode: 'Online' | 'Cash';
  notes?: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  dayOfMonth?: number;
  dayOfWeek?: number;
  startDate: string;
  endDate?: string;
  isActive?: boolean;
};

export async function fetchRecurringRules(): Promise<ApiRecurringRule[]> {
  const res = await requestJson<ApiRecurringRule[]>('/recurring');
  if (!res.data || res.error) {
    throw new Error(res.error ?? 'Failed to fetch recurring rules');
  }
  return res.data;
}

export async function createRecurringRule(body: RecurringRuleInput): Promise<ApiRecurringRule> {
  const res = await requestJson<ApiRecurringRule>('/recurring', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.data || res.error) {
    throw new Error(res.error ?? 'Failed to create recurring rule');
  }
  return res.data;
}

export async function updateRecurringRule(id: string, body: Partial<RecurringRuleInput>): Promise<ApiRecurringRule> {
  const res = await requestJson<ApiRecurringRule>(`/recurring/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!res.data || res.error) {
    throw new Error(res.error ?? 'Failed to update recurring rule');
  }
  return res.data;
}

export async function deleteRecurringRule(id: string): Promise<void> {
  const res = await requestJson<null>(`/recurring/${id}`, { method: 'DELETE' });
  if (res.error) {
    throw new Error(res.error);
  }
}

export type PreviewResult = {
  rule: RecurringRuleInput;
  nextOccurrences: string[];
};

export async function previewRecurringRule(body: RecurringRuleInput, count?: number): Promise<PreviewResult> {
  const query = count ? `?count=${count}` : '';
  const res = await requestJson<PreviewResult>(`/recurring/preview${query}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.data || res.error) {
    throw new Error(res.error ?? 'Failed to preview recurring rule');
  }
  return res.data;
}

export type RunResult = {
  created: number;
  skipped: number;
  transactions: Array<{
    ruleId: string;
    ruleName: string;
    particulars: string;
    amount: number;
    category: string;
    date: string;
  }>;
};

export async function runRecurringRules(dryRun?: boolean): Promise<RunResult> {
  const query = dryRun ? '?dryRun=true' : '';
  const res = await requestJson<RunResult>(`/recurring/run${query}`);
  if (!res.data || res.error) {
    throw new Error(res.error ?? 'Failed to run recurring rules');
  }
  return res.data;
}

// Budgets API
export type ApiBudget = {
  _id: string;
  category: string;
  monthlyLimit: number;
  month: string;
  createdAt: string;
  updatedAt: string;
};

export type BudgetInput = {
  category: string;
  monthlyLimit: number;
  month: string;
};

export type BudgetStat = {
  category: string;
  monthlyLimit: number;
  spent: number;
  remaining: number;
  percentage: number;
  isOverBudget: boolean;
};

export type BudgetStatsData = {
  month: string;
  budgets: BudgetStat[];
  totalBudgeted: number;
  totalSpent: number;
};

export async function fetchBudgets(month?: string): Promise<ApiBudget[]> {
  const query = month ? `?month=${month}` : '';
  const res = await requestJson<ApiBudget[]>(`/budgets${query}`);
  if (!res.data || res.error) {
    throw new Error(res.error ?? 'Failed to fetch budgets');
  }
  return res.data;
}

export async function createBudget(body: BudgetInput): Promise<ApiBudget> {
  const res = await requestJson<ApiBudget>('/budgets', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.data || res.error) {
    throw new Error(res.error ?? 'Failed to create budget');
  }
  return res.data;
}

export async function updateBudget(id: string, body: { monthlyLimit: number }): Promise<ApiBudget> {
  const res = await requestJson<ApiBudget>(`/budgets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!res.data || res.error) {
    throw new Error(res.error ?? 'Failed to update budget');
  }
  return res.data;
}

export async function deleteBudget(id: string): Promise<void> {
  const res = await requestJson<null>(`/budgets/${id}`, { method: 'DELETE' });
  if (res.error) {
    throw new Error(res.error);
  }
}

export async function fetchBudgetStats(month: string): Promise<BudgetStatsData> {
  const res = await requestJson<BudgetStatsData>(`/budgets/stats?month=${month}`);
  if (!res.data || res.error) {
    throw new Error(res.error ?? 'Failed to fetch budget stats');
  }
  return res.data;
}

// Audit Log API
export type ApiAuditLog = {
  _id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  resource: 'transaction' | 'settings' | 'budget' | 'recurring';
  resourceId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata: {
    ip?: string;
    userAgent?: string;
  };
  createdAt: string;
};

export async function fetchAuditLogs(limit?: number, resource?: string): Promise<ApiAuditLog[]> {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  if (resource) params.set('resource', resource);
  const query = params.toString();
  const res = await requestJson<ApiAuditLog[]>(`/audit${query ? `?${query}` : ''}`);
  if (!res.data || res.error) {
    throw new Error(res.error ?? 'Failed to fetch audit logs');
  }
  return res.data;
}
