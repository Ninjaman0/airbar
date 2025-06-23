import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useRealtime } from '../hooks/useRealtime';

const RealtimeStatus: React.FC = () => {
  const { isConnected } = useRealtime(() => {});

  return (
    <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium ${
      isConnected 
        ? 'bg-green-100 text-green-700' 
        : 'bg-red-100 text-red-700'
    }`}>
      {isConnected ? (
        <>
          <Wifi className="h-3 w-3" />
          <span>Live</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          <span>Offline</span>
        </>
      )}
    </div>
  );
};

export default RealtimeStatus;