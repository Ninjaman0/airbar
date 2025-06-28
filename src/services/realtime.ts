import { supabase } from '../lib/supabase';
import { User } from '../types';

export type RealtimeEvent = {
  type: 'ITEM_UPDATED' | 'SHIFT_UPDATED' | 'CUSTOMER_UPDATED' | 'EXPENSE_ADDED' | 'SUPPLY_ADDED' | 'USER_JOINED' | 'USER_LEFT';
  data: any;
  timestamp: number;
  userId?: string;
  section?: 'store' | 'supplement';
};

export type RealtimeCallback = (event: RealtimeEvent) => void;

class RealtimeService {
  private ws: WebSocket | null = null;
  private callbacks: Set<RealtimeCallback> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 2000;
  private isConnecting = false;
  private user: User | null = null;
  private supabaseSubscriptions: any[] = [];
  private wsEnabled = false;

  connect(user: User) {
    this.user = user;
    console.log('Connecting real-time services for user:', user.username);
    
    // Setup Supabase real-time subscriptions (primary real-time method)
    this.setupSupabaseRealtime();
    
    // Try to connect to WebSocket for additional features (optional)
    this.connectWebSocket();
  }

  private setupSupabaseRealtime() {
    try {
      // Subscribe to all table changes
      const tables = ['items', 'shifts', 'customers', 'customer_purchases', 'expenses', 'supplies', 'categories', 'admin_logs', 'users'];
      
      tables.forEach(table => {
        const channel = supabase.channel(`public:${table}`)
          .on('postgres_changes', 
            { 
              event: '*', 
              schema: 'public', 
              table: table 
            }, 
            (payload) => {
              console.log(`Supabase real-time update for ${table}:`, payload);
              
              // Convert Supabase payload to our RealtimeEvent format
              const event: RealtimeEvent = {
                type: this.getEventTypeFromTable(table),
                data: {
                  type: payload.eventType,
                  table: table,
                  record: payload.new || payload.old,
                  old_record: payload.old
                },
                timestamp: Date.now(),
                userId: this.user?.id,
              };

              // Broadcast to all callbacks
              this.callbacks.forEach(callback => {
                try {
                  callback(event);
                } catch (error) {
                  console.error('Error in real-time callback:', error);
                }
              });
            }
          )
          .subscribe((status) => {
            console.log(`Supabase subscription status for ${table}:`, status);
          });

        this.supabaseSubscriptions.push(channel);
      });

      console.log('Supabase real-time subscriptions established');
    } catch (error) {
      console.error('Error setting up Supabase real-time:', error);
    }
  }

  private getEventTypeFromTable(table: string): RealtimeEvent['type'] {
    switch (table) {
      case 'items':
      case 'categories':
      case 'admin_logs':
      case 'users':
        return 'ITEM_UPDATED';
      case 'shifts':
        return 'SHIFT_UPDATED';
      case 'customers':
      case 'customer_purchases':
        return 'CUSTOMER_UPDATED';
      case 'expenses':
        return 'EXPENSE_ADDED';
      case 'supplies':
        return 'SUPPLY_ADDED';
      default:
        return 'ITEM_UPDATED';
    }
  }

  private connectWebSocket() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    // Don't attempt WebSocket connection if we've already determined it's not available
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('WebSocket server not available, continuing with Supabase real-time only');
      return;
    }

    this.isConnecting = true;

    try {
      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
      console.log('Attempting WebSocket connection to:', wsUrl);
      
      this.ws = new WebSocket(wsUrl);

      // Set a timeout for the connection attempt
      const connectionTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
          console.log('WebSocket connection timeout, closing...');
          this.ws.close();
        }
      }, 5000);

      this.ws.onopen = () => {
        console.log('WebSocket connected successfully');
        clearTimeout(connectionTimeout);
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.wsEnabled = true;
        
        // Send user info
        this.send({
          type: 'USER_JOINED',
          data: { user: this.user },
          timestamp: Date.now(),
          userId: this.user?.id
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const realtimeEvent: RealtimeEvent = JSON.parse(event.data);
          this.callbacks.forEach(callback => {
            try {
              callback(realtimeEvent);
            } catch (error) {
              console.error('Error in WebSocket callback:', error);
            }
          });
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        clearTimeout(connectionTimeout);
        this.isConnecting = false;
        this.ws = null;
        this.wsEnabled = false;
        
        // Only attempt reconnect if it was a clean close or network error
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.log('WebSocket connection failed - this is optional, continuing with Supabase real-time');
        clearTimeout(connectionTimeout);
        this.isConnecting = false;
        this.wsEnabled = false;
      };
    } catch (error) {
      console.log('Failed to create WebSocket connection - continuing with Supabase real-time only');
      this.isConnecting = false;
      this.wsEnabled = false;
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts || !this.user) {
      console.log('WebSocket server not available, using Supabase real-time only');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    
    console.log(`Attempting to reconnect WebSocket in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (this.user) {
        this.connectWebSocket();
      }
    }, delay);
  }

  disconnect() {
    console.log('Disconnecting real-time services');
    
    // Unsubscribe from Supabase channels
    this.supabaseSubscriptions.forEach(channel => {
      try {
        supabase.removeChannel(channel);
      } catch (error) {
        console.error('Error removing Supabase channel:', error);
      }
    });
    this.supabaseSubscriptions = [];

    // Close WebSocket connection if available
    if (this.ws && this.wsEnabled) {
      try {
        this.send({
          type: 'USER_LEFT',
          data: { user: this.user },
          timestamp: Date.now(),
          userId: this.user?.id
        });
        
        this.ws.close(1000, 'User disconnected');
      } catch (error) {
        console.error('Error closing WebSocket:', error);
      }
      this.ws = null;
    }
    
    this.user = null;
    this.callbacks.clear();
    this.wsEnabled = false;
    console.log('Real-time connections disconnected');
  }

  subscribe(callback: RealtimeCallback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  send(event: RealtimeEvent) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.wsEnabled) {
      try {
        this.ws.send(JSON.stringify(event));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
      }
    }
  }

  broadcast(type: RealtimeEvent['type'], data: any, section?: 'store' | 'supplement') {
    const event: RealtimeEvent = {
      type,
      data,
      timestamp: Date.now(),
      userId: this.user?.id,
      section
    };

    // Send via WebSocket if available
    this.send(event);
    
    // Also trigger local callbacks for immediate UI updates
    this.callbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in broadcast callback:', error);
      }
    });
  }

  isConnected(): boolean {
    const wsConnected = this.ws !== null && this.ws.readyState === WebSocket.OPEN && this.wsEnabled;
    const supabaseConnected = this.supabaseSubscriptions.length > 0;
    return wsConnected || supabaseConnected;
  }

  getConnectionStatus(): { supabase: boolean; websocket: boolean } {
    return {
      supabase: this.supabaseSubscriptions.length > 0,
      websocket: this.ws !== null && this.ws.readyState === WebSocket.OPEN && this.wsEnabled
    };
  }
}

export const realtimeService = new RealtimeService();