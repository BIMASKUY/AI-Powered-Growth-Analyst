import { GoogleAnalytics } from './google-analytics.entity';
import { GoogleSearchConsole } from './google-search-console.entity';
import { GoogleAds } from './google-ads.entity';

export interface AvailablePlatform {
  google_analytics: GoogleAnalytics;
  google_search_console: GoogleSearchConsole;
  google_ads: GoogleAds;
}
