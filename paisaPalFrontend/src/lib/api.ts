type ApiResponse<T> = {
  data: T | null;
  error: string | null;
  message?: string;
};

function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_URL ?? '/api';
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResponse<T>> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
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

export async function fetchTransactions(): Promise<ApiTransaction[]> {
  const res = await requestJson<ListTransactionsData>('/transactions?limit=100');
  if (!res.data || res.error) {
    throw new Error(res.error ?? 'Failed to fetch transactions');
  }
  return res.data.transactions;
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
