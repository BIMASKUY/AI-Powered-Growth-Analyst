import { Property } from '../google-analytics/google-analytics.type';
import { GoogleSearchConsole } from '../google-search-console/entities/google-search-console.entity';
import { GoogleAds } from '../google-ads/entities/google-ads.entity';

export interface GoogleAnalyticsPlatform {
  connected: boolean;
  current: Property;
  options: Property[];
}

export interface GoogleSearchConsolePlatform {
  connected: boolean;
  current: GoogleSearchConsole;
  options: GoogleSearchConsole[];
}

export interface GoogleAdsPlatform {
  connected: boolean;
  current: GoogleAds;
  options: string[];
}

export interface Platform {
  google_analytics: GoogleAnalyticsPlatform;
  google_search_console: GoogleSearchConsolePlatform;
  google_ads: GoogleAdsPlatform;
}
