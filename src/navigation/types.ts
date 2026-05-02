import type { NavigatorScreenParams } from '@react-navigation/native';

import type { InvoiceCreatePrefill } from '../types/invoice';

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

/** Shown as a full-screen pickup sign (large name on white). */
export type PickupSignParams = { customerName: string };

export type HomeStackParamList = {
  HomeMain: undefined;
  BookingDetail: { uuid: string };
  PickupSign: PickupSignParams;
};

export type BookingsStackParamList = {
  BookingsList: undefined;
  BookingDetail: { uuid: string };
  PickupSign: PickupSignParams;
};

export type InvoicesStackParamList = {
  InvoicesList: undefined;
  InvoiceCreate: { prefill?: InvoiceCreatePrefill };
  InvoiceDetail: { id: string };
};

/** Navigation type for screens used inside both Home and Bookings stacks (e.g. BookingDetail). */
export type BookingDetailHostStackParamList = HomeStackParamList & BookingsStackParamList;

export type DriverDrawerParamList = {
  Home: undefined;
  Bookings: undefined;
  Invoices: NavigatorScreenParams<InvoicesStackParamList> | undefined;
  Performance: undefined;
  Profile: undefined;
};
