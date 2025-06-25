import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const server = createServer();
const wss = new WebSocketServer({ server });

const clients = new Map();

wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('Received message:', message.type);
      
      if (message.type === 'USER_JOINED') {
        clients.set(ws, message.data.user);
        console.log(`User ${message.data.user.username} joined`);
      }
      
      // Broadcast to all connected clients except sender
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === client.OPEN) {
          client.send(data.toString());
        }
      });
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  });
  
  ws.on('close', () => {
    const user = clients.get(ws);
    if (user) {
      console.log(`User ${user.username} disconnected`);
      clients.delete(ws);
    }
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});