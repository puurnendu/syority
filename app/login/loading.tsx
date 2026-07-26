export default function LoginLoading() {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="h-8 w-32 bg-gray-200 rounded mx-auto mb-2 animate-pulse" />
                    <div className="h-4 w-16 bg-gray-100 rounded mx-auto animate-pulse" />
                    <div className="h-4 w-56 bg-gray-100 rounded mx-auto mt-4 animate-pulse" />
                </div>
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                    <div className="h-6 w-20 bg-gray-100 rounded mb-4 animate-pulse" />
                    <div className="space-y-4">
                        <div className="h-10 bg-gray-50 rounded-lg animate-pulse" />
                        <div className="h-10 bg-gray-50 rounded-lg animate-pulse" />
                        <div className="h-10 bg-gray-50 rounded-lg animate-pulse" />
                        <div className="h-10 bg-blue-100 rounded-lg animate-pulse" />
                    </div>
                </div>
            </div>
        </div>
    );
}
