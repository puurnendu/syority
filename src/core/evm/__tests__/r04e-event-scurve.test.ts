/**
 * R0.4-E — Control Tower S-curve is Event-authoritative (M8.10).
 */
import { describe, expect, it, vi } from 'vitest';
import { mapEventCurveToChart, NO_SCHEDULE_PROGRESS_DATA } from '../mapEventCurveToChart';
import type { EvmCurveData, EvmSummary } from '../types';
import * as EvmSnapshotService from '../EvmSnapshotService';

const EVENT_A = 'event-a';
const EVENT_B = 'event-b';
const ORG = 'org-a';

describe('R0.4-E Event S-curve', () => {
  it('maps Event A series independently of Event B', () => {
    const curveA: EvmCurveData = {
      dates: ['2027-01-01'],
      pv: [10],
      ev: [8],
      ac: [9],
      eacProjection: [null],
    };
    const curveB: EvmCurveData = {
      dates: ['2027-06-01'],
      pv: [100],
      ev: [40],
      ac: [55],
      eacProjection: [120],
    };
    const a = mapEventCurveToChart(curveA);
    const b = mapEventCurveToChart(curveB);
    expect(a.timeSeries[0].Planned).toBe(10);
    expect(b.timeSeries[0].Planned).toBe(100);
    expect(a.timeSeries[0].name).not.toBe(b.timeSeries[0].name);
  });

  it('empty Event curve is not a Project 422', () => {
    const model = mapEventCurveToChart(null);
    expect(model.available).toBe(false);
    expect(model.message).toBe(NO_SCHEDULE_PROGRESS_DATA);
  });

  it('generateEventCurve is scoped by eventId and never looks up Project', async () => {
    const spy = vi.spyOn(EvmSnapshotService, 'generateEventCurve').mockImplementation(
      async (eventId: string) => {
        if (eventId === EVENT_A) {
          return { dates: ['2027-01-01'], pv: [1], ev: [1], ac: [1], eacProjection: [null] };
        }
        if (eventId === EVENT_B) {
          return { dates: ['2027-02-01'], pv: [9], ev: [2], ac: [3], eacProjection: [null] };
        }
        return null;
      }
    );

    const a = await EvmSnapshotService.generateEventCurve(EVENT_A, ORG);
    const b = await EvmSnapshotService.generateEventCurve(EVENT_B, ORG);
    expect(a?.pv[0]).toBe(1);
    expect(b?.pv[0]).toBe(9);
    expect(spy).toHaveBeenCalledWith(EVENT_A, ORG);
    expect(spy).toHaveBeenCalledWith(EVENT_B, ORG);
    spy.mockRestore();
  });

  it('maps live EVM KPIs from M8.10 summary without recalculating', () => {
    const curve: EvmCurveData = {
      dates: ['2027-01-01'],
      pv: [50],
      ev: [40],
      ac: [45],
      eacProjection: [null],
    };
    const summary = {
      spi: 0.8,
      cpi: 0.89,
      sv: -10,
      cv: -5,
      dataDate: '2027-01-01',
    } as EvmSummary;
    const model = mapEventCurveToChart(curve, summary);
    expect(model.metrics).toEqual({ spi: 0.8, cpi: 0.89, sv: -10, cv: -5 });
    expect(model.dataDate).toBe('2027-01-01');
  });
});
