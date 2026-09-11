import { ResourcePlanningService } from './ResourcePlanningService';

export interface ResourceForecastSummary {
  resource_type_id: string;
  resource_type_name: string;
  contractor_id: string | null;
  forecast_demand: number;
  forecast_capacity: number;
  forecast_utilization: number;
  forecast_deficit: number;
  forecast_surplus: number;
  first_shortage_date: string | null;
  peak_shortage_date: string | null;
  max_forecast_deficit: number;
  future_shortage_days: number;
  max_consecutive_shortage_days: number;
  expected_project_finish_impact: number;
  status: 'NORMAL' | 'WATCH' | 'AT_RISK' | 'CRITICAL';
}

export class ResourceForecastService {
  static async getForecast(
    eventId: string,
    organizationId: string,
    filters?: { startDate?: string; endDate?: string }
  ): Promise<ResourceForecastSummary[]> {
    const rawData = await ResourcePlanningService.getDemandVsCapacity(eventId, organizationId, filters);

    // Group by resource_type_id + contractor_id
    const resourceMap = new Map<string, any>();

    const today = new Date();
    today.setUTCHours(0,0,0,0);
    const todayStr = today.toISOString().slice(0, 10);

    for (const point of rawData) {
      if (point.shift !== null) continue;
      
      // Forecasting generally looks forward from today, but if filters specify a past date we still process it
      // Let's assume we process whatever date range getDemandVsCapacity returns.

      const key = `${point.resource_type_id}|${point.contractor_id || 'null'}`;
      if (!resourceMap.has(key)) {
        resourceMap.set(key, {
          resource_type_id: point.resource_type_id,
          resource_type_name: point.resource_type_name,
          contractor_id: point.contractor_id,
          forecast_demand: 0,
          forecast_capacity: 0,
          forecast_deficit: 0,
          forecast_surplus: 0,
          first_shortage_date: null,
          peak_shortage_date: null,
          max_forecast_deficit: 0,
          future_shortage_days: 0,
          dates_with_deficit: [] as string[]
        });
      }

      const rm = resourceMap.get(key);
      rm.forecast_demand += point.planned_demand;
      rm.forecast_capacity += point.available_capacity;
      
      if (point.variance < 0) {
        const deficit = Math.abs(point.variance);
        rm.forecast_deficit += deficit;
        rm.future_shortage_days++;
        rm.dates_with_deficit.push(point.date);
        
        // Track first shortage
        if (!rm.first_shortage_date || point.date < rm.first_shortage_date) {
          rm.first_shortage_date = point.date;
        }

        // Track peak shortage
        if (deficit > rm.max_forecast_deficit) {
          rm.max_forecast_deficit = deficit;
          rm.peak_shortage_date = point.date;
        }
      } else {
        rm.forecast_surplus += point.variance;
      }
    }

    const forecast: ResourceForecastSummary[] = [];

    for (const [key, rm] of resourceMap.entries()) {
      rm.dates_with_deficit.sort();
      let max_consecutive = 0;
      let current_consecutive = 0;
      let prevDate: Date | null = null;
      for (const dateStr of rm.dates_with_deficit) {
        const d = new Date(dateStr);
        if (prevDate) {
          const diff = (d.getTime() - prevDate.getTime()) / 86400000;
          if (diff === 1) {
            current_consecutive++;
          } else {
            if (current_consecutive > max_consecutive) max_consecutive = current_consecutive;
            current_consecutive = 1;
          }
        } else {
          current_consecutive = 1;
        }
        prevDate = d;
      }
      if (current_consecutive > max_consecutive) max_consecutive = current_consecutive;

      const util = rm.forecast_capacity > 0 ? (rm.forecast_demand / rm.forecast_capacity) * 100 : (rm.forecast_demand > 0 ? 100 : 0);
      
      let status: 'NORMAL' | 'WATCH' | 'AT_RISK' | 'CRITICAL' = 'NORMAL';
      if (util > 100 || rm.forecast_deficit > 0) status = 'CRITICAL';
      else if (util >= 90) status = 'AT_RISK';
      else if (util >= 80) status = 'WATCH';

      // Project finish impact: A simple heuristic for now. If there's a deficit, there's a risk of impact. 
      // The exact CPM impact would require a simulation. We approximate based on max consecutive shortage.
      const expected_project_finish_impact = max_consecutive > 0 ? max_consecutive : 0;

      forecast.push({
        resource_type_id: rm.resource_type_id,
        resource_type_name: rm.resource_type_name,
        contractor_id: rm.contractor_id === 'null' ? null : rm.contractor_id,
        forecast_demand: Number(rm.forecast_demand.toFixed(2)),
        forecast_capacity: Number(rm.forecast_capacity.toFixed(2)),
        forecast_utilization: Number(util.toFixed(2)),
        forecast_deficit: Number(rm.forecast_deficit.toFixed(2)),
        forecast_surplus: Number(rm.forecast_surplus.toFixed(2)),
        first_shortage_date: rm.first_shortage_date,
        peak_shortage_date: rm.peak_shortage_date,
        max_forecast_deficit: Number(rm.max_forecast_deficit.toFixed(2)),
        future_shortage_days: rm.future_shortage_days,
        max_consecutive_shortage_days: max_consecutive,
        expected_project_finish_impact,
        status
      });
    }

    // Sort by status severity
    const statusWeight = { CRITICAL: 4, AT_RISK: 3, WATCH: 2, NORMAL: 1 };
    forecast.sort((a, b) => {
       if (statusWeight[a.status] !== statusWeight[b.status]) return statusWeight[b.status] - statusWeight[a.status];
       return a.resource_type_name.localeCompare(b.resource_type_name);
    });

    return forecast;
  }
}
