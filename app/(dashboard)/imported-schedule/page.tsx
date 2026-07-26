'use client';

import { Calendar, Upload, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function ImportedSchedulePage() {
    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Baseline Schedule</h1>
                    <p className="text-gray-500 mt-1 text-lg">View and manage imported baseline schedules across projects.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link 
                        href="/integrations/import"
                        className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-sm hover:shadow-md font-medium"
                    >
                        <Upload className="w-4 h-4 mr-2" />
                        Import Schedule
                    </Link>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-12 text-center space-y-4">
                    <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Calendar className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-semibold text-gray-900">Please Select a Project</h2>
                    <p className="text-gray-500 max-w-md mx-auto">
                        Baseline schedules are specific to individual projects. Please navigate to a specific project to view its imported schedule.
                    </p>
                    <div className="pt-6 flex justify-center gap-4">
                        <Link 
                            href="/projects"
                            className="text-indigo-600 font-semibold inline-flex items-center hover:underline"
                        >
                            Go to Projects <ArrowRight className="w-4 h-4 ml-1" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
