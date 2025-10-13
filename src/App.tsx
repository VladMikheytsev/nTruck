import React, { useState } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import LoginForm from './components/LoginForm';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import WarehouseManagement from './components/WarehouseManagement';
import TransferRequestForm from './components/TransferRequestForm';
import FleetManagement from './components/FleetManagement';
import UserManagement from './components/UserManagement';
import UserModeration from './components/UserModeration';
import WorkSchedule from './components/WorkSchedule';
import RouteManagement from './components/RouteManagement';
import Settings from './components/Settings';
import ErrorBoundary from './components/ErrorBoundary';

type PageType = 'dashboard' | 'requests' | 'routes' | 'schedule' | 'warehouses' | 'vehicles' | 'transfer-request' | 'fleet' | 'users' | 'moderation' | 'settings';

const AppContent: React.FC = () => {
  const { state } = useAppContext();
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard');

  if (!state.currentUser) {
    return <LoginForm />;
  }

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'requests':
      case 'transfer-request':
        return <TransferRequestForm />;
      case 'routes':
        return <RouteManagement />;
      case 'schedule':
        return <WorkSchedule />;
      case 'warehouses':
        return <WarehouseManagement />;
      case 'vehicles':
      case 'fleet':
        return <FleetManagement />;
      case 'users':
        return <UserManagement />;
      case 'moderation':
        return <UserModeration />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  const handlePageChange = (page: string) => {
    setCurrentPage(page as PageType);
  };

  return (
    <ErrorBoundary>
      <Layout currentPage={currentPage} onPageChange={handlePageChange}>
        <ErrorBoundary>
          {renderCurrentPage()}
        </ErrorBoundary>
      </Layout>
    </ErrorBoundary>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
