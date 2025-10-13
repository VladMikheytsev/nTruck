import React from 'react';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onPageChange: (page: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentPage, onPageChange }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <Sidebar currentPage={currentPage} onPageChange={onPageChange} />
      
      {/* Main Content */}
      <div className="flex-1 lg:ml-64 transition-all duration-300">
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
