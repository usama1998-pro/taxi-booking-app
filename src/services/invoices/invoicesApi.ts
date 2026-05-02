import { API_BASE_URL } from '../../constants/config';
import { logger } from '../../lib/logger';
import type {
  CreateDriverInvoiceInput,
  DriverInvoice,
  DriverInvoiceAnalytics,
  PaginatedInvoices,
} from '../../types/invoice';

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { message?: unknown };
    if (Array.isArray(j.message)) {
      return j.message.map(String).join('\n');
    }
    if (typeof j.message === 'string') {
      return j.message;
    }
  } catch {
    /* ignore */
  }
  return text.trim() || `Request failed (${res.status})`;
}

async function authorizedJson<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  logger.debug('Invoices API', path);
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const msg = await readErrorMessage(res);
    logger.warn('Invoices API error', { path, status: res.status, msg });
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export const invoicesApi = {
  analytics(token: string): Promise<DriverInvoiceAnalytics> {
    return authorizedJson<DriverInvoiceAnalytics>('/drivers/me/invoices/analytics', token);
  },

  list(
    token: string,
    params: { page?: number; pageSize?: number } = {},
  ): Promise<PaginatedInvoices> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const q = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    return authorizedJson<PaginatedInvoices>(`/drivers/me/invoices?${q}`, token);
  },

  getById(token: string, id: string): Promise<DriverInvoice> {
    return authorizedJson<DriverInvoice>(`/drivers/me/invoices/${id}`, token);
  },

  create(token: string, body: CreateDriverInvoiceInput): Promise<DriverInvoice> {
    return authorizedJson<DriverInvoice>('/drivers/me/invoices', token, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  suggestedPrice(
    token: string,
    bookingReference: string,
  ): Promise<{ price: number; currency: string }> {
    const q = new URLSearchParams({ bookingReference });
    return authorizedJson<{ price: number; currency: string }>(
      `/drivers/me/invoices/suggested-price?${q}`,
      token,
    );
  },
};
