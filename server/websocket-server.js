const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const clients = new Map();

wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  ws.on('message', (data) => {
    try {
      const event = JSON.parse(data.toString());
      
      if (event.type === 'USER_JOINED') {
        clients.set(ws, event.data.user);
        console.log(`User ${event.data.user.username} joined`);
        
        // Broadcast to all other clients
        broadcast(event, ws);
      } else if (event.type === 'USER_LEFT') {
        const user = clients.get(ws);
        if (user) {
          console.log(`User ${user.username} left`);
          clients.delete(ws);
        }
      } else {
        // Broadcast all other events to all clients
        broadcast(event, ws);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    const user = clients.get(ws);
    if (user) {
      console.log(`User ${user.username} disconnected`);
      clients.delete(ws);
      
      // Broadcast user left event
      broadcast({
        type: 'USER_LEFT',
        data: { user },
        timestamp: Date.now()
      }, ws);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

function broadcast(event, sender) {
  const message = JSON.stringify(event);
  
  wss.clients.forEach((client) => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('WebSocket server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('WebSocket server closed');
    process.exit(0);
  });
});