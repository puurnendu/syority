export default function DashboardLoading() {
    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <div className="h-8 w-40 bg-gray-200 rounded animate-pulse" />
                    <div className="h-4 w-24 bg-gray-100 rounded mt-2 animate-pulse" />
                </div>
                <div className="h-10 w-32 bg-gray-100 rounded-lg animate-pulse" />
            </div>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="h-12 bg-gray-50 border-b border-gray-200" />
                <div className="divide-y divide-gray-100">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-14 flex items-center gap-4 px-6">
                            <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                            <div className="h-4 flex-1 max-w-xs bg-gray-50 rounded animate-pulse" />
                            <div className="h-4 w-20 bg-gray-50 rounded animate-pulse" />
                            <div className="h-6 w-16 bg-gray-100 rounded-full animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
