import { Platform } from '../google-oauth/google-oauth.enum';
import { Method as GoogleAdsMethod } from '../google-ads/google-ads.enum';
import { Method as GoogleSearchConsoleMethod } from '../google-search-console/google-search-console.enum';

export interface ServiceKey {
  user_id: string;
  service: Platform;
  method: GoogleAdsMethod | GoogleSearchConsoleMethod;
  start_date: string;
  end_date: string;
}

export interface AdvancedServiceKey extends ServiceKey {
  limit: number;
  search: string;
}
