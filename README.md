# AIR BAR - Store Inventory System

A modern inventory management system for gym bars and supplement stores with real-time synchronization powered by Supabase.

## Features

- **Real-time Sync**: All users see the same data instantly across all devices using Supabase real-time
- **Dual Sections**: Separate management for BAR and Supplements
- **User Management**: Admin and normal user roles
- **Shift Management**: Track sales, expenses, and inventory per shift
- **Customer Management**: Handle customer purchases and debt tracking
- **Live Updates**: Supabase real-time + WebSocket-based real-time updates
- **Cloud Database**: Powered by Supabase PostgreSQL

## Setup

### Prerequisites

1. **Supabase Project**: Create a free account at [supabase.com](https://supabase.com)
2. **Node.js**: Version 18 or higher

### Environment Setup

1. Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_WS_URL=ws://localhost:3001
```

2. Get your Supabase credentials:
   - Go to your Supabase dashboard
   - Navigate to Settings > API
   - Copy the Project URL and anon/public key

### Database Setup

1. In your Supabase dashboard, go to the SQL Editor
2. Run the migration script from `supabase/migrations/20250625051918_mellow_lodge.sql`
3. This will create all necessary tables and constraints

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the WebSocket server (for additional real-time features):
```bash
npm run ws-server
```

3. Start the development server:
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

- **Supabase Real-time**: Database changes are reflected instantly across all connected users
- **Live Inventory Updates**: Stock changes are reflected instantly across all connected users
- **Shift Synchronization**: Active shifts and sales are updated in real-time
- **Customer Management**: Customer purchases and payments sync immediately
- **Multi-user Support**: Multiple users can work simultaneously without conflicts

## Database Schema

The application uses Supabase PostgreSQL with the following main tables:
- `users` - User authentication and roles
- `items` - Inventory items for both sections
- `shifts` - Sales shifts and transactions
- `customers` - Customer information
- `customer_purchases` - Customer purchase history
- `expenses` - Shift expenses
- `supplies` - Inventory restocking records
- `categories` - Item categories
- `admin_logs` - Admin action logging
- `shift_edits` - Shift modification history
- `supplement_debt` - Debt tracking for supplements
- `settings` - Application settings

## Deployment

The application can be deployed to any platform that supports:
- Node.js applications
- WebSocket connections (optional)
- Environment variables

Popular deployment options:
- Vercel (frontend) + Railway (WebSocket server)
- Netlify (frontend) + Heroku (WebSocket server)
- DigitalOcean App Platform (full-stack)

## Real-time Architecture

The application uses a dual real-time approach:
1. **Supabase Real-time**: For database changes and core functionality
2. **WebSocket Server**: For additional real-time features and user presence

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is proprietary software for AIR GYM BAR.