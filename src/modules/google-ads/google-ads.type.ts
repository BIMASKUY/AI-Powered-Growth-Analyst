import { enums } from 'google-ads-api';

export interface BaseMetrics {
  impressions: number;
  currency: string;
  spend: number;
  conversion_rate_percent: number;
  ctr_percent: number;
  roi_percent: number;
}

export interface DailyMetrics extends BaseMetrics {
  date: string; // YYYY-MM-DD
}

export interface CampaignMetrics extends BaseMetrics {
  id: string;
  name: string;
  status: keyof typeof enums.CampaignStatus;
}
