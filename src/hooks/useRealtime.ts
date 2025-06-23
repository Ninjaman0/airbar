import { useEffect, useCallback } from 'react';
import { realtimeService, RealtimeEvent } from '../services/realtime';

export const useRealtime = (callback: (event: RealtimeEvent) => void, deps: any[] = []) => {
  const memoizedCallback = useCallback(callback, deps);

  useEffect(() => {
    const unsubscribe = realtimeService.subscribe(memoizedCallback);
    return unsubscribe;
  }, [memoizedCallback]);

  return {
    isConnected: realtimeService.isConnected(),
    broadcast: realtimeService.broadcast.bind(realtimeService),
  };
};