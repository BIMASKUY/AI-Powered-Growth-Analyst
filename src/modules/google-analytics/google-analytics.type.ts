export interface BaseMetrics {
  sessions: number;
  screen_page_views: number;
  bounce_rate_percent: number;
  average_session_duration_seconds: number;
  active_users: number;
}

export interface DailyMetrics extends BaseMetrics {
  date: string; // YYYY-MM-DD
}

export interface CountryMetrics extends BaseMetrics {
  country: string;
}

export interface PageMetrics extends BaseMetrics {
  page: string;
  title: string;
}

export interface Property {
  property_id: string;
  property_name: string;
}
