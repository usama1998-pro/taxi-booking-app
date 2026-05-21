import { apiGetJson, apiPostJson } from '../api/apiFetch';
import type {
  CreateDriverInvoiceInput,
  DriverInvoice,
  DriverInvoiceAnalytics,
  PaginatedInvoices,
} from '../../types/invoice';

export const invoicesApi = {
  analytics(token: string): Promise<DriverInvoiceAnalytics> {
    return apiGetJson<DriverInvoiceAnalytics>('/drivers/me/invoices/analytics', token);
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
    return apiGetJson<PaginatedInvoices>(`/drivers/me/invoices?${q}`, token);
  },

  getById(token: string, id: string): Promise<DriverInvoice> {
    return apiGetJson<DriverInvoice>(`/drivers/me/invoices/${id}`, token);
  },

  create(token: string, body: CreateDriverInvoiceInput): Promise<DriverInvoice> {
    return apiPostJson<DriverInvoice>('/drivers/me/invoices', body, token);
  },

  suggestedPrice(
    token: string,
    bookingReference: string,
  ): Promise<{ price: number; currency: string }> {
    const q = new URLSearchParams({ bookingReference });
    return apiGetJson<{ price: number; currency: string }>(
      `/drivers/me/invoices/suggested-price?${q}`,
      token,
    );
  },
};
