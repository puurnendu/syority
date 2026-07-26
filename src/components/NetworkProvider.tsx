'use client';

import { useEffect, useState } from 'react';
import { processOfflineQueue } from '@/lib/offlineSync';

export function NetworkProvider() {
  const [isOnline, setIsOnline] = useState(true);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Initial state
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setShowBanner(true);
      
      // Process any queued offline actions
      processOfflineQueue();

      // Hide banner after 3 seconds
      setTimeout(() => setShowBanner(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div className={`fixed top-0 left-0 w-full z-50 text-center py-1.5 px-4 text-xs font-bold shadow-md transition-colors ${
      isOnline ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
    }`}>
      {isOnline 
        ? '🌍 Connection restored. Syncing offline changes...' 
        : '📵 You are currently offline. Changes will be saved locally.'}
    </div>
  );
}
