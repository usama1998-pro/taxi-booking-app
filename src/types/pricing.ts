export type PassengerLuggageTier = {
  passengers: number;
  luggage: number;
  price: number;
};

export type PricingSettingsValues = {
  shortTripMaxKm: number;
  midMaxKm: number;
  midRateEurPerKm: number;
  longRateEurPerKm: number;
  infantCarrierFare: number;
  childSeatFare: number;
  boosterFare: number;
  passengerLuggageTiers: PassengerLuggageTier[];
};

export type PricingSettingsResponse = {
  values: PricingSettingsValues;
  defaults: PricingSettingsValues;
};
