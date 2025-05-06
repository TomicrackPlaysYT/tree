/**
 * A robust WebSocket client that handles reconnection and message passing
 * with special consideration for handling mobile and browser inconsistencies
 */
class WebSocketClient {
  private socket: WebSocket | null = null;
  private reconnectTimeout: number | null = null;
  private heartbeatInterval: number | null = null;
  private userId: number | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private isConnecting: boolean = false;
  private clientId: string = "";
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS: number = 15; // Increased for more resilience
  private lastConnectionAttempt: number = 0;
  private readonly MIN_CONNECTION_INTERVAL: number = 2000; // More frequent connection attempts allowed
  private readonly HEARTBEAT_INTERVAL: number = 25000; // 25 seconds between heartbeats
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'authenticated' = 'disconnected';
  private messageQueue: any[] = []; // Queue for messages that couldn't be sent while disconnected

  constructor() {
    // Generate a stable client ID
    this.clientId = localStorage.getItem('ws_client_id') || 
      (() => {
        const id = Math.random().toString(36).substring(2, 15);
        localStorage.setItem('ws_client_id', id);
        return id;
      })();
  }

  // Initialize the WebSocket connection
  // Get connection state
  public getState(): string {
    return this.connectionState;
  }

  // Check if connected
  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  // Connect to the WebSocket server
  public connect(userId: number): void {
    // If already connecting or userId is missing, don't proceed
    if (this.isConnecting || !userId) return;

    // Throttle connection attempts
    const now = Date.now();
    if (now - this.lastConnectionAttempt < this.MIN_CONNECTION_INTERVAL) {
      console.log(`WebSocket: Connection attempt throttled, last attempt was ${now - this.lastConnectionAttempt}ms ago`);
      return;
    }
    
    this.lastConnectionAttempt = now;
    this.isConnecting = true;
    this.connectionState = 'connecting';
    this.userId = userId;
    
    try {
      // Close existing connection if any
      this.closeConnection();
      
      // Create new WebSocket connection
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      console.log(`WebSocket: Connecting to ${wsUrl} for user ${userId} (client: ${this.clientId})`);
      
      this.socket = new WebSocket(wsUrl);
      
      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
      this.socket.onerror = this.handleError.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
    } catch (error) {
      console.error("WebSocket connection error:", error);
      this.handleClose();
    }
  }

  // Send a message through the WebSocket
  public send(data: any): boolean {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(data));
        return true;
      } catch (error) {
        console.error("Error sending WebSocket message:", error);
        // Queue important messages for resend
        if (data.type !== 'heartbeat' && data.type !== 'typing') {
          this.messageQueue.push(data);
        }
        // Attempt to reconnect on send failure
        this.handleClose();
        return false;
      }
    } else {
      // Queue important messages for later send
      if (data.type !== 'heartbeat' && data.type !== 'typing') {
        this.messageQueue.push(data);
        console.log(`Message queued for later delivery: ${data.type}`);
      }
      return false;
    }
  }
  
  // Send a heartbeat to keep the connection alive
  private sendHeartbeat(): void {
    if (this.isConnected()) {
      // Track the last time we sent a heartbeat
      const sentTime = Date.now();
      (this as any).lastHeartbeatSent = sentTime;
      
      // Send heartbeat to server
      const success = this.send({ 
        type: 'heartbeat', 
        timestamp: sentTime,
        clientId: this.clientId 
      });
      
      if (!success) {
        console.log('Failed to send heartbeat, connection may be unstable');
      }
      
      // If we don't get an acknowledgment within 10 seconds, consider connection stale
      setTimeout(() => {
        if ((this as any).lastHeartbeatSent === sentTime) {
          console.log('No heartbeat acknowledgment received within timeout window, connection may be stale');
          // Force reconnection
          this.handleClose();
        }
      }, 10000);
    }
  }

  // Add an event listener
  public on(type: string, callback: Function): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)?.push(callback);
  }

  // Remove an event listener
  public off(type: string, callback: Function): void {
    if (!this.listeners.has(type)) return;
    
    const callbacks = this.listeners.get(type) || [];
    const index = callbacks.indexOf(callback);
    
    if (index !== -1) {
      callbacks.splice(index, 1);
      this.listeners.set(type, callbacks);
    }
  }

  // Close the connection
  public disconnect(): void {
    this.closeConnection();
    this.userId = null;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  // Handle WebSocket open event
  private handleOpen(): void {
    this.isConnecting = false;
    this.connectionState = 'connected';
    console.log("WebSocket connection established");
    
    // Reset reconnect attempts on successful connection
    this.reconnectAttempts = 0;
    
    // Authenticate the WebSocket connection with clientId
    // Use a delay to ensure that the server is ready to receive messages
    setTimeout(() => {
      const authenticated = this.send({
        type: 'authenticate',
        userId: this.userId,
        clientId: this.clientId,
        timestamp: Date.now()
      });
      
      if (authenticated) {
        console.log(`WebSocket: Sent authentication for user ${this.userId} (client: ${this.clientId})`);
        this.connectionState = 'authenticated';
        
        // Send any queued messages once authenticated
        if (this.messageQueue.length > 0) {
          console.log(`Attempting to send ${this.messageQueue.length} queued messages`);
          
          const queueCopy = [...this.messageQueue];
          this.messageQueue = [];
          
          queueCopy.forEach(message => {
            if (!this.send(message)) {
              // If send fails, messages will be re-queued by the send method
              console.log(`Failed to send queued message of type: ${message.type}`);
            } else {
              console.log(`Successfully sent queued message of type: ${message.type}`);
            }
          });
        }
        
        // Setup heartbeat interval after authentication
        if (this.heartbeatInterval) {
          clearInterval(this.heartbeatInterval);
        }
        
        this.heartbeatInterval = window.setInterval(() => {
          this.sendHeartbeat();
        }, this.HEARTBEAT_INTERVAL);
        
      } else {
        console.error(`WebSocket: Failed to send authentication message, socket not ready`);
        // Force reconnection if we couldn't send authentication
        this.handleClose();
      }
    }, 100);
    
    // Trigger open event for listeners
    this.triggerEvent('open', {});
  }

  // Handle WebSocket close event
  private handleClose(event?: CloseEvent): void {
    this.isConnecting = false;
    this.connectionState = 'disconnected';
    
    // Check if this was a controlled close to avoid reconnection
    if (event && event.code === 1000 && event.reason === "New connection established") {
      console.log("WebSocket closed cleanly due to replacement connection");
      return;
    }
    
    console.log("WebSocket connection closed, reconnect attempt:", this.reconnectAttempts);
    
    // Increment reconnect attempts counter
    this.reconnectAttempts++;
    
    // Don't reconnect if we've exceeded max attempts
    if (this.reconnectAttempts > this.MAX_RECONNECT_ATTEMPTS) {
      console.log(`Maximum reconnection attempts (${this.MAX_RECONNECT_ATTEMPTS}) reached, stopping reconnection`);
      return;
    }
    
    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    // Exponential backoff with jitter
    const baseDelay = Math.min(10000, 1000 * Math.pow(2, this.reconnectAttempts));
    const jitter = Math.random() * 1000;
    const delay = baseDelay + jitter;
    
    console.log(`Scheduling reconnection in ${Math.round(delay/1000)} seconds`);
    
    this.reconnectTimeout = window.setTimeout(() => {
      if (this.userId) {
        this.connect(this.userId);
      }
    }, delay);
    
    // Trigger close event for listeners
    this.triggerEvent('close', {});
  }

  // Handle WebSocket error event
  private handleError(error: Event): void {
    console.error("WebSocket error:", error);
    
    // Trigger error event for listeners
    this.triggerEvent('error', { error });
    
    // Close connection on error
    if (this.socket) {
      this.socket.close();
    }
  }

  // Handle WebSocket message event
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      // Handle heartbeat acknowledgments internally
      if (data.type === 'heartbeat_ack') {
        // Clear the heartbeat timeout since we got an acknowledgment
        (this as any).lastHeartbeatSent = null;
        return; // Don't propagate heartbeat acks to application code
      }
      
      // Trigger message event for all listeners
      this.triggerEvent('message', data);
      
      // Trigger specific event type if available
      if (data.type) {
        this.triggerEvent(data.type, data.payload || data);
      }
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  }

  // Close the WebSocket connection
  private closeConnection(): void {
    // Clear heartbeat interval
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.socket) {
      this.socket.onclose = null; // Prevent handleClose from being called
      this.socket.close();
      this.socket = null;
    }
  }

  // Trigger an event for all listeners
  private triggerEvent(type: string, data: any): void {
    const callbacks = this.listeners.get(type) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in WebSocket '${type}' event handler:`, error);
      }
    });
  }
}

// Create and export a singleton instance
export const websocketClient = new WebSocketClient();
