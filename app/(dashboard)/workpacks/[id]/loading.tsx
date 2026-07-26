export default function WorkpackDetailLoading() {
    return (
        <div className="space-y-4">
            {/* Header skeleton */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-2" />
                        <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
                    </div>
                    <div className="h-10 w-24 bg-gray-100 rounded-lg animate-pulse" />
                </div>
                <div className="flex gap-2">
                    <div className="h-6 w-20 bg-gray-100 rounded-full animate-pulse" />
                    <div className="h-6 w-16 bg-gray-100 rounded-full animate-pulse" />
                </div>
            </div>
            {/* Tabs skeleton */}
            <div className="bg-white border border-gray-200 rounded-xl">
                <div className="border-b border-gray-200 px-6">
                    <div className="flex gap-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-10 w-24 bg-gray-100 rounded-t animate-pulse" />
                        ))}
                    </div>
                </div>
                <div className="p-6">
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-12 bg-gray-50 rounded animate-pulse" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
