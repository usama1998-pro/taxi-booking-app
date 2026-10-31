import { apiGetJson, apiPostJson, apiPutJson } from '../api/apiFetch';
import type { PricingSettingsResponse, PricingSettingsValues } from '../../types/pricing';

export type PricingUnlockStatus = {
  locked: boolean;
  failures: number;
  lockouts: number;
  remainingSeconds: number;
  unlocked: boolean;
  attemptsRemaining: number;
  unlockedForSeconds?: number;
};

export const pricingApi = {
  unlockStatus(token: string, options?: { fresh?: boolean }): Promise<PricingUnlockStatus> {
    const qs = options?.fresh ? '?fresh=true' : '';
    return apiGetJson<PricingUnlockStatus>(`/drivers/me/pricing/unlock-status${qs}`, token);
  },

  unlock(token: string, code: string): Promise<PricingUnlockStatus> {
    return apiPostJson<PricingUnlockStatus>('/drivers/me/pricing/unlock', { code }, token);
  },

  get(token: string): Promise<PricingSettingsResponse> {
    return apiGetJson<PricingSettingsResponse>('/drivers/me/pricing', token);
  },

  update(token: string, body: PricingSettingsValues): Promise<PricingSettingsResponse> {
    return apiPutJson<PricingSettingsResponse>('/drivers/me/pricing', body, token);
  },
};
