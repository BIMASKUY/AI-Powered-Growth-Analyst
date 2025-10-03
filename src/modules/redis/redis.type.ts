import { Platform } from '../google-oauth/google-oauth.enum';
import { Method as GoogleAdsMethod } from '../google-ads/google-ads.enum';
import { Method as GoogleSearchConsoleMethod } from '../google-search-console/google-search-console.enum';
import { Method as GoogleAnalyticsMethod } from '../google-analytics/google-analytics.enum';

export interface ServiceKey {
  user_id: string;
  service: Platform;
  method: GoogleAnalyticsMethod | GoogleSearchConsoleMethod | GoogleAdsMethod;
  start_date: string;
  end_date: string;
}

export interface AdvancedServiceKey extends ServiceKey {
  limit: number;
  search: string;
}

export interface ParamServiceKey extends ServiceKey {
  param: string;
}
