import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../types';
import { db_service } from '../services/database';
import { realtimeService } from '../services/realtime';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

// Fixed user credentials in code (for initial setup)
const FIXED_USERS: User[] = [
  {
    id: 'admin-1',
    username: 'karem',
    password: 'ata121',
    role: 'admin',
    createdAt: new Date()
  },
  {
    id: 'admin-2',
    username: 'hesham',
    password: 'heshampop121',
    role: 'admin',
    createdAt: new Date()
  },
  {
    id: 'user-1',
    username: '3bdo',
    password: 'boda121',
    role: 'normal',
    createdAt: new Date()
  },
  {
    id: 'user-2',
    username: 'hesham',
    password: 'heshampop123',
    role: 'normal',
    createdAt: new Date()
  },
  {
    id: 'user-3',
    username: 'cover',
    password: 'cover123',
    role: 'normal',
    createdAt: new Date()
  }
];

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log('Initializing authentication...');
        
        // Initialize database service
        await db_service.init();
        
        // Check for stored user session
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            console.log('Found stored user:', parsedUser.username);
            
            // Verify user exists in database or fixed users list
            let dbUser = await db_service.getUserByUsername(parsedUser.username);
            
            if (!dbUser) {
              // Check fixed users and create in database if needed
              const fixedUser = FIXED_USERS.find(u => 
                u.username === parsedUser.username && 
                u.id === parsedUser.id && 
                u.password === parsedUser.password
              );
              
              if (fixedUser) {
                await db_service.createUser(fixedUser);
                dbUser = fixedUser;
              }
            }
            
            if (dbUser && dbUser.password === parsedUser.password) {
              setUser(parsedUser);
              realtimeService.connect(parsedUser);
              console.log('User session restored');
            } else {
              console.log('Stored user session invalid, clearing...');
              localStorage.removeItem('currentUser');
            }
          } catch (error) {
            console.error('Error parsing stored user:', error);
            localStorage.removeItem('currentUser');
          }
        }

        // Initialize default items if none exist
        await initializeDefaultItems();
        
        console.log('Authentication initialization complete');
      } catch (error) {
        console.error('Failed to initialize auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Cleanup on unmount
    return () => {
      realtimeService.disconnect();
    };
  }, []);

  const initializeDefaultItems = async () => {
    try {
      console.log('Checking for default items...');
      
      const storeItems = await db_service.getItemsBySection('store');
      if (storeItems.length === 0) {
        console.log('Creating default store items...');
        const defaultStoreItems = [
          {
            id: uuidv4(),
            name: 'Bottle of Water',
            sellPrice: 10,
            costPrice: 7,
            currentAmount: 100,
            section: 'store' as const,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: uuidv4(),
            name: 'Pepsi',
            sellPrice: 15,
            costPrice: 10,
            currentAmount: 50,
            section: 'store' as const,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: uuidv4(),
            name: 'Red Bull',
            sellPrice: 25,
            costPrice: 18,
            currentAmount: 30,
            section: 'store' as const,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ];

        for (const item of defaultStoreItems) {
          await db_service.saveItem(item);
        }
        console.log('Default store items created');
      }

      const supplementItems = await db_service.getItemsBySection('supplement');
      if (supplementItems.length === 0) {
        console.log('Creating default supplement items...');
        const defaultSupplementItems = [
          {
            id: uuidv4(),
            name: 'Protein Powder',
            sellPrice: 800,
            costPrice: 600,
            currentAmount: 10,
            section: 'supplement' as const,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: uuidv4(),
            name: 'Creatine',
            sellPrice: 300,
            costPrice: 200,
            currentAmount: 15,
            section: 'supplement' as const,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ];

        for (const item of defaultSupplementItems) {
          await db_service.saveItem(item);
        }
        console.log('Default supplement items created');
      }
    } catch (error) {
      console.error('Failed to initialize default items:', error);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    if (!username.trim() || !password.trim()) {
      console.log('Login failed: empty credentials');
      return false;
    }

    try {
      console.log('Attempting login for user:', username);
      
      // Check database first
      let dbUser = await db_service.getUserByUsername(username.trim());
      
      if (!dbUser) {
        // Check against fixed users list and create in database
        const fixedUser = FIXED_USERS.find(u => 
          u.username === username.trim() && u.password === password
        );
        
        if (fixedUser) {
          await db_service.createUser(fixedUser);
          dbUser = fixedUser;
        }
      }
      
      if (!dbUser || dbUser.password !== password) {
        console.log('Login failed: invalid credentials');
        return false;
      }
      
      // Create a clean user object for storage
      const userForStorage: User = {
        id: dbUser.id,
        username: dbUser.username,
        password: dbUser.password,
        role: dbUser.role,
        createdAt: dbUser.createdAt
      };
      
      setUser(userForStorage);
      localStorage.setItem('currentUser', JSON.stringify(userForStorage));
      realtimeService.connect(userForStorage);
      console.log('Login successful for user:', username);
      return true;
    } catch (error) {
      console.error('Login failed with error:', error);
      return false;
    }
  };

  const logout = () => {
    console.log('User logged out');
    realtimeService.disconnect();
    setUser(null);
    localStorage.removeItem('currentUser');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};