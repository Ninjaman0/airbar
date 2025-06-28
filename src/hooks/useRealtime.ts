import { useEffect, useCallback, useState } from 'react';
import { realtimeService, RealtimeEvent } from '../services/realtime';

export const useRealtime = (callback: (event: RealtimeEvent) => void, deps: any[] = []) => {
  const [connectionStatus, setConnectionStatus] = useState({
    supabase: false,
    websocket: false
  });

  const memoizedCallback = useCallback(callback, deps);

  useEffect(() => {
    const unsubscribe = realtimeService.subscribe(memoizedCallback);
    
    // Update connection status periodically
    const statusInterval = setInterval(() => {
      setConnectionStatus(realtimeService.getConnectionStatus());
    }, 1000);

    // Initial status check
    setConnectionStatus(realtimeService.getConnectionStatus());

    return () => {
      unsubscribe();
      clearInterval(statusInterval);
    };
  }, [memoizedCallback]);

  return {
    isConnected: realtimeService.isConnected(),
    connectionStatus,
    broadcast: realtimeService.broadcast.bind(realtimeService),
  };
};