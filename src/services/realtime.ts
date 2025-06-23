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
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private user: User | null = null;

  connect(user: User) {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.user = user;
    this.isConnecting = true;

    try {
      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
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
          this.callbacks.forEach(callback => callback(realtimeEvent));
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnecting = false;
        this.ws = null;
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.isConnecting = false;
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts || !this.user) {
      console.log('Max reconnection attempts reached or no user');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      if (this.user) {
        this.connect(this.user);
      }
    }, delay);
  }

  disconnect() {
    if (this.ws) {
      this.send({
        type: 'USER_LEFT',
        data: { user: this.user },
        timestamp: Date.now(),
        userId: this.user?.id
      });
      
      this.ws.close();
      this.ws = null;
    }
    this.user = null;
    this.callbacks.clear();
  }

  subscribe(callback: RealtimeCallback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  send(event: RealtimeEvent) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  broadcast(type: RealtimeEvent['type'], data: any, section?: 'store' | 'supplement') {
    this.send({
      type,
      data,
      timestamp: Date.now(),
      userId: this.user?.id,
      section
    });
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export const realtimeService = new RealtimeService();