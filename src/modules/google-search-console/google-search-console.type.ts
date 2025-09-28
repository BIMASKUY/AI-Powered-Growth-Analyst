export interface BaseMetrics {
  clicks: number;
  impressions: number;
  ctr_percent: number;
  average_position: number;
}

export interface DailyMetrics extends BaseMetrics {
  date: string; // YYYY-MM-DD
}

export interface KeywordMetrics extends BaseMetrics {
  keyword: string;
}

export interface CountryMetrics extends BaseMetrics {
  country: string;
}
