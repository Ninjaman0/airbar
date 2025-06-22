import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginForm from './components/LoginForm';
import Layout from './components/Layout';
import NormalUserView from './components/NormalUserView';
import AdminView from './components/AdminView';

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentSection, setCurrentSection] = useState<'store' | 'supplement'>('store');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return (
    <Layout currentSection={currentSection} onSectionChange={setCurrentSection}>
      {user.role === 'admin' ? (
        <AdminView section={currentSection} />
      ) : (
        <NormalUserView section={currentSection} />
      )}
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
