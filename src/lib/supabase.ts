import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase: any = null;
let isSupabaseAvailable = false;

// Initialize Supabase client with error handling
if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
      auth: {
        persistSession: false, // We handle our own session management
      },
    });
  } catch (error) {
    console.warn('Failed to initialize Supabase client:', error);
    supabase = null;
  }
} else {
  console.warn('Missing Supabase environment variables. Running in offline mode.');
}

// Test connection function with timeout and error handling
export const testSupabaseConnection = async (): Promise<boolean> => {
  if (!supabase) {
    console.log('Supabase client not available - running in offline mode');
    return false;
  }

  try {
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), 5000)
    );

    const connectionPromise = supabase.from('users').select('count').limit(1);
    
    const { data, error } = await Promise.race([connectionPromise, timeoutPromise]);
    
    if (error) {
      console.warn('Supabase connection test failed:', error.message);
      isSupabaseAvailable = false;
      return false;
    }
    
    console.log('Supabase connection successful');
    isSupabaseAvailable = true;
    return true;
  } catch (error) {
    console.warn('Supabase connection error:', error instanceof Error ? error.message : 'Unknown error');
    isSupabaseAvailable = false;
    return false;
  }
};

// Export supabase client and availability status
export { supabase, isSupabaseAvailable };