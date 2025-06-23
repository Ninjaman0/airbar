# AIR BAR - Store Inventory System

A modern inventory management system for gym bars and supplement stores with real-time synchronization.

## Features

- **Real-time Sync**: All users see the same data instantly across all devices
- **Dual Sections**: Separate management for BAR and Supplements
- **User Management**: Admin and normal user roles
- **Shift Management**: Track sales, expenses, and inventory per shift
- **Customer Management**: Handle customer purchases and debt tracking
- **Live Updates**: WebSocket-based real-time updates
- **Cloud Database**: Powered by Neon PostgreSQL

## Setup

### Prerequisites

1. **Neon Database**: Create a free account at [neon.tech](https://neon.tech)
2. **Node.js**: Version 18 or higher

### Environment Setup

1. Create a `.env` file in the root directory:
```env
VITE_DATABASE_URL=your_neon_database_connection_string
VITE_WS_URL=ws://localhost:3001
```

2. Get your Neon database URL:
   - Go to your Neon dashboard
   - Select your database
   - Copy the connection string from the "Connection Details" section

### Installation

1. Install dependencies:
```bash
npm install
```

2. Generate and run database migrations:
```bash
npm run db:generate
npm run db:migrate
```

3. Start the WebSocket server (for real-time features):
```bash
npm run ws-server
```

4. Start the development server:
```bash
npm run dev
```

## Default Users

The system comes with pre-configured users:

**Admins:**
- Username: `karem`, Password: `ata121`
- Username: `hesham`, Password: `heshampop121`

**Normal Users:**
- Username: `3bdo`, Password: `boda121`
- Username: `hesham`, Password: `heshampop123`
- Username: `cover`, Password: `cover123`

## Real-time Features

- **Live Inventory Updates**: Stock changes are reflected instantly across all connected users
- **Shift Synchronization**: Active shifts and sales are updated in real-time
- **Customer Management**: Customer purchases and payments sync immediately
- **Multi-user Support**: Multiple users can work simultaneously without conflicts

## Database Schema

The application uses PostgreSQL with the following main tables:
- `users` - User authentication and roles
- `items` - Inventory items for both sections
- `shifts` - Sales shifts and transactions
- `customers` - Customer information
- `customer_purchases` - Customer purchase history
- `expenses` - Shift expenses
- `supplies` - Inventory restocking records

## Deployment

The application can be deployed to any platform that supports:
- Node.js applications
- WebSocket connections
- Environment variables

Popular deployment options:
- Vercel (frontend) + Railway (WebSocket server)
- Netlify (frontend) + Heroku (WebSocket server)
- DigitalOcean App Platform (full-stack)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is proprietary software for AIR GYM BAR.