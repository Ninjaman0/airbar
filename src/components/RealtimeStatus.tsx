import React from 'react';
import { Wifi, WifiOff, Activity } from 'lucide-react';
import { useRealtime } from '../hooks/useRealtime';

const RealtimeStatus: React.FC = () => {
  const { isConnected, connectionStatus } = useRealtime(() => {});

  return (
    <div className="flex items-center space-x-2">
      {/* Main connection indicator */}
      <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium ${
        isConnected 
          ? 'bg-green-100 text-green-700' 
          : 'bg-red-100 text-red-700'
      }`}>
        {isConnected ? (
          <>
            <Activity className="h-3 w-3 animate-pulse" />
            <span>متصل</span>
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3" />
            <span>غير متصل</span>
          </>
        )}
      </div>

      {/* Detailed connection status */}
      <div className="flex items-center space-x-1">
        {/* Supabase connection */}
        <div className={`w-2 h-2 rounded-full ${
          connectionStatus.supabase ? 'bg-green-500' : 'bg-red-500'
        }`} title={`Supabase: ${connectionStatus.supabase ? 'Connected' : 'Disconnected'}`} />
        
        {/* WebSocket connection */}
        <div className={`w-2 h-2 rounded-full ${
          connectionStatus.websocket ? 'bg-blue-500' : 'bg-gray-400'
        }`} title={`WebSocket: ${connectionStatus.websocket ? 'Connected' : 'Disconnected'}`} />
      </div>
    </div>
  );
};

export default RealtimeStatus;