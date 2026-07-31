export type HomeTripSummary = {
  id: string;
  title: string;
  description?: string;
  dateLabel?: string;
};

export type CreateTripInput = {
  title: string;
  startDate: string;
  endDate: string;
};
