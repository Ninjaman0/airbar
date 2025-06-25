import { migrate } from 'drizzle-orm/neon-http/migrator';
import { db } from './index';

async function runMigrations() {
  console.log('Running migrations...');
  
  try {
    await migrate(db, {
      migrationsFolder: './src/lib/db/migrations',
    });
    console.log('Migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
