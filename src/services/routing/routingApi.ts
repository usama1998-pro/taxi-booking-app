import { buildApiUrl } from '../../constants/config';
import { ApiRequestError, readResponseErrorMessage } from '../../lib/apiErrors';
import { buildApiHeaders } from '../../lib/apiHeaders';

export type PlaceSuggestion = {
  description: string;
  placeId: string;
};

export type RouteQuotePayload = {
  from: string;
  to: string;
  passengerCount: number;
  luggageCount: number;
  infantCarrierCount?: number;
  childSeatCount?: number;
  boosterCount?: number;
  isReturnTrip?: boolean;
};

export type RouteQuoteResponse = {
  distanceKm: number;
  distanceSurchargeEur: number;
  baseFareEur: number;
  oneWayPriceEur?: number;
  returnPriceEur?: number;
  estimatedPriceEur: number;
  durationMinutes: number;
};

export async function fetchPlaces(input: string): Promise<PlaceSuggestion[]> {
  const url = buildApiUrl('/routing/places');
  const res = await fetch(url, {
    method: 'POST',
    headers: buildApiHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ input }),
  });
  if (!res.ok) {
    throw new ApiRequestError(await readResponseErrorMessage(res), res.status, '/routing/places');
  }
  const json = (await res.json()) as PlaceSuggestion[];
  return Array.isArray(json) ? json : [];
}

export async function fetchRouteQuote(payload: RouteQuotePayload): Promise<RouteQuoteResponse> {
  const url = buildApiUrl('/routing/quote');
  const res = await fetch(url, {
    method: 'POST',
    headers: buildApiHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new ApiRequestError(await readResponseErrorMessage(res), res.status, '/routing/quote');
  }
  const json = (await res.json()) as RouteQuoteResponse;
  if (typeof json?.estimatedPriceEur !== 'number') {
    throw new ApiRequestError('Route quote could not be loaded.', res.status, '/routing/quote');
  }
  return json;
}
