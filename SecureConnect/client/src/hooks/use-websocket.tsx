import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./use-auth";
import { WebSocketMessage } from "@shared/schema";
import { useToast } from "./use-toast";

// Create a single shared connection across components
class WebSocketManager {
  private static instance: WebSocketManager;
  public socket: WebSocket | null = null;
  public clientId: string;
  public isConnecting: boolean = false;
  public pendingReconnect: number | null = null;
  public reconnectAttempts: number = 0;
  public lastConnectionAttempt: number = 0;
  public listeners = new Map<string, Set<(data: any) => void>>();
  
  private constructor() {
    this.clientId = localStorage.getItem('ws_client_id') || this.generateClientId();
  }
  
  private generateClientId(): string {
    const id = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('ws_client_id', id);
    return id;
  }
  
  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }
  
  public registerListener(type: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    
    this.listeners.get(type)!.add(callback);
    
    return () => {
      const listeners = this.listeners.get(type);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(type);
        }
      }
    };
  }
  
  public dispatchMessage(type: string, payload: any) {
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(payload);
        } catch (err) {
          console.error(`Error in message listener for type ${type}:`, err);
        }
      });
    }
  }
}

const MAX_RECONNECT_ATTEMPTS = 5;
const MIN_CONNECTION_INTERVAL = 15000; // 15 seconds between reconnection attempts

export function useWebSocket() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  
  // Get the singleton instance
  const manager = useRef(WebSocketManager.getInstance());

  // Initialize connection with throttling
  const connect = useCallback(() => {
    if (!user) {
      console.log("WebSocket: Cannot connect, no user available");
      return;
    }
    
    const ws = manager.current;
    
    // Don't reconnect if we already have an active connection
    if (ws.socket?.readyState === WebSocket.OPEN) {
      console.log("WebSocket: Connection already active, not reconnecting");
      setIsConnected(true);
      return;
    }
    
    // Don't reconnect if we are currently connecting
    if (ws.isConnecting || ws.socket?.readyState === WebSocket.CONNECTING) {
      console.log("WebSocket: Already connecting, not starting a new connection");
      return;
    }

    // Throttle reconnection attempts
    const now = Date.now();
    const timeSinceLastAttempt = now - ws.lastConnectionAttempt;
    
    if (timeSinceLastAttempt < MIN_CONNECTION_INTERVAL) {
      console.log(`WebSocket: Throttling connection attempt, last attempt was ${timeSinceLastAttempt}ms ago`);
      if (!ws.pendingReconnect) {
        const delay = MIN_CONNECTION_INTERVAL - timeSinceLastAttempt;
        console.log(`WebSocket: Will retry in ${delay}ms`);
        ws.pendingReconnect = window.setTimeout(() => {
          ws.pendingReconnect = null;
          connect();
        }, delay);
      }
      return;
    }
    
    ws.isConnecting = true;
    ws.lastConnectionAttempt = now;
    
    try {
      // Close existing connection if any
      if (ws.socket) {
        console.log("WebSocket: Closing existing connection");
        ws.socket.close();
        ws.socket = null;
      }
      
      // Create new WebSocket connection
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      console.log(`WebSocket: Connecting to ${wsUrl} for user ${user.id}`);
      
      const socket = new WebSocket(wsUrl);
      ws.socket = socket;
      
      socket.onopen = () => {
        console.log("WebSocket: Connection established");
        setIsConnected(true);
        ws.reconnectAttempts = 0;
        ws.isConnecting = false;
        
        // Use the persistent client ID for this connection
        const timestamp = Date.now();
        
        // Authenticate the WebSocket connection
        console.log(`WebSocket: Sending authentication for user ${user.id} with clientId ${ws.clientId}`);
        
        // Send message directly on the socket
        socket.send(JSON.stringify({
          type: 'authenticate',
          userId: user.id,
          clientId: ws.clientId,
          timestamp
        }));
      };
      
      socket.onclose = (event) => {
        console.log(`WebSocket: Connection closed with code ${event.code}`);
        setIsConnected(false);
        ws.isConnecting = false;
        
        // Don't attempt to reconnect if this was a normal closure (code 1000)
        if (event.code === 1000 && (
            event.reason === "New connection established" || 
            event.reason === "Same client reconnected"
        )) {
          console.log("WebSocket: Connection was closed normally, not reconnecting");
          return;
        }
        
        // Attempt to reconnect after delay, but limit reconnect attempts
        if (ws.pendingReconnect) {
          clearTimeout(ws.pendingReconnect);
          ws.pendingReconnect = null;
        }
        
        if (ws.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          ws.reconnectAttempts++;
          // Use exponential backoff with jitter to avoid thundering herd problem
          const baseDelay = Math.min(1000 * Math.pow(2, ws.reconnectAttempts), 30000);
          const jitter = Math.random() * 1000;
          const delay = baseDelay + jitter;
          
          console.log(`WebSocket: Reconnecting in ${Math.round(delay)}ms (attempt ${ws.reconnectAttempts})`);
          ws.pendingReconnect = window.setTimeout(() => {
            ws.pendingReconnect = null;
            if (user) {
              connect();
            }
          }, delay);
        } else {
          console.log("WebSocket: Max reconnect attempts reached, giving up");
          toast({
            title: "Connection issue",
            description: "Could not connect to real-time service. Please reload the page.",
            variant: "destructive"
          });
        }
      };
      
      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        // Don't close the socket here, let the onclose handler deal with it
      };
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("WebSocket message received:", data.type, data.payload);
          
          // Important - update lastMessage state to trigger react effects
          setLastMessage(data);
          
          // Dispatch the message to all registered handlers
          manager.current.dispatchMessage(data.type, data.payload);
          
          // Special handling for new messages to ensure immediate updates
          if (data.type === 'new_message' && data.payload) {
            const chatId = data.payload.chatId;
            if (chatId) {
              console.log("Invalidating messages for chat", chatId);
              // Force invalidation of queries to refresh the messages
              window.setTimeout(() => {
                import('@/lib/queryClient').then(({ queryClient }) => {
                  queryClient.invalidateQueries({ 
                    queryKey: [`/api/chats/${chatId}/messages`] 
                  });
                  queryClient.invalidateQueries({ 
                    queryKey: ['/api/chats'] 
                  });
                });
              }, 50);
            }
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };
    } catch (error) {
      console.error("WebSocket connection error:", error);
      ws.isConnecting = false;
    }
  }, [user, toast]);
  
  // Register a message handler for a specific message type
  const registerHandler = useCallback((messageType: string, handler: (data: any) => void) => {
    console.log(`Registering handler for message type: ${messageType}`);
    return manager.current.registerListener(messageType, handler);
  }, []);
  
  // Send message through the WebSocket
  const sendMessage = useCallback((data: any) => {
    const ws = manager.current;
    
    if (ws.socket && ws.socket.readyState === WebSocket.OPEN) {
      const message = JSON.stringify(data);
      console.log(`WebSocket: Sending message:`, data);
      ws.socket.send(message);
      return true;
    } else {
      console.warn(`WebSocket: Cannot send message, socket not open. ReadyState:`, 
        ws.socket ? ws.socket.readyState : 'null');
      
      // Try to reconnect if socket is not open
      if (!ws.isConnecting && (!ws.socket || ws.socket.readyState === WebSocket.CLOSED)) {
        console.log("WebSocket: Auto-reconnecting on send failure");
        connect();
      }
      
      return false;
    }
  }, [connect]);

  // Force reconnection
  const reconnect = useCallback(() => {
    console.log("WebSocket: Manual reconnection triggered");
    manager.current.reconnectAttempts = 0;
    connect();
  }, [connect]);

  // Initialize WebSocket once when the hook is first used
  useEffect(() => {
    const ws = manager.current;
    
    // Setup WebSocket only once when user is available and no active connection exists
    if (user && (!ws.socket || ws.socket.readyState !== WebSocket.OPEN)) {
      console.log("WebSocket: Initial connection setup for user", user.id);
      connect();
    } else if (user && ws.socket && ws.socket.readyState === WebSocket.OPEN) {
      // Already have an active connection
      setIsConnected(true);
    }
    
    // Return empty cleanup function - we don't want to close the shared socket on component unmount
    return () => {};
  }, [user, connect]);

  return {
    isConnected,
    lastMessage,
    sendMessage,
    connect,
    reconnect,
    registerHandler
  };
}
