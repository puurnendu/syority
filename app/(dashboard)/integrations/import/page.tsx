'use client';

import Link from 'next/link';
import { FiAlertTriangle, FiArrowRight } from 'react-icons/fi';

/**
 * @deprecated M11-R0 — Schedule Import has been permanently retired.
 *
 * The STO platform is a native Turnaround Scheduling platform.
 * Schedule creation follows: Digital Plant → Equipment → Scope → Workpack → Activity → CPM.
 */
export default function ScheduleImportPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Deprecation Banner */}
      <div className="bg-amber-50 border border-amber-300 rounded-xl p-6 mb-8">
        <div className="flex items-start gap-4">
          <FiAlertTriangle className="text-amber-600 text-2xl flex-shrink-0 mt-1" />
          <div>
            <h1 className="text-xl font-bold text-amber-900 mb-2">
              Schedule Import Has Been Retired
            </h1>
            <p className="text-amber-800 text-sm leading-relaxed mb-4">
              As of <strong>M11-R0</strong>, the STO platform no longer accepts schedule imports
              from Primavera P6 (XER/XML) or Microsoft Project (XML/MPP).
            </p>
            <p className="text-amber-800 text-sm leading-relaxed mb-4">
              STO is a <strong>native Turnaround Scheduling platform</strong>. Schedules are created
              directly from the Digital Plant hierarchy:
            </p>
            <div className="bg-white/70 rounded-lg p-4 text-sm text-gray-700 font-mono mb-4">
              Digital Plant → Equipment → Scope → Workpack → Activity → CPM
            </div>
            <p className="text-amber-800 text-sm leading-relaxed">
              Historical data imported via previous P6/MPP uploads is <strong>preserved</strong> and
              remains visible in the Schedule View. No data has been deleted.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Where to go instead</h2>
      <div className="space-y-3">
        <Link
          href="/schedule"
          className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
        >
          <div>
            <div className="font-medium text-gray-900">Execution Schedule</div>
            <div className="text-sm text-gray-500">
              View and manage the native STO schedule with Gantt chart, CPM, and critical path analysis.
            </div>
          </div>
          <FiArrowRight className="text-gray-400" />
        </Link>

        <Link
          href="/planning/readiness"
          className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors"
        >
          <div>
            <div className="font-medium text-gray-900">Planning Readiness</div>
            <div className="text-sm text-gray-500">
              Validate workpack readiness, identify gaps, and prepare for schedule execution.
            </div>
          </div>
          <FiArrowRight className="text-gray-400" />
        </Link>

        <Link
          href="/integrations/export"
          className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors"
        >
          <div>
            <div className="font-medium text-gray-900">Schedule Export</div>
            <div className="text-sm text-gray-500">
              Export the native schedule to P6 XER, Excel, or other formats for external stakeholders.
            </div>
          </div>
          <FiArrowRight className="text-gray-400" />
        </Link>
      </div>
    </div>
  );
}
