import { GoogleAnalytics } from '../../google-analytics/entities/google-analytics.entity';
import { GoogleSearchConsole } from '../../google-search-console/entities/google-search-console.entity';
import { GoogleAds } from '../../google-ads/entities/google-ads.entity';

export interface AvailablePlatform {
  google_analytics: GoogleAnalytics;
  google_search_console: GoogleSearchConsole;
  google_ads: GoogleAds;
}
