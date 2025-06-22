import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { db } from '../services/database';

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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await db.init();
        
        // Check for stored user session
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }

        // Create default admin user if none exists
        const adminUser = await db.getUserByUsername('admin');
        if (!adminUser) {
          const defaultAdmin: User = {
            id: 'admin-1',
            username: 'admin',
            role: 'admin',
            createdAt: new Date()
          };
          await db.createUser(defaultAdmin);
        }

        // Create default normal user if none exists
        const normalUser = await db.getUserByUsername('user');
        if (!normalUser) {
          const defaultUser: User = {
            id: 'user-1',
            username: 'user',
            role: 'normal',
            createdAt: new Date()
          };
          await db.createUser(defaultUser);
        }

        // Initialize default items if none exist
        await initializeDefaultItems();
      } catch (error) {
        console.error('Failed to initialize auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const initializeDefaultItems = async () => {
    const storeItems = await db.getItemsBySection('store');
    if (storeItems.length === 0) {
      const defaultStoreItems = [
        {
          id: 'store-water',
          name: 'Bottle of Water',
          sellPrice: 10,
          costPrice: 7,
          currentAmount: 100,
          section: 'store' as const,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'store-pepsi',
          name: 'Pepsi',
          sellPrice: 15,
          costPrice: 10,
          currentAmount: 50,
          section: 'store' as const,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'store-redbull',
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
        await db.saveItem(item);
      }
    }

    const supplementItems = await db.getItemsBySection('supplement');
    if (supplementItems.length === 0) {
      const defaultSupplementItems = [
        {
          id: 'supp-protein',
          name: 'Protein Powder',
          sellPrice: 800,
          costPrice: 600,
          currentAmount: 10,
          section: 'supplement' as const,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'supp-creatine',
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
        await db.saveItem(item);
      }
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      // Simple password check (in production, use proper authentication)
      const validCredentials = [
        { username: 'admin', password: 'admin123' },
        { username: 'user', password: 'user123' }
      ];

      const credential = validCredentials.find(c => c.username === username && c.password === password);
      if (!credential) return false;

      const user = await db.getUserByUsername(username);
      if (user) {
        setUser(user);
        localStorage.setItem('currentUser', JSON.stringify(user));
        return true;
      }

      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};
