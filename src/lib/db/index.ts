import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

// Fallback database URL if environment variable is not available
const DATABASE_URL = import.meta.env.VITE_DATABASE_URL || 
  'postgresql://neondb_owner:npg_aU1g8CPomNDw@ep-old-field-a58z6veh-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require';

const sql = neon(DATABASE_URL);
export const db = drizzle(sql, { schema });

export * from './schema';