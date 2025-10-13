import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { 
  Home,
  FileText,
  Map,
  Users,
  Truck,
  Building2,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  UserCheck
} from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onPageChange }) => {
  const { state, dispatch } = useAppContext();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Home,
      description: 'Обзор заявок и маршрутов',
      roles: ['admin', 'warehouse_employee', 'driver']
    },
    {
      id: 'requests',
      label: 'Заявки на перемещение',
      icon: FileText,
      description: 'Управление заявками на перевозку',
      roles: ['admin', 'warehouse_employee']
    },
    {
      id: 'routes',
      label: 'Маршруты',
      icon: Map,
      description: 'Создание и управление маршрутами',
      roles: ['admin']
    },
    {
      id: 'schedule',
      label: 'График работ',
      icon: Users,
      description: 'Назначение водителей на маршруты',
      roles: ['admin']
    },
    {
      id: 'warehouses',
      label: 'Склады',
      icon: Building2,
      description: 'Управление складами',
      roles: ['admin']
    },
    {
      id: 'vehicles',
      label: 'Транспорт',
      icon: Truck,
      description: 'Управление автопарком',
      roles: ['admin']
    },
    {
      id: 'moderation',
      label: 'Модерация',
      icon: UserCheck,
      description: 'Управление пользователями системы',
      roles: ['admin']
    }
  ];

  // Фильтруем пункты меню по ролям пользователя
  const availableMenuItems = menuItems.filter(item => 
    item.roles.includes(state.currentUser?.role || '')
  );

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleMobileMenu = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={toggleMobileMenu}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md border border-gray-200"
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={toggleMobileMenu}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed left-0 top-0 h-full bg-white border-r border-gray-200 shadow-lg z-40 transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-16' : 'w-64'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          {!isCollapsed && (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Truck className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">NTruck</h1>
                <p className="text-xs text-gray-500">Logistics System</p>
              </div>
            </div>
          )}
          
          {/* Collapse Button - Desktop Only */}
          <button
            onClick={toggleCollapse}
            className="hidden lg:flex p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            title={isCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronLeft className="h-4 w-4 text-gray-500" />
            )}
          </button>
        </div>

        {/* User Info */}
        {state.currentUser && (
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-gray-700">
                  {state.currentUser.firstName[0]}{state.currentUser.lastName[0]}
                </span>
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {state.currentUser.firstName} {state.currentUser.lastName}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {state.currentUser.role}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {availableMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              
              return (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      onPageChange(item.id);
                      setIsMobileOpen(false); // Close mobile menu on navigation
                    }}
                    className={`
                      w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200
                      ${isActive 
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600' 
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                    title={isCollapsed ? item.label : ''}
                  >
                    <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                    {!isCollapsed && (
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{item.label}</span>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {item.description}
                        </p>
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          {/* Settings */}
          <button
            onClick={() => onPageChange('settings')}
            className={`
              w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-left transition-colors mb-2
              ${currentPage === 'settings' 
                ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600' 
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }
            `}
            title={isCollapsed ? 'Настройки' : ''}
          >
            <Settings className={`h-5 w-5 flex-shrink-0 ${
              currentPage === 'settings' ? 'text-primary-600' : 'text-gray-500'
            }`} />
            {!isCollapsed && <span className="font-medium">Настройки</span>}
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className={`
              w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-left transition-colors
              text-red-700 hover:bg-red-50 hover:text-red-800
            `}
            title={isCollapsed ? 'Выйти' : ''}
          >
            <LogOut className="h-5 w-5 flex-shrink-0 text-red-500" />
            {!isCollapsed && <span className="font-medium">Выйти</span>}
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
