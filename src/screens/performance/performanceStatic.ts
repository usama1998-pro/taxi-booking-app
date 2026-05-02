/** Placeholder analytics until wired to the API. */
export const performanceStatic = {
  totalRevenue: 18_420.5,
  cancelledBookings: 14,
  completedBookings: 186,
  /** Rolling 30-day average completed trips per week. */
  avgTripsPerWeek: 12.4,
  /** Passenger-reported average (static). */
  avgRating: 4.82,
  /** Mean fare for completed trips in the sample window. */
  avgRevenuePerTrip: 99.05,
  /** Last 7 days, Mon → Sun (currency units). */
  revenueByDay: [820, 640, 910, 750, 1020, 1180, 540],
  dayLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  /** Completed trips per week (last 6 weeks, oldest → newest). */
  weeklyCompleted: [11, 13, 10, 14, 12, 15],
  /** Cancelled trips per week (same window). */
  weeklyCancelled: [2, 1, 3, 0, 2, 1],
  weekLabels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'],
} as const;
