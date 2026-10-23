export interface IAnalyticsDashboardResponse {
  period: string;
  generatedAt: string;
  summary: {
    totalViews: number;
    clicks: number;
    conversionRate: string;
  };
  chartData: Array<{ day: string; value: number }>;
  mockedForUser: number;
}
