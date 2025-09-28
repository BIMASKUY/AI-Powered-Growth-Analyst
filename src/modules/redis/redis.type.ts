import { Platform } from '../google-oauth/google-oauth.enum';
import { Method } from '../google-ads/google-ads.enum';

export interface ServiceKey {
  user_id: string;
  service: Platform;
  method: Method;
  start_date: string;
  end_date: string;
}

export interface AdvancedServiceKey extends ServiceKey {
  limit: number;
  search: string;
}
