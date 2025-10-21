import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { useGoogleMaps } from '../hooks/useGoogleMaps';
import { useDriverGPSStatus } from '../hooks/useDriverGPSStatus';
import { TransferRequest, TransferStatus, Vehicle, StatusChangeLog } from '../types';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Package, 
  ArrowRight,
  Filter,
  Search,
  Map,
  Calendar as CalendarIcon,
  User as UserIcon,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Truck,
  Edit,
  Trash2,
  Play,
  Plus,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import DatabaseManager from './DatabaseManager';
import { Trak4GPSService, VehicleGPSData } from '../services/trak4GPSService';
import { ActualRouteTrackingService, ActualRouteProgress } from '../services/actualRouteTrackingService';
// RouteTrackingStatus убран - используем только RouteGPSTracking
import { TrackingDiagnostics } from '../utils/trackingDiagnostics';
import { RouteProgressTrackingService } from '../services/routeProgressTrackingService';
import { RouteProgress } from '../types';
import WarehouseIcon from './WarehouseIcon';

const Dashboard: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [activeTab, setActiveTab] = useState<'requests' | 'routes' | 'sender-groups' | 'receiver-groups' | 'requests-list'>('requests');

  // Initialize actual route tracking service
  useEffect(() => {
    // Инициализируем сервис без автоматического запуска
    console.log('🚀 Инициализация ActualRouteTrackingService (без автозапуска)');
    
    // Cleanup on unmount
    return () => {
      ActualRouteTrackingService.stopAllTracking();
    };
  }, []);
  const [statusFilter, setStatusFilter] = useState<TransferStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingRequest, setEditingRequest] = useState<TransferRequest | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDateForFilter, setSelectedDateForFilter] = useState<Date | null>(new Date()); // По умолчанию сегодняшняя дата
  const [routeProgresses, setRouteProgresses] = useState<Record<string, RouteProgress>>({});


  // Load all active route progresses
  const loadAllRouteProgresses = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    const drivers = state.users.filter(user => user.role === 'driver');
    const newProgresses: Record<string, RouteProgress> = {};
    
    drivers.forEach(driver => {
      state.routes.forEach(route => {
        const progressKey = `${route.id}-${driver.id}-${today}`;
        const progress = RouteProgressTrackingService.loadRouteProgress(route.id, driver.id, today);
        if (progress) {
          newProgresses[progressKey] = progress;
        }
      });
    });
    
    setRouteProgresses(newProgresses);
  }, [state.routes, state.users]);


  // Load forecasts for all active routes (ОТКЛЮЧЕНО для избежания ошибок Google Maps)
  useEffect(() => {
    if (activeTab === 'routes') {
      console.log('ℹ️ Traffic forecast загрузка отключена для избежания ошибок Google Maps');
      
      // Load route progresses
      loadAllRouteProgresses();
    }
  }, [activeTab, state.routes, loadAllRouteProgresses]);

  // Keyboard navigation for date selection
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    // Only handle keyboard shortcuts when on requests tab and not typing in inputs
    if (activeTab !== 'requests' || 
        event.target instanceof HTMLInputElement || 
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement) {
      return;
    }

    if (event.key === 'ArrowLeft' && selectedDateForFilter) {
      event.preventDefault();
      const prevDay = new Date(selectedDateForFilter);
      prevDay.setDate(prevDay.getDate() - 1);
      setSelectedDateForFilter(prevDay);
    } else if (event.key === 'ArrowRight' && selectedDateForFilter) {
      event.preventDefault();
      const nextDay = new Date(selectedDateForFilter);
      nextDay.setDate(nextDay.getDate() + 1);
      setSelectedDateForFilter(nextDay);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setSelectedDateForFilter(new Date()); // Today
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setSelectedDateForFilter(null); // Clear filter
    }
  }, [activeTab, selectedDateForFilter]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);

  const statusConfig = {
    created: { 
      label: 'Создана', 
      color: 'bg-blue-100 text-blue-800', 
      icon: FileText 
    },
    in_progress: { 
      label: 'В процессе', 
      color: 'bg-yellow-100 text-yellow-800', 
      icon: Clock 
    },
    received_by_driver: { 
      label: 'Получено водителем', 
      color: 'bg-purple-100 text-purple-800', 
      icon: Package 
    },
    delivered_to_warehouse: { 
      label: 'Передано на склад', 
      color: 'bg-indigo-100 text-indigo-800', 
      icon: CheckCircle 
    },
    completed: { 
      label: 'Завершена', 
      color: 'bg-green-100 text-green-800', 
      icon: CheckCircle 
    },
    cancelled: { 
      label: 'Отменена', 
      color: 'bg-red-100 text-red-800', 
      icon: XCircle 
    },
  };

  const getWarehouseName = (warehouseId: string) => {
    return state.warehouses.find(w => w.id === warehouseId)?.name || 'Неизвестный склад';
  };

  const handleEditRequest = (request: TransferRequest) => {
    setEditingRequest(request);
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setEditingRequest(null);
    setShowEditModal(false);
  };

  const filteredRequests = state.transferRequests.filter(request => {
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    const matchesSearch = searchTerm === '' || 
      getWarehouseName(request.sourceWarehouse).toLowerCase().includes(searchTerm.toLowerCase()) ||
      getWarehouseName(request.destinationWarehouse).toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.items.some(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Filter by selected date if specified
    const matchesDate = !selectedDateForFilter || 
      format(new Date(request.deadline), 'yyyy-MM-dd') === format(selectedDateForFilter, 'yyyy-MM-dd');
    
    // Driver-specific filtering
    const isDriver = state.currentUser?.role === 'driver';
    if (isDriver) {
      // Водители видят только заявки по своему маршруту
      const driverId = state.currentUser?.id;
      
      // Проверяем, назначен ли водитель на заявку
      const isAssignedToRequest = request.assignedDriverId === driverId;
      
      // Проверяем, есть ли у водителя маршрут на сегодня
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      const day = today.getDate();
      
      const driverSchedule = state.workSchedules.find(ws => 
        ws.driverId === driverId && 
        ws.year === year && 
        ws.month === month
      );
      
      const todayRouteId = driverSchedule?.schedule[day];
      const todayRoute = todayRouteId ? state.routes.find(r => r.id === todayRouteId) : null;
      
      // Проверяем, входит ли склад отправителя в маршрут водителя
      const isWarehouseInRoute = todayRoute?.stops.some(stop => 
        stop.warehouseId === request.sourceWarehouse
      ) || false;
      
      // Водитель видит заявку если:
      // 1. Он назначен на заявку ИЛИ
      // 2. Склад отправителя входит в его маршрут на сегодня
      const driverFilter = isAssignedToRequest || isWarehouseInRoute;
      
      // Скрываем заявки в статусе "Создано"
      const statusFilter = request.status !== 'created';
      
      return matchesStatus && matchesSearch && matchesDate && driverFilter && statusFilter;
    }
    
    return matchesStatus && matchesSearch && matchesDate;
  }).sort((a, b) => {
    // Сортировка по времени создания (новые сначала)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Group filtered requests by date
  const groupRequestsByDate = () => {
    const grouped: { [date: string]: TransferRequest[] } = {};
    
    filteredRequests.forEach(request => {
      const dateKey = format(new Date(request.deadline), 'yyyy-MM-dd');
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(request);
    });
    
    // Sort dates in descending order (newest first)
    const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
    const sortedGrouped: { [date: string]: TransferRequest[] } = {};
    
    sortedDates.forEach(date => {
      sortedGrouped[date] = grouped[date];
    });
    
    return sortedGrouped;
  };

  const groupedRequestsByDate = groupRequestsByDate();

  const statusCounts = {
    all: state.transferRequests.length,
    created: state.transferRequests.filter(r => r.status === 'created').length,
    in_progress: state.transferRequests.filter(r => r.status === 'in_progress').length,
    received_by_driver: state.transferRequests.filter(r => r.status === 'received_by_driver').length,
    delivered_to_warehouse: state.transferRequests.filter(r => r.status === 'delivered_to_warehouse').length,
    completed: state.transferRequests.filter(r => r.status === 'completed').length,
    cancelled: state.transferRequests.filter(r => r.status === 'cancelled').length,
  };

  const isDeadlineApproaching = (request: TransferRequest) => {
    // Only check approaching for 'created' or 'in_progress' status
    // Заявки в статусе 'received_by_driver' и 'delivered_to_warehouse' не отменяются автоматически
    if (request.status !== 'created' && request.status !== 'in_progress') {
      return false;
    }

    const now = new Date();
    
    // If request has departure time from route, use it; otherwise use deadline
    if (request.sourceDepartureTime && request.deadline) {
      const deadlineDate = new Date(request.deadline);
      const [depHour, depMinute] = request.sourceDepartureTime.split(':').map(Number);
      const departureDateTime = new Date(deadlineDate);
      departureDateTime.setHours(depHour, depMinute, 0, 0);
      
      const timeDiff = departureDateTime.getTime() - now.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      return hoursDiff <= 2 && hoursDiff > 0; // Approaching if within 2 hours
    }

    // Fallback to original deadline logic
    const deadlineDate = new Date(request.deadline);
    const timeDiff = deadlineDate.getTime() - now.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    return daysDiff <= 1 && daysDiff >= 0;
  };

  const isOverdue = (request: TransferRequest) => {
    // Only check overdue for 'created' or 'in_progress' status
    // Заявки в статусе 'received_by_driver' и 'delivered_to_warehouse' не отменяются автоматически
    if (request.status !== 'created' && request.status !== 'in_progress') {
      return false;
    }

    // If request has departure time from route, use it; otherwise use deadline
    if (request.sourceDepartureTime && request.deadline) {
      const deadlineDate = new Date(request.deadline);
      const [depHour, depMinute] = request.sourceDepartureTime.split(':').map(Number);
      const departureDateTime = new Date(deadlineDate);
      departureDateTime.setHours(depHour, depMinute, 0, 0);
      
      return new Date() > departureDateTime;
    }

    // Fallback to original deadline logic
    const deadlineDate = new Date(request.deadline);
    return new Date() > deadlineDate;
  };

  return (
    <div className="space-y-6">
      {/* KPI summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Всего заявок</p>
              <p className="text-2xl font-semibold text-gray-900">{statusCounts.all}</p>
            </div>
            <FileText className="h-6 w-6 text-gray-400" />
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">В процессе</p>
              <p className="text-2xl font-semibold text-yellow-700">{statusCounts.in_progress}</p>
            </div>
            <Clock className="h-6 w-6 text-yellow-600" />
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Завершено</p>
              <p className="text-2xl font-semibold text-green-700">{statusCounts.completed}</p>
            </div>
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Отменено</p>
              <p className="text-2xl font-semibold text-red-700">{statusCounts.cancelled}</p>
            </div>
            <XCircle className="h-6 w-6 text-red-600" />
          </div>
        </div>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {state.currentUser?.role === 'driver' ? 'Мои заявки' : 'Dashboard'}
        </h1>
        <p className="text-gray-600 mt-1">
          {state.currentUser?.role === 'driver' 
            ? 'Заявки по вашему маршруту на сегодня' 
            : 'Обзор системы управления складскими операциями'
          }
        </p>
        {/* Quick system counters */}
        {state.currentUser?.role !== 'driver' && (
          <div className="mt-3 flex items-center space-x-4 text-sm text-gray-600">
            <span className="flex items-center"><Truck className="h-4 w-4 mr-1" /> {state.vehicles?.length || 0} авто</span>
            <span className="flex items-center"><Building2 className="h-4 w-4 mr-1" /> {state.warehouses?.length || 0} складов</span>
            <span className="flex items-center"><TrendingUp className="h-4 w-4 mr-1" /> {state.routes?.length || 0} маршрутов</span>
          </div>
        )}
      </div>

      {/* Tabs - скрыты для водителей */}
      {state.currentUser?.role !== 'driver' && (
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            <button
              onClick={() => setActiveTab('requests')}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'requests'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Заявки на перемещение
            </button>
            <button
              onClick={() => setActiveTab('routes')}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'routes'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Маршруты
            </button>
            <button
              onClick={() => setActiveTab('sender-groups')}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'sender-groups'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              По складу отправителя
            </button>
            <button
              onClick={() => setActiveTab('receiver-groups')}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'receiver-groups'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              По складу получателя
            </button>
            <button
              onClick={() => setActiveTab('requests-list')}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'requests-list'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Список заявок
            </button>
          </nav>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'requests' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div 
          className={`card p-4 cursor-pointer transition-colors ${
            statusFilter === 'all' ? 'ring-2 ring-primary-500' : 'hover:bg-gray-50'
          }`}
          onClick={() => setStatusFilter('all')}
        >
          <div className="flex items-center">
            <FileText className="h-5 w-5 text-gray-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Всего заявок</p>
              <p className="text-lg font-semibold text-gray-900">{statusCounts.all}</p>
            </div>
          </div>
        </div>

        {Object.entries(statusConfig).map(([status, config]) => {
          const Icon = config.icon;
          return (
            <div
              key={status}
              className={`card p-4 cursor-pointer transition-colors ${
                statusFilter === status ? 'ring-2 ring-primary-500' : 'hover:bg-gray-50'
              }`}
              onClick={() => setStatusFilter(status as TransferStatus)}
            >
              <div className="flex items-center">
                <Icon className="h-5 w-5 text-gray-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">{config.label}</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {statusCounts[status as keyof typeof statusCounts]}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по складам или товарам..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <CalendarIcon className="h-4 w-4 text-gray-500" />
          
          {/* Navigation buttons */}
          <button
            onClick={() => {
              if (selectedDateForFilter) {
                const prevDay = new Date(selectedDateForFilter);
                prevDay.setDate(prevDay.getDate() - 1);
                setSelectedDateForFilter(prevDay);
              }
            }}
            className="p-1 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-800"
            title="Предыдущий день"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          
          {/* Date input */}
          <input
            type="date"
            value={selectedDateForFilter ? format(selectedDateForFilter, 'yyyy-MM-dd') : ''}
            onChange={(e) => {
              if (e.target.value) {
                setSelectedDateForFilter(new Date(e.target.value));
              } else {
                setSelectedDateForFilter(new Date()); // Reset to today if cleared
              }
            }}
            className="input w-auto min-w-[140px]"
          />
          
          <button
            onClick={() => {
              if (selectedDateForFilter) {
                const nextDay = new Date(selectedDateForFilter);
                nextDay.setDate(nextDay.getDate() + 1);
                setSelectedDateForFilter(nextDay);
              }
            }}
            className="p-1 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-800"
            title="Следующий день"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          
          {/* Quick date buttons */}
          <div className="flex items-center space-x-1 ml-2 border-l border-gray-200 pl-2">
            <button
              onClick={() => {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                setSelectedDateForFilter(yesterday);
              }}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                selectedDateForFilter && format(selectedDateForFilter, 'yyyy-MM-dd') === format(new Date(Date.now() - 24*60*60*1000), 'yyyy-MM-dd')
                  ? 'bg-primary-100 text-primary-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
              }`}
            >
              Вчера
            </button>
            <button
              onClick={() => setSelectedDateForFilter(new Date())}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                selectedDateForFilter && format(selectedDateForFilter, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                  ? 'bg-primary-100 text-primary-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
              }`}
            >
              Сегодня
            </button>
            <button
              onClick={() => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                setSelectedDateForFilter(tomorrow);
              }}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                selectedDateForFilter && format(selectedDateForFilter, 'yyyy-MM-dd') === format(new Date(Date.now() + 24*60*60*1000), 'yyyy-MM-dd')
                  ? 'bg-primary-100 text-primary-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
              }`}
            >
              Завтра
            </button>
          </div>
          
          {/* Clear button */}
          <button
            onClick={() => setSelectedDateForFilter(null)}
            className="text-gray-400 hover:text-gray-600 ml-2"
            title="Показать все даты (Esc)"
          >
            ✕
          </button>
          
          {/* Keyboard shortcuts hint */}
          <div className="text-xs text-gray-400 ml-2 hidden lg:block">
            ← → для навигации, Home для сегодня
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TransferStatus | 'all')}
            className="input w-auto"
          >
            <option value="all">Все статусы</option>
            {Object.entries(statusConfig).map(([status, config]) => (
              <option key={status} value={status}>
                {config.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected Date Info */}
      {selectedDateForFilter && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CalendarIcon className="h-5 w-5 text-primary-600" />
              <span className="text-primary-800 font-medium">
                Заявки на {format(selectedDateForFilter, 'dd MMMM yyyy', { locale: ru })}
              </span>
              <span className="text-primary-600 text-sm">
                ({format(selectedDateForFilter, 'EEEE', { locale: ru })})
              </span>
            </div>
            <span className="bg-primary-100 text-primary-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
              {filteredRequests.length} {filteredRequests.length === 1 ? 'заявка' : filteredRequests.length < 5 ? 'заявки' : 'заявок'}
            </span>
          </div>
        </div>
      )}

      {/* Transfer Requests List */}
      <div className="space-y-6">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {selectedDateForFilter 
                ? `Нет заявок на ${format(selectedDateForFilter, 'dd.MM.yyyy', { locale: ru })}`
                : statusFilter === 'all' ? 'Нет заявок' : `Нет заявок со статусом "${statusConfig[statusFilter as TransferStatus]?.label}"`
              }
            </h3>
            <p className="text-gray-500">
              {state.currentUser?.role === 'warehouse_employee' 
                ? 'Создайте первую заявку на перемещение'
                : 'Заявки будут отображаться здесь после их создания'
              }
            </p>
          </div>
        ) : selectedDateForFilter ? (
          // Show requests for selected date in grid layout
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
            {filteredRequests.map((request) => (
            <TransferRequestCard 
              key={request.id} 
              request={request}
              getWarehouseName={getWarehouseName}
              statusConfig={statusConfig}
              isDeadlineApproaching={isDeadlineApproaching}
              isOverdue={isOverdue}
              state={state}
              dispatch={dispatch}
              currentUser={state.currentUser}
              onEditRequest={handleEditRequest}
                isCompact={true}
            />
            ))}
          </div>
        ) : (
          // Show requests grouped by date when no specific date is selected
          Object.entries(groupedRequestsByDate).map(([dateKey, requests]) => (
            <div key={dateKey} className="space-y-4">
              {/* Date Header */}
              <div className="flex items-center space-x-3 py-2 border-b border-gray-200">
                <CalendarIcon className="h-5 w-5 text-primary-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  {format(new Date(dateKey), 'dd MMMM yyyy', { locale: ru })}
                </h3>
                <span className="bg-primary-100 text-primary-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
                  {requests.length} {requests.length === 1 ? 'заявка' : requests.length < 5 ? 'заявки' : 'заявок'}
                </span>
              </div>
              
              {/* Requests for this date in grid layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4 pl-8">
                {requests.map((request) => (
                  <TransferRequestCard 
                    key={request.id} 
                    request={request}
                    getWarehouseName={getWarehouseName}
                    statusConfig={statusConfig}
                    isDeadlineApproaching={isDeadlineApproaching}
                    isOverdue={isOverdue}
                    state={state}
                    dispatch={dispatch}
                    currentUser={state.currentUser}
                    onEditRequest={handleEditRequest}
                    isCompact={true}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
        </>
      )}

      {/* Routes Tab */}
      {activeTab === 'routes' && (
            <DailyRoutesView 
              routeProgresses={routeProgresses}
              dispatch={dispatch}
            />
      )}

      {/* Sender Groups Tab */}
      {activeTab === 'sender-groups' && (
        <WarehouseGroupsView groupBy="sender" />
      )}

      {/* Receiver Groups Tab */}
      {activeTab === 'receiver-groups' && (
        <WarehouseGroupsView groupBy="receiver" />
      )}

      {/* Requests List Tab */}
      {activeTab === 'requests-list' && (
        <RequestsListView />
      )}

      {/* Database Management for Admins */}
      {state.currentUser?.role === 'admin' && (
        <div className="card p-6">
          <DatabaseManager />
        </div>
      )}

      {/* Edit Request Modal */}
      {showEditModal && editingRequest && (
        <EditRequestModal
          request={editingRequest}
          state={state}
          dispatch={dispatch}
          onClose={handleCloseEditModal}
        />
      )}
    </div>
  );
};

interface TransferRequestCardProps {
  request: TransferRequest;
  getWarehouseName: (id: string) => string;
  statusConfig: any;
  isDeadlineApproaching: (request: TransferRequest) => boolean;
  isOverdue: (request: TransferRequest) => boolean;
  state: any;
  dispatch: any;
  currentUser: any;
  onEditRequest: (request: TransferRequest) => void;
  isCompact?: boolean;
}

const TransferRequestCard: React.FC<TransferRequestCardProps> = ({
  request,
  getWarehouseName,
  statusConfig,
  isDeadlineApproaching,
  isOverdue,
  state,
  dispatch,
  currentUser,
  onEditRequest,
  isCompact = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const config = statusConfig[request.status];
  const Icon = config.icon;

  // GPS статус для водителей
  const gpsStatus = useDriverGPSStatus(
    currentUser?.role === 'driver' ? request : null,
    30000 // Обновляем каждые 30 секунд
  );

  const deadlineWarning = isOverdue(request) ? 'overdue' : 
                         isDeadlineApproaching(request) ? 'approaching' : null;

  // Admin actions
  const handleEditRequestLocal = () => {
    onEditRequest(request);
  };

  const handleDeleteRequest = () => {
    if (window.confirm('Вы уверены, что хотите удалить эту заявку?')) {
      dispatch({ type: 'DELETE_TRANSFER_REQUEST', payload: request.id });
    }
  };

  const handleStartWork = () => {
    const oldStatus = request.status;
    const newStatus = 'in_progress' as TransferStatus;
    
    const statusChangeEntry: StatusChangeLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      requestId: request.id,
      oldStatus: oldStatus,
      newStatus: newStatus,
      changedBy: currentUser.id,
      changedAt: new Date(),
    };

    const updatedRequest = {
      ...request,
      status: newStatus,
      updatedBy: currentUser.id,
      updatedAt: new Date(),
      statusChangeLog: [
        ...(request.statusChangeLog || []),
        statusChangeEntry
      ],
    };
    dispatch({ type: 'UPDATE_TRANSFER_REQUEST', payload: updatedRequest });
  };

  const handleMarkAsReceived = () => {
    const oldStatus = request.status;
    const newStatus = 'received_by_driver' as TransferStatus;
    
    const statusChangeEntry: StatusChangeLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      requestId: request.id,
      oldStatus: oldStatus,
      newStatus: newStatus,
      changedBy: currentUser.id,
      changedAt: new Date(),
    };

    const updatedRequest = {
      ...request,
      status: newStatus,
      updatedBy: currentUser.id,
      updatedAt: new Date(),
      statusChangeLog: [
        ...(request.statusChangeLog || []),
        statusChangeEntry
      ],
    };
    dispatch({ type: 'UPDATE_TRANSFER_REQUEST', payload: updatedRequest });
  };

  const handleMarkAsDelivered = () => {
    const oldStatus = request.status;
    const newStatus = 'delivered_to_warehouse' as TransferStatus;
    
    const statusChangeEntry: StatusChangeLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      requestId: request.id,
      oldStatus: oldStatus,
      newStatus: newStatus,
      changedBy: currentUser.id,
      changedAt: new Date(),
    };

    const updatedRequest = {
      ...request,
      status: newStatus,
      updatedBy: currentUser.id,
      updatedAt: new Date(),
      statusChangeLog: [
        ...(request.statusChangeLog || []),
        statusChangeEntry
      ],
    };
    dispatch({ type: 'UPDATE_TRANSFER_REQUEST', payload: updatedRequest });
  };

  const handleMarkAsCompleted = () => {
    const oldStatus = request.status;
    const newStatus = 'completed' as TransferStatus;
    
    const statusChangeEntry: StatusChangeLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      requestId: request.id,
      oldStatus: oldStatus,
      newStatus: newStatus,
      changedBy: currentUser.id,
      changedAt: new Date(),
    };

    const updatedRequest = {
      ...request,
      status: newStatus,
      updatedBy: currentUser.id,
      updatedAt: new Date(),
      statusChangeLog: [
        ...(request.statusChangeLog || []),
        statusChangeEntry
      ],
    };
    dispatch({ type: 'UPDATE_TRANSFER_REQUEST', payload: updatedRequest });
  };

  const handleStatusChange = (newStatus: TransferStatus) => {
    const oldStatus = request.status;
    
    // Create status change log entry
    const statusChangeEntry: StatusChangeLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      requestId: request.id,
      oldStatus: oldStatus,
      newStatus: newStatus,
      changedBy: currentUser.id,
      changedAt: new Date(),
    };

    // Update request with new status and add to log
    const updatedRequest = {
      ...request,
      status: newStatus,
      updatedBy: currentUser.id,
      updatedAt: new Date(),
      statusChangeLog: [
        ...(request.statusChangeLog || []),
        statusChangeEntry
      ],
    };
    dispatch({ type: 'UPDATE_TRANSFER_REQUEST', payload: updatedRequest });
  };

  if (isCompact) {
  return (
      <div className={`bg-white border-2 border-gray-300 rounded-lg shadow-lg p-4 h-full flex flex-col font-mono text-sm ${deadlineWarning === 'overdue' ? 'border-red-400 bg-red-50' : 
                                      deadlineWarning === 'approaching' ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'}`}>
        {/* Receipt Header */}
        <div className="text-center border-b-2 border-dashed border-gray-400 pb-2 mb-3">
          <div className="text-xs text-gray-600">ЗАЯВКА НА ПЕРЕМЕЩЕНИЕ</div>
          <div className="text-xs text-gray-500">#{request.id.slice(-8).toUpperCase()}</div>
        </div>

        {/* Status Badge */}
        <div className="flex justify-center mb-3">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${config.color} border-2`}>
              <Icon className="h-3 w-3 mr-1" />
              {config.label}
          </span>
        </div>
        
        {/* GPS Status for Drivers */}
        {currentUser?.role === 'driver' && request.status === 'in_progress' && gpsStatus.gpsData && (
          <div className="flex justify-center mb-2">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              gpsStatus.isWithinWarehouseRadius 
                ? 'bg-green-100 text-green-800' 
                : 'bg-orange-100 text-orange-800'
            }`}>
              {gpsStatus.isWithinWarehouseRadius ? '✓ У СКЛАДА' : '📍 ДАЛЕКО'}
            </span>
          </div>
        )}

        {/* Route Information */}
        <div className="space-y-2 mb-3 flex-1">
          <div className="border-b border-gray-300 pb-2">
            <div className="text-xs text-gray-600 mb-1">ОТКУДА:</div>
            <div className="flex items-center space-x-1">
              <Building2 className="h-3 w-3 text-gray-500 flex-shrink-0" />
              <span className="font-bold text-gray-900 text-xs">
                {getWarehouseName(request.sourceWarehouse)}
              </span>
              {request.sourceDepartureTime && (
                <span className="ml-1 text-xs font-bold text-blue-600">
                  (ВЫЕЗД: {request.sourceDepartureTime})
                </span>
              )}
            </div>
          </div>
          
          <div className="border-b border-gray-300 pb-2">
            <div className="text-xs text-gray-600 mb-1">КУДА:</div>
            <div className="flex items-center space-x-1">
              <Building2 className="h-3 w-3 text-gray-500 flex-shrink-0" />
              <span className="font-bold text-gray-900 text-xs">
                {getWarehouseName(request.destinationWarehouse)}
              </span>
              {request.destinationArrivalTime && (
                <span className="ml-1 text-xs font-bold text-green-600">
                  (ПРИЕЗД: {request.destinationArrivalTime})
                </span>
              )}
            </div>
          </div>
          
        </div>

        {/* Items List */}
        <div className="border-t border-gray-300 pt-2 mb-3">
          <div className="text-xs text-gray-600 mb-1">ПОЗИЦИИ ({request.items.length} шт.):</div>
          <div className="space-y-1 max-h-20 overflow-y-auto pr-1">
            {request.items.map((item, index) => (
              <div key={index} className="flex justify-between text-xs">
                <span className="truncate">{item.name}</span>
                <span className="font-bold">x{item.quantity}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Created date */}
        <div className="text-center text-xs text-gray-500 mb-3 border-t border-gray-300 pt-2">
          {format(new Date(request.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-2 border-t-2 border-dashed border-gray-400">
          {currentUser?.role === 'admin' || currentUser?.id === request.createdBy ? (
            <div className="flex space-x-1">
              <button
                onClick={handleEditRequestLocal}
                className="p-1.5 text-primary-600 hover:text-primary-900 hover:bg-primary-50 rounded"
                title="Редактировать"
              >
                <Edit className="h-3 w-3" />
              </button>
              <button
                onClick={handleDeleteRequest}
                className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded"
                title="Удалить"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ) : <div></div>}
          
          {request.status === 'created' && (
            <button
              onClick={handleStartWork}
              className="text-xs bg-primary-600 text-white px-3 py-1 rounded font-bold hover:bg-primary-700"
            >
              НАЧАТЬ
            </button>
          )}
          
          {/* Driver action: Mark as received */}
          {currentUser?.role === 'driver' && request.status === 'in_progress' && (
            <div className="flex flex-col items-end space-y-1">
              {/* GPS Status Indicator */}
              {gpsStatus.isLoading && (
                <div className="text-xs text-gray-500 flex items-center">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500 mr-1"></div>
                  Проверка GPS...
                </div>
              )}
              
              {gpsStatus.error && (
                <div className="text-xs text-red-500">
                  GPS недоступен
                </div>
              )}
              
              {gpsStatus.gpsData && !gpsStatus.isLoading && (
                <div className="text-xs text-gray-600">
                  {gpsStatus.isWithinWarehouseRadius ? (
                    <span className="text-green-600">✓ В радиусе склада отправителя</span>
                  ) : (
                    <span className="text-orange-600">
                      {gpsStatus.distanceToWarehouse.toFixed(2)} миль от склада отправителя
                    </span>
                  )}
                </div>
              )}
              
              <button
                onClick={handleMarkAsReceived}
                disabled={!gpsStatus.isWithinWarehouseRadius || gpsStatus.isLoading}
                className={`text-xs px-3 py-1 rounded font-bold transition-colors ${
                  gpsStatus.isWithinWarehouseRadius && !gpsStatus.isLoading
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                }`}
                title={
                  !gpsStatus.isWithinWarehouseRadius 
                    ? 'Подойдите ближе к складу отправителя (в пределах 0.1 мили)'
                    : gpsStatus.isLoading
                    ? 'Проверка GPS...'
                    : 'Отметить как загружено'
                }
              >
                ЗАГРУЖЕНО
              </button>
            </div>
          )}

          {/* Driver action: Mark as delivered */}
          {currentUser?.role === 'driver' && request.status === 'received_by_driver' && (
            <div className="flex flex-col items-end space-y-1">
              {/* GPS Status Indicator */}
              {gpsStatus.isLoading && (
                <div className="text-xs text-gray-500 flex items-center">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500 mr-1"></div>
                  Проверка GPS...
                </div>
              )}
              
              {gpsStatus.error && (
                <div className="text-xs text-red-500">
                  GPS недоступен
                </div>
              )}
              
              {gpsStatus.gpsData && !gpsStatus.isLoading && (
                <div className="text-xs text-gray-600">
                  {gpsStatus.isWithinWarehouseRadius ? (
                    <span className="text-green-600">✓ В радиусе склада получателя</span>
                  ) : (
                    <span className="text-orange-600">
                      {gpsStatus.distanceToWarehouse.toFixed(2)} миль от склада получателя
                    </span>
                  )}
                </div>
              )}
              
              <button
                onClick={handleMarkAsDelivered}
                disabled={!gpsStatus.isWithinWarehouseRadius || gpsStatus.isLoading}
                className={`text-xs px-3 py-1 rounded font-bold transition-colors ${
                  gpsStatus.isWithinWarehouseRadius && !gpsStatus.isLoading
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                }`}
                title={
                  !gpsStatus.isWithinWarehouseRadius 
                    ? 'Подойдите ближе к складу получателя (в пределах 0.1 мили)'
                    : gpsStatus.isLoading
                    ? 'Проверка GPS...'
                    : 'Отметить как выгружено'
                }
              >
                ВЫГРУЖЕНО
              </button>
            </div>
          )}

          {/* Warehouse employee action: Mark as completed */}
          {currentUser?.role === 'warehouse_employee' && 
           currentUser?.warehouseId === request.destinationWarehouse && 
           request.status === 'delivered_to_warehouse' && (
            <button
              onClick={handleMarkAsCompleted}
              className="text-xs bg-green-600 text-white px-3 py-1 rounded font-bold hover:bg-green-700 transition-colors"
              title="Завершить заявку - груз получен на складе"
            >
              ЗАВЕРШИТЬ ЗАЯВКУ
            </button>
          )}

          {/* Admin action: Change status */}
          {currentUser?.role === 'admin' && (
            <div className="flex flex-col items-end space-y-1">
              <select
                value={request.status}
                onChange={(e) => handleStatusChange(e.target.value as TransferStatus)}
                className="text-xs px-2 py-1 rounded border border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                title="Изменить статус заявки (только для администратора)"
              >
                <option value="created">Создана</option>
                <option value="in_progress">В процессе</option>
                <option value="received_by_driver">Получено водителем</option>
                <option value="delivered_to_warehouse">Передано на склад</option>
                <option value="completed">Завершена</option>
                <option value="cancelled">Отменена</option>
              </select>
              
              {/* Quick cancel button for admin */}
              {request.status !== 'cancelled' && request.status !== 'completed' && (
                <button
                  onClick={() => handleStatusChange('cancelled')}
                  className="text-xs bg-red-600 text-white px-2 py-1 rounded font-bold hover:bg-red-700 transition-colors"
                  title="Быстро отменить заявку"
                >
                  ОТМЕНИТЬ
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    );
  }

  return (
    <div className={`bg-white border-2 border-gray-300 rounded-lg shadow-lg p-6 font-mono text-sm ${deadlineWarning === 'overdue' ? 'border-red-400 bg-red-50' : 
                                deadlineWarning === 'approaching' ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'}`}>
      {/* Receipt Header */}
      <div className="text-center border-b-2 border-dashed border-gray-400 pb-3 mb-4">
        <div className="text-sm text-gray-600">ЗАЯВКА НА ПЕРЕМЕЩЕНИЕ</div>
        <div className="text-xs text-gray-500">#{request.id.slice(-8).toUpperCase()}</div>
      </div>

      {/* Status and Warning */}
      <div className="flex justify-center items-center space-x-3 mb-4">
        <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${config.color} border-2`}>
          <Icon className="h-4 w-4 mr-2" />
              {config.label}
            </span>
            
            {deadlineWarning && (
          <span className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-bold ${
            deadlineWarning === 'overdue' ? 'bg-red-100 text-red-800 border-2 border-red-400' : 'bg-yellow-100 text-yellow-800 border-2 border-yellow-400'
              }`}>
            <AlertCircle className="h-4 w-4 mr-1" />
            {deadlineWarning === 'overdue' ? 'ПРОСРОЧЕНА' : 'СРОЧНО'}
              </span>
            )}
          </div>

      {/* Route Information */}
      <div className="space-y-3 mb-4">
        <div className="border-b-2 border-gray-300 pb-3">
          <div className="text-sm text-gray-600 mb-2 font-bold">ОТКУДА:</div>
              <div className="flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-gray-500 flex-shrink-0" />
            <span className="font-bold text-gray-900 text-base">
                  {getWarehouseName(request.sourceWarehouse)}
                </span>
                {request.sourceDepartureTime && (
              <span className="ml-2 text-sm font-bold text-blue-600">
                (ВЫЕЗД: {request.sourceDepartureTime})
                  </span>
                )}
              </div>
            </div>
            
        <div className="border-b-2 border-gray-300 pb-3">
          <div className="text-sm text-gray-600 mb-2 font-bold">КУДА:</div>
              <div className="flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-gray-500 flex-shrink-0" />
            <span className="font-bold text-gray-900 text-base">
                  {getWarehouseName(request.destinationWarehouse)}
                </span>
                {request.destinationArrivalTime && (
              <span className="ml-2 text-sm font-bold text-green-600">
                (ПРИЕЗД: {request.destinationArrivalTime})
                  </span>
                )}
              </div>
            </div>
            
            {/* Driver and Vehicle Info */}
            {(request.assignedDriverId || request.assignedVehicle) && (
          <div className="border-b-2 border-gray-300 pb-3">
            <div className="text-sm text-gray-600 mb-2 font-bold">НАЗНАЧЕНО:</div>
            <div className="flex items-center space-x-6 text-sm">
                {request.assignedDriverId && (
                <div className="flex items-center space-x-2">
                  <UserIcon className="h-4 w-4 text-gray-500" />
                  <span className="font-bold">
                    {(() => {
                      const driver = state.users.find((u: any) => u.id === request.assignedDriverId);
                      return driver ? `${driver.firstName} ${driver.lastName}` : 'Unknown';
                    })()}
                  </span>
                  </div>
                )}
                {request.assignedVehicle && (
                <div className="flex items-center space-x-2">
                  <Truck className="h-4 w-4 text-gray-500" />
                  <span className="font-bold">{request.assignedVehicle}</span>
                  </div>
                )}
            </div>
              </div>
            )}
          </div>

          {/* Items Preview */}
          <div className="text-sm text-gray-600 mb-3">
            <span className="font-medium">{request.items.length} позиций:</span>
            <span className="ml-2">
              {request.items.slice(0, 2).map(item => item.name).join(', ')}
              {request.items.length > 2 && ` и еще ${request.items.length - 2}`}
            </span>
          </div>

          {/* Dates and Creator */}
          <div className="space-y-2 text-sm text-gray-500">
            <div className="flex items-center space-x-6">
              <div>
                <span className="font-medium">Создана:</span>
                <span className="ml-1">
                  {format(new Date(request.createdAt), 'd MMM yyyy, HH:mm', { locale: ru })}
                </span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <UserIcon className="h-3 w-3" />
              <span>Автор: {(() => {
                const creator = state.users.find((u: any) => u.id === request.createdBy);
                return creator ? `${creator.firstName} ${creator.lastName}` : 'Unknown';
              })()}</span>
              {request.updatedAt && (
                <>
                  <span className="text-gray-400">•</span>
                  <span>Изменена: {format(new Date(request.updatedAt), 'd MMM HH:mm', { locale: ru })}</span>
                </>
              )}
            </div>
          </div>
            {/* Items List */}
      <div className="border-b-2 border-gray-300 pb-3 mb-4">
        <div className="text-sm text-gray-600 mb-2 font-bold">ПОЗИЦИИ ({request.items.length} шт.):</div>
        <div className="space-y-1 max-h-32 overflow-y-auto pr-2">
          {request.items.map((item, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span className="truncate">{item.name}</span>
              <span className="font-bold">x{item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>

      {/* Dates and Creator */}
      <div className="space-y-2 text-sm text-gray-500 mb-4">
        <div className="flex items-center space-x-2">
          <span className="font-bold">СОЗДАНА:</span>
          <span>{format(new Date(request.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}</span>
          </div>

                <div className="flex items-center space-x-2">
          <UserIcon className="h-4 w-4" />
          <span className="font-bold">АВТОР:</span>
          <span>{(() => {
                    const creator = state.users.find((u: any) => u.id === request.createdBy);
            return creator ? `${creator.firstName} ${creator.lastName}` : 'Unknown';
          })()}</span>
                </div>
              </div>

      {/* Actions */}
      <div className="flex justify-between items-center pt-3 border-t-2 border-dashed border-gray-400">
        <div className="flex space-x-2">
          {currentUser?.role === 'admin' || currentUser?.id === request.createdBy ? (
            <>
                <button
                  onClick={handleEditRequestLocal}
                className="p-2 text-primary-600 hover:text-primary-900 hover:bg-primary-50 rounded"
                title="Редактировать"
                >
                <Edit className="h-4 w-4" />
                </button>
                  <button
                onClick={handleDeleteRequest}
                className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded"
                title="Удалить"
                  >
                <Trash2 className="h-4 w-4" />
                  </button>
            </>
          ) : null}
      </div>
                
        {request.status === 'created' && (
                <button
            onClick={handleStartWork}
            className="bg-primary-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-primary-700"
                >
            НАЧАТЬ РАБОТУ
                </button>
          )}

          {/* Warehouse employee action: Mark as completed */}
          {currentUser?.role === 'warehouse_employee' && 
           currentUser?.warehouseId === request.destinationWarehouse && 
           request.status === 'delivered_to_warehouse' && (
            <button
              onClick={handleMarkAsCompleted}
              className="bg-green-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-green-700 transition-colors"
              title="Завершить заявку - груз получен на складе"
            >
              ЗАВЕРШИТЬ ЗАЯВКУ
            </button>
          )}

          {/* Admin action: Change status */}
          {currentUser?.role === 'admin' && (
            <div className="flex flex-col space-y-3">
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Изменить статус:
                </label>
                <select
                  value={request.status}
                  onChange={(e) => handleStatusChange(e.target.value as TransferStatus)}
                  className="px-3 py-2 rounded border border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  title="Изменить статус заявки (только для администратора)"
                >
                  <option value="created">Создана</option>
                  <option value="in_progress">В процессе</option>
                  <option value="received_by_driver">Получено водителем</option>
                  <option value="delivered_to_warehouse">Передано на склад</option>
                  <option value="completed">Завершена</option>
                  <option value="cancelled">Отменена</option>
                </select>
              </div>
              
              {/* Quick action buttons for admin */}
              <div className="flex space-x-2">
                {request.status !== 'cancelled' && request.status !== 'completed' && (
                  <button
                    onClick={() => handleStatusChange('cancelled')}
                    className="bg-red-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-red-700 transition-colors"
                    title="Быстро отменить заявку"
                  >
                    ОТМЕНИТЬ ЗАЯВКУ
                  </button>
                )}
                
                {request.status === 'cancelled' && (
                  <button
                    onClick={() => handleStatusChange('created')}
                    className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-blue-700 transition-colors"
                    title="Восстановить заявку"
                  >
                    ВОССТАНОВИТЬ
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

    </div>
  );
};

interface WarehouseGroupsViewProps {
  groupBy: 'sender' | 'receiver';
}

const WarehouseGroupsView: React.FC<WarehouseGroupsViewProps> = ({ groupBy }) => {
  const { state } = useAppContext();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [collapsedWarehouses, setCollapsedWarehouses] = useState<Set<string>>(new Set());
  const [collapsedRequests, setCollapsedRequests] = useState<Set<string>>(new Set());

  const getWarehouseName = (warehouseId: string) => {
    return state.warehouses.find(w => w.id === warehouseId)?.name || 'Неизвестный склад';
  };

  const getWarehouseAddress = (warehouseId: string) => {
    return state.warehouses.find(w => w.id === warehouseId)?.fullAddress || '';
  };

  const getWarehouseUnit = (warehouseId: string) => {
    return state.warehouses.find(w => w.id === warehouseId)?.unit || '';
  };

  const getWarehouseColor = (warehouseId: string) => {
    return state.warehouses.find(w => w.id === warehouseId)?.iconColor || '#3b82f6';
  };

  const goToPreviousDay = () => {
    const previousDay = new Date(selectedDate);
    previousDay.setDate(previousDay.getDate() - 1);
    setSelectedDate(previousDay);
  };

  const goToNextDay = () => {
    const nextDay = new Date(selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);
    setSelectedDate(nextDay);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // Функция для переключения состояния сворачивания склада
  const toggleWarehouseCollapse = (warehouseId: string) => {
    setCollapsedWarehouses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(warehouseId)) {
        newSet.delete(warehouseId);
      } else {
        newSet.add(warehouseId);
      }
      return newSet;
    });
  };

  // Функция для переключения состояния сворачивания заявки
  const toggleRequestCollapse = (requestId: string) => {
    setCollapsedRequests(prev => {
      const newSet = new Set(prev);
      if (newSet.has(requestId)) {
        newSet.delete(requestId);
      } else {
        newSet.add(requestId);
      }
      return newSet;
    });
  };

  // Group requests by warehouse (sender or receiver) for selected date
  const getGroupedRequests = () => {
    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
    
    // Filter requests for selected date
    const dateRequests = state.transferRequests.filter(request => {
      const requestDateStr = format(new Date(request.deadline), 'yyyy-MM-dd');
      return requestDateStr === selectedDateStr;
    });

    // Group by warehouse
    const grouped: { [warehouseId: string]: TransferRequest[] } = {};
    
    dateRequests.forEach(request => {
      const warehouseId = groupBy === 'sender' ? request.sourceWarehouse : request.destinationWarehouse;
      if (!grouped[warehouseId]) {
        grouped[warehouseId] = [];
      }
      grouped[warehouseId].push(request);
    });

    return grouped;
  };

  const groupedRequests = getGroupedRequests();
  const warehouseIds = Object.keys(groupedRequests);


  // Get driver and vehicle info from request
  const getDriverAndVehicleFromRequest = (request: TransferRequest) => {
    const driver = request.assignedDriverId 
      ? state.users.find(u => u.id === request.assignedDriverId)
      : null;
    
    const vehicle = request.assignedVehicle 
      ? state.vehicles.find(v => v.name === request.assignedVehicle)
      : null;

    return { driver, vehicle };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Building2 className="h-5 w-5 text-primary-600" />
            <h3 className="text-lg font-medium text-gray-900">
              Группировка по складу {groupBy === 'sender' ? 'отправителя' : 'получателя'} - {format(selectedDate, 'd MMMM yyyy', { locale: ru })}
            </h3>
            
            {/* Today indicator */}
            {format(selectedDate, 'yyyy-MM-dd') !== format(new Date(), 'yyyy-MM-dd') && (
              <button
                onClick={goToToday}
                className="text-sm text-primary-600 hover:text-primary-800 underline"
              >
                Сегодня
              </button>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Navigation arrows */}
            <button
              onClick={goToPreviousDay}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              title="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            <input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="input w-auto text-center"
            />
            
            <button
              onClick={goToNextDay}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              title="Next day"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        {/* Description */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            {groupBy === 'sender' 
              ? 'Список позиций для отправки с каждого склада на выбранную дату и время'
              : 'Список позиций для получения на каждом складе на выбранную дату и время'
            }
          </p>
        </div>
      </div>

      {/* Grouped Requests */}
      {warehouseIds.length > 0 ? (
        <div className="space-y-6">
          {warehouseIds.map(warehouseId => {
            const requests = groupedRequests[warehouseId];
            
            // Calculate total items
            const totalItems = requests.reduce((sum, req) => sum + req.items.length, 0);
            const totalQuantity = requests.reduce((sum, req) => 
              sum + req.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
            );

            // Get unique drivers, vehicles and routes from requests
            const uniqueDrivers = new Set();
            const uniqueVehicles = new Set();
            const uniqueRoutes = new Set();
            
            requests.forEach(req => {
              if (req.assignedDriverId) {
                const driver = state.users.find(u => u.id === req.assignedDriverId);
                if (driver) uniqueDrivers.add(`${driver.firstName} ${driver.lastName}`);
              }
              if (req.assignedVehicle) {
                uniqueVehicles.add(req.assignedVehicle);
              }
              if (req.routeId) {
                const route = state.routes.find(r => r.id === req.routeId);
                if (route) uniqueRoutes.add(route.name);
              }
            });

            return (
              <div key={warehouseId} className="card p-6">
                {/* Warehouse Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <WarehouseIcon
                      name={getWarehouseName(warehouseId)}
                      color={getWarehouseColor(warehouseId)}
                      size="lg"
                    />
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">
                        {getWarehouseName(warehouseId)}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {getWarehouseAddress(warehouseId)}
                      </p>
                      {getWarehouseUnit(warehouseId) && (
                        <p className="text-sm font-medium text-primary-600 mt-1">
                          UNIT: {getWarehouseUnit(warehouseId)}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">{requests.length}</div>
                      <div className="text-sm text-gray-500">заявок</div>
                      <div className="text-sm text-gray-500 mt-1">
                        {totalItems} позиций ({totalQuantity} шт.)
                      </div>
                    </div>
                    
                    {/* Collapse Button */}
                    <button
                      onClick={() => toggleWarehouseCollapse(warehouseId)}
                      className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                      title={collapsedWarehouses.has(warehouseId) ? 'Развернуть' : 'Свернуть'}
                    >
                      {collapsedWarehouses.has(warehouseId) ? (
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronUp className="h-5 w-5 text-gray-500" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Collapsible Content */}
                {!collapsedWarehouses.has(warehouseId) && (
                  <div className="transition-all duration-300 ease-in-out">
                    {/* Driver and Vehicle Info */}
                {(uniqueDrivers.size > 0 || uniqueVehicles.size > 0) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center space-x-4 text-sm text-blue-700">
                        {uniqueDrivers.size > 0 && (
                          <div className="flex items-center space-x-1">
                            <UserIcon className="h-4 w-4" />
                            <span>
                              {uniqueDrivers.size === 1 
                                ? Array.from(uniqueDrivers)[0] as string
                                : `${uniqueDrivers.size} водителей`
                              }
                            </span>
                          </div>
                        )}
                        {uniqueVehicles.size > 0 && (
                          <div className="flex items-center space-x-1">
                            <Truck className="h-4 w-4" />
                            <span>
                              {uniqueVehicles.size === 1 
                                ? Array.from(uniqueVehicles)[0] as string
                                : `${uniqueVehicles.size} транспорта`
                              }
                            </span>
                          </div>
                        )}
                    </div>
                  </div>
                )}

                {/* Requests List */}
                <div className="space-y-4">
                  {requests.map(request => {
                    const { driver, vehicle } = getDriverAndVehicleFromRequest(request);
                    
                    return (
                      <div key={request.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              request.status === 'created' ? 'bg-blue-100 text-blue-800' :
                              request.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                              request.status === 'completed' ? 'bg-green-100 text-green-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {request.status === 'created' ? 'Создана' :
                               request.status === 'in_progress' ? 'В процессе' :
                               request.status === 'completed' ? 'Завершена' : 'Отменена'}
                            </span>
                            
                            <div className="text-sm text-gray-600">
                              {groupBy === 'sender' ? 'Получатель:' : 'Отправитель:'} {' '}
                              <span className="font-medium text-gray-900">
                                {getWarehouseName(groupBy === 'sender' ? request.destinationWarehouse : request.sourceWarehouse)}
                              </span>
                            </div>

                            {/* Driver and Vehicle from request */}
                            {(driver || vehicle) && (
                              <div className="flex items-center space-x-2 text-xs text-gray-600">
                                {driver && (
                                  <div className="flex items-center space-x-1 bg-green-50 px-2 py-1 rounded">
                                    <UserIcon className="h-3 w-3" />
                                    <span>{driver.firstName} {driver.lastName}</span>
                                  </div>
                                )}
                                {vehicle && (
                                  <div className="flex items-center space-x-1 bg-blue-50 px-2 py-1 rounded">
                                    <Truck className="h-3 w-3" />
                                    <span>{vehicle.name}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <div className="text-xs text-gray-500">
                              {format(new Date(request.createdAt), 'HH:mm', { locale: ru })}
                            </div>
                            
                            {/* Request Collapse Button */}
                            <button
                              onClick={() => toggleRequestCollapse(request.id)}
                              className="p-1 rounded hover:bg-gray-100 transition-colors"
                              title={collapsedRequests.has(request.id) ? 'Развернуть заявку' : 'Свернуть заявку'}
                            >
                              {collapsedRequests.has(request.id) ? (
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                              ) : (
                                <ChevronUp className="h-4 w-4 text-gray-400" />
                              )}
                            </button>
                          </div>
                        </div>

                      {/* Collapsible Request Content */}
                      {!collapsedRequests.has(request.id) && (
                        <div className="transition-all duration-200 ease-in-out">
                          {/* Items */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-700">
                          Позиции для {groupBy === 'sender' ? 'отправки' : 'получения'}:
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {request.items.map(item => (
                            <div key={item.id} className="bg-gray-50 rounded p-3">
                              <div className="font-medium text-gray-900 text-sm">{item.name}</div>
                              <div className="text-xs text-gray-600 mt-1">
                                {item.type} • {item.quantity} шт.
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Notes */}
                      {request.notes && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Примечания</h4>
                          <div className="text-sm text-gray-700 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            {request.notes}
                          </div>
                        </div>
                      )}

                      {/* Times */}
                      {(request.sourceDepartureTime || request.destinationArrivalTime) && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="flex items-center space-x-4 text-xs text-gray-600">
                            {request.sourceDepartureTime && (
                              <div className="flex items-center space-x-1">
                                <Clock className="h-3 w-3" />
                                <span>Выезд со склада ({getWarehouseName(request.sourceWarehouse)}): {request.sourceDepartureTime}</span>
                              </div>
                            )}
                            {request.destinationArrivalTime && (
                              <div className="flex items-center space-x-1">
                                <Clock className="h-3 w-3" />
                                <span>Приезд на склад ({getWarehouseName(request.destinationWarehouse)}): {request.destinationArrivalTime}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Нет заявок на выбранную дату
          </h3>
          <p className="text-gray-500">
            На {format(selectedDate, 'd MMMM yyyy', { locale: ru })} нет заявок для группировки по складу {groupBy === 'sender' ? 'отправителя' : 'получателя'}
          </p>
        </div>
      )}
    </div>
  );
};

interface DailyRoutesViewProps {
  routeProgresses: Record<string, RouteProgress>;
  dispatch: any;
}

const DailyRoutesView: React.FC<DailyRoutesViewProps> = ({ routeProgresses, dispatch }) => {
  const { state } = useAppContext();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedStopByRoute, setSelectedStopByRoute] = useState<{[routeId: string]: string}>({});

  // Route colors for visual distinction
  const routeColors = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal  
    '#45B7D1', // Blue
    '#96CEB4', // Green
    '#FFEAA7', // Yellow
    '#DDA0DD', // Plum
    '#98D8C8', // Mint
    '#F7DC6F', // Light Yellow
    '#BB8FCE', // Light Purple
    '#85C1E9', // Light Blue
    '#F8C471', // Orange
    '#82E0AA', // Light Green
  ];

  const getRouteColor = (routeId: string) => {
    const routeIndex = state.routes.findIndex(r => r.id === routeId);
    return routeColors[routeIndex % routeColors.length];
  };

  const goToPreviousDay = () => {
    const previousDay = new Date(selectedDate);
    previousDay.setDate(previousDay.getDate() - 1);
    setSelectedDate(previousDay);
  };

  const goToNextDay = () => {
    const nextDay = new Date(selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);
    setSelectedDate(nextDay);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const drivers = state.users.filter(user => user.role === 'driver');
  

  const getWarehouseName = (warehouseId: string) => {
    return state.warehouses.find(w => w.id === warehouseId)?.name || 'Unknown';
  };

  const getWarehouseColor = (warehouseId: string) => {
    return state.warehouses.find(w => w.id === warehouseId)?.iconColor || '#3b82f6';
  };

  const getWarehouseAddress = (warehouseId: string) => {
    return state.warehouses.find(w => w.id === warehouseId)?.fullAddress || '';
  };

  const getWarehouseUnit = (warehouseId: string) => {
    return state.warehouses.find(w => w.id === warehouseId)?.unit || '';
  };

  // Check if warehouse is inactive based on current time vs departure time
  const isWarehouseInactive = (departureTime: string, selectedDate: Date) => {
    const now = new Date();
    const selectedDateStr = selectedDate.toDateString();
    const todayStr = now.toDateString();
    
    // Only check for today's routes
    if (selectedDateStr !== todayStr) return false;
    
    const [depHour, depMinute] = departureTime.split(':').map(Number);
    const departureDateTime = new Date(selectedDate);
    departureDateTime.setHours(depHour, depMinute, 0, 0);
    
    // Warehouse is inactive if current time is greater than departure time
    return now > departureDateTime;
  };

  const getRoutesForDate = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    const dailyRoutes: Array<{
      driver: any;
      route: any;
    }> = [];

    drivers.forEach(driver => {
      const schedule = state.workSchedules.find(
        ws => ws.driverId === driver.id && ws.year === year && ws.month === month
      );
      
      if (schedule && schedule.schedule[day]) {
        const routeId = schedule.schedule[day];
        const route = state.routes.find(r => r.id === routeId);
        if (route) {
          dailyRoutes.push({ driver, route });
        }
      }
    });

    return dailyRoutes;
  };

  const dailyRoutes = getRoutesForDate(selectedDate);



  // Обработчик клика по остановке
  const handleStopClick = (routeId: string, stopId: string) => {
    setSelectedStopByRoute(prev => ({
      ...prev,
      [routeId]: stopId
    }));
  };


  return (
    <div className="space-y-6">
      {/* Date Selector with Navigation */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <CalendarIcon className="h-5 w-5 text-primary-600" />
            <h3 className="text-lg font-medium text-gray-900">
              Маршруты на {format(selectedDate, 'd MMMM yyyy', { locale: ru })}
            </h3>
            
            {/* Today indicator */}
            {format(selectedDate, 'yyyy-MM-dd') !== format(new Date(), 'yyyy-MM-dd') && (
              <button
                onClick={goToToday}
                className="text-sm text-primary-600 hover:text-primary-800 underline"
              >
                Сегодня
              </button>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Navigation arrows */}
            <button
              onClick={goToPreviousDay}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              title="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            <input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="input w-auto text-center"
            />
            
            <button
              onClick={goToNextDay}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              title="Next day"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        {/* Quick date navigation */}
        <div className="flex items-center space-x-2 mt-4 pt-4 border-t border-gray-200">
          <span className="text-sm text-gray-500">Быстрый переход:</span>
          <button
            onClick={() => {
              const today = new Date();
              today.setDate(today.getDate() - 1);
              setSelectedDate(today);
            }}
            className="text-sm px-2 py-1 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
          >
            Вчера
          </button>
          <button
            onClick={goToToday}
            className="text-sm px-2 py-1 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
          >
            Сегодня
          </button>
          <button
            onClick={() => {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              setSelectedDate(tomorrow);
            }}
            className="text-sm px-2 py-1 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
          >
            Завтра
          </button>
        </div>
      </div>

      {/* Google Map for all routes */}
      <RoutesOverviewMap 
        dailyRoutes={dailyRoutes}
        selectedDate={selectedDate}
        getRouteColor={getRouteColor}
        isToday={format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')}
      />

      {/* Daily Routes */}
      {dailyRoutes.length > 0 ? (
        <div className="space-y-4">
          {dailyRoutes.map(({ driver, route }) => {
            // Check route progress
            const completedStops = route.stops.filter((stop: any) => 
              isWarehouseInactive(stop.departureTime, selectedDate)
            ).length;
            const totalStops = route.stops.length;
            const routeProgress = totalStops > 0 ? (completedStops / totalStops) * 100 : 0;
            
            const routeColor = getRouteColor(route.id);
            
            return (
              <div key={`${driver.id}-${route.id}`} className="card p-6 relative" style={{ borderLeft: `4px solid ${routeColor}` }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <UserIcon className="h-5 w-5 text-gray-400" />
                      <span className="font-medium text-gray-900">
                        {driver.firstName} {driver.lastName}
                      </span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: routeColor }}
                      >
                        <Map className="h-3 w-3 text-white" />
                      </div>
                      <span className="font-medium" style={{ color: routeColor }}>{route.name}</span>
                    </div>
                  </div>
                  
                  {/* Route Progress */}
                  <div className="flex items-center space-x-2">
                    <div className="text-xs text-gray-500">
                      {completedStops}/{totalStops} завершено
                    </div>
                    <div className="w-20 h-2 bg-gray-200 rounded-full">
                      <div 
                        className="h-2 rounded-full transition-all"
                        style={{ 
                          width: `${routeProgress}%`,
                          backgroundColor: routeColor
                        }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Route Chain */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-700">Цепочка маршрута:</h4>
                  <div className="flex items-center space-x-2 overflow-x-auto pb-2">
                    {route.stops
                      .sort((a: any, b: any) => a.order - b.order)
                      .map((stop: any, index: number) => {
                        const isInactive = isWarehouseInactive(stop.departureTime, selectedDate);
                        
                        return (
                          <div key={stop.id} className="flex items-center space-x-2 flex-shrink-0">
                            <div 
                              className={`flex flex-col items-center space-y-2 p-3 rounded-lg min-w-[140px] transition-all cursor-pointer hover:shadow-md ${
                                isInactive 
                                  ? 'bg-gray-200 opacity-60' 
                                  : selectedStopByRoute[route.id] === stop.id
                                    ? 'bg-blue-100 border-2 border-blue-500'
                                    : 'bg-gray-50 hover:bg-blue-50'
                              }`}
                              onClick={() => handleStopClick(route.id, stop.id)}
                            >
                              <div className="flex items-center space-x-2">
                                <div className="relative">
                                  <WarehouseIcon
                                    name={getWarehouseName(stop.warehouseId)}
                                    color={isInactive ? '#9ca3af' : getWarehouseColor(stop.warehouseId)}
                                    size="sm"
                                  />
                                  {isInactive && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <div className="w-6 h-0.5 bg-red-500 transform rotate-45"></div>
                                      <div className="w-6 h-0.5 bg-red-500 transform -rotate-45 absolute"></div>
                                    </div>
                                  )}
                                </div>
                                <span className={`text-sm font-medium ${
                                  isInactive ? 'text-gray-500 line-through' : 'text-gray-900'
                                }`}>
                                  {getWarehouseName(stop.warehouseId)}
                                </span>
                              </div>
                              
                              <div className="text-xs text-gray-500 text-center space-y-1">
                                <div className={isInactive ? 'line-through' : ''}>
                                  {getWarehouseAddress(stop.warehouseId)}
                                </div>
                                {getWarehouseUnit(stop.warehouseId) && (
                                  <div className={`font-medium ${
                                    isInactive 
                                      ? 'text-gray-400 line-through' 
                                      : 'text-primary-600'
                                  }`}>
                                    UNIT: {getWarehouseUnit(stop.warehouseId)}
                                  </div>
                                )}
                              </div>
                              
                              <div className="text-xs text-center space-y-1">
                                {/* Плановое время прибытия */}
                                <div className={`flex items-center space-x-1 ${
                                  isInactive ? 'text-gray-400' : 'text-gray-600'
                                }`}>
                                  <Clock className="h-3 w-3" />
                                  <span>Arrival: <strong>{stop.arrivalTime}</strong></span>
                                </div>
                                
                                
                                {/* Плановое время отъезда */}
                                <div className={`flex items-center space-x-1 ${
                                  isInactive ? 'text-red-500 font-semibold' : 'text-gray-600'
                                }`}>
                                  <Clock className="h-3 w-3" />
                                  <span>Departure: <strong>{stop.departureTime}</strong></span>
                                  {isInactive && (
                                    <span className="text-xs bg-red-100 text-red-700 px-1 rounded">
                                      Прошло
                                    </span>
                                  )}
                                </div>
                                
                              </div>
                              
                            </div>
                            
                            {index < route.stops.length - 1 && (
                              <ArrowRight className={`h-4 w-4 flex-shrink-0 ${
                                isInactive ? 'text-gray-300' : 'text-gray-400'
                              }`} />
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* RouteMap перемещена выше цепочки маршрута */}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <Map className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Нет маршрутов на этот день</h3>
          <p className="text-gray-500">
            На выбранную дату не назначено маршрутов. Назначьте маршруты водителям в разделе "График Работ"
          </p>
        </div>
      )}
    </div>
  );
};

interface EditRequestModalProps {
  request: TransferRequest;
  state: any;
  dispatch: any;
  onClose: () => void;
}

const EditRequestModal: React.FC<EditRequestModalProps> = ({ 
  request, 
  state, 
  dispatch, 
  onClose 
}) => {
  const [formData, setFormData] = useState({
    sourceWarehouse: request.sourceWarehouse,
    destinationWarehouse: request.destinationWarehouse,
    notes: request.notes || '',
  });
  const [items, setItems] = useState(request.items);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const updatedRequest: TransferRequest = {
      ...request,
      sourceWarehouse: formData.sourceWarehouse,
      destinationWarehouse: formData.destinationWarehouse,
      items: items,
      notes: formData.notes,
      updatedBy: state.currentUser.id,
      updatedAt: new Date(),
    };

    dispatch({ type: 'UPDATE_TRANSFER_REQUEST', payload: updatedRequest });
    onClose();
  };

  const handleAddItem = () => {
    const newItem = {
      id: Date.now().toString(),
      name: '',
      type: '',
      quantity: 1,
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Редактировать заявку #{request.id}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Warehouse Selection */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Склад отправитель
              </label>
              <select
                value={formData.sourceWarehouse}
                onChange={(e) => setFormData(prev => ({ ...prev, sourceWarehouse: e.target.value, destinationWarehouse: '' }))}
                className="input"
                required
              >
                <option value="">Выберите склад...</option>
                {state.warehouses.map((warehouse: any) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Склад получатель
              </label>
              <select
                value={formData.destinationWarehouse}
                onChange={(e) => setFormData(prev => ({ ...prev, destinationWarehouse: e.target.value }))}
                className="input"
                required
              >
                <option value="">Выберите склад...</option>
                {state.warehouses
                  .filter((w: any) => w.id !== formData.sourceWarehouse)
                  .map((warehouse: any) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Items Management */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Позиции для перемещения</h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="btn-secondary"
              >
                <Plus className="h-4 w-4 mr-2" />
                Добавить позицию
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={item.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border border-gray-200 rounded-lg">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Наименование
                    </label>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                      className="input"
                      placeholder="Введите наименование товара"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Тип позиции
                    </label>
                    <input
                      type="text"
                      value={item.type}
                      onChange={(e) => handleItemChange(index, 'type', e.target.value)}
                      className="input"
                      placeholder="Введите тип позиции"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Количество
                    </label>
                    <div className="flex">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                        className="input flex-1"
                        required
                      />
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="ml-2 p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Примечания
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="input min-h-[100px] resize-none"
              placeholder="Дополнительная информация о заявке..."
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn-primary"
            >
              <Package className="h-4 w-4 mr-2" />
              Сохранить изменения
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Компонент общей карты для всех маршрутов
interface RoutesOverviewMapProps {
  dailyRoutes: Array<{
    driver: any;
  route: any;
  }>;
  selectedDate: Date;
  getRouteColor: (routeId: string) => string;
  isToday: boolean;
}

const RoutesOverviewMap: React.FC<RoutesOverviewMapProps> = ({ dailyRoutes, selectedDate, getRouteColor, isToday }) => {
  const { state } = useAppContext();
  const { isLoaded: isGoogleMapsLoaded } = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const circlesRef = useRef<google.maps.Circle[]>([]);
  const vehicleMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  
  // GPS data state
  const [vehicleGPSData, setVehicleGPSData] = useState<{ [vehicleId: string]: VehicleGPSData }>({});
  const [isLoadingGPS, setIsLoadingGPS] = useState(false);
  
  // Route tracking state
  const [isTrackingActive, setIsTrackingActive] = useState(false);
  const [trackingStats, setTrackingStats] = useState<{
    activeRoutes: number;
    totalLogs: number;
    lastUpdate: string | null;
  }>({ activeRoutes: 0, totalLogs: 0, lastUpdate: null });

  // Load GPS data for all vehicles
  const loadAllVehiclesGPS = useCallback(async () => {
    if (!state.vehicles || state.vehicles.length === 0) return;

    setIsLoadingGPS(true);
    console.log('📡 Загружаем GPS данные для всех автомобилей:', state.vehicles.length);

    const gpsResults: { [vehicleId: string]: VehicleGPSData } = {};

    try {
      // Load GPS data for each vehicle in parallel
      const promises = state.vehicles.map(async (vehicle) => {
        try {
          if (!vehicle.trak4DeviceId && !vehicle.gpsDeviceId) {
            console.warn(`⚠️ Нет Device ID для автомобиля: ${vehicle.name} (${vehicle.id})`);
            return null;
          }

          const deviceId = vehicle.gpsDeviceId || vehicle.trak4DeviceId;
          const apiKey = vehicle.gpsApiKey || 'default-key';

          console.log(`📡 Загружаем GPS для ${vehicle.name}:`, {
        vehicleId: vehicle.id,
            deviceId,
            apiKey: apiKey.substring(0, 8) + '...'
      });
      
          const gpsData = await Trak4GPSService.getDeviceByIdWithKey(
        vehicle.id,
            apiKey,
            parseInt(String(deviceId)),
            false // Используем кэширование
          );

          if (gpsData && gpsData.position) {
            gpsResults[vehicle.id] = gpsData;
            console.log(`✅ GPS данные получены для ${vehicle.name}:`, {
              coordinates: gpsData.position,
              timestamp: gpsData.lastUpdate
            });
      } else {
            console.warn(`⚠️ Нет GPS данных для ${vehicle.name}`);
          }

          return gpsData;
    } catch (error) {
          console.error(`❌ Ошибка загрузки GPS для ${vehicle.name}:`, error);
          return null;
        }
      });

      await Promise.all(promises);
      setVehicleGPSData(gpsResults);
      console.log(`📊 Загружено GPS данных для ${Object.keys(gpsResults).length} из ${state.vehicles.length} автомобилей`);

      // Отправляем событие обновления GPS данных для системы отслеживания
      window.dispatchEvent(new CustomEvent('vehicleGPSUpdated', {
        detail: { vehicleGPSData: gpsResults, timestamp: new Date().toISOString() }
      }));

    } catch (error) {
      console.error('❌ Ошибка загрузки GPS данных:', error);
    } finally {
      setIsLoadingGPS(false);
    }
  }, [state.vehicles]);

  // Update tracking stats
  const updateTrackingStats = useCallback(() => {
    const stats = ActualRouteTrackingService.getTrackingStats();
    const active = ActualRouteTrackingService.isTrackingActive();
    
    setTrackingStats(stats);
    setIsTrackingActive(active);
    
    console.log('📊 Обновлена статистика отслеживания:', { active, stats });
  }, []);

  // Start tracking manually
  const handleStartTracking = useCallback(() => {
    console.log('🎯 ===== НАЧАЛО РУЧНОГО ЗАПУСКА ОТСЛЕЖИВАНИЯ =====');
    console.log('📊 Доступные данные:', {
      dailyRoutesCount: dailyRoutes.length,
      vehiclesCount: state.vehicles.length,
      isToday,
      selectedDate: selectedDate.toISOString()
    });
    
    if (!isToday) {
      console.error('❌ Отслеживание возможно только для сегодняшнего дня!');
      alert('❌ Отслеживание возможно только для сегодняшнего дня!\nВыберите сегодняшнюю дату.');
      return;
    }

    if (dailyRoutes.length === 0) {
      console.error('❌ Нет маршрутов на сегодняшний день!');
      alert('❌ Нет маршрутов на сегодняшний день!\nПроверьте назначение маршрутов в "График работ".');
      return;
    }
    
    let initializedCount = 0;
    let errorCount = 0;
    
    // Инициализируем прогресс для всех сегодняшних маршрутов
    console.log(`🔧 Инициализация прогресса для ${dailyRoutes.length} маршрутов...`);
    
    dailyRoutes.forEach(({ driver, route }, index) => {
      const driverFullName = `${driver.firstName} ${driver.lastName}`;
      
      // Ищем транспорт двумя способами: по vehicleId в маршруте или по assignedDriver
      let vehicle = null;
      
      if (route.vehicleId) {
        // Способ 1: По vehicleId в маршруте
        vehicle = state.vehicles.find(v => v.id === route.vehicleId);
        console.log(`🔍 Поиск транспорта по route.vehicleId: ${route.vehicleId} → ${vehicle ? 'НАЙДЕН' : 'НЕ НАЙДЕН'}`);
    }
    
    if (!vehicle) {
        // Способ 2: По assignedDriver в транспорте
        vehicle = state.vehicles.find(v => v.assignedDriver === driverFullName);
        console.log(`🔍 Поиск транспорта по assignedDriver: ${driverFullName} → ${vehicle ? 'НАЙДЕН' : 'НЕ НАЙДЕН'}`);
      }
      
      console.log(`📋 Маршрут ${index + 1}/${dailyRoutes.length}: ${route.name}`);
      console.log(`   Водитель: ${driverFullName} (ID: ${driver.id})`);
      console.log(`   Маршрут vehicleId: ${route.vehicleId || 'НЕ УКАЗАН'}`);
      console.log(`   Найденный транспорт: ${vehicle ? `${vehicle.name} (ID: ${vehicle.id})` : 'НЕ НАЙДЕН'}`);
      
      if (vehicle) {
        console.log(`🔧 Инициализация прогресса для маршрута: ${route.name} (${route.id}) водитель: ${driver.id} транспорт: ${vehicle.id}`);
        
        // Попытаемся получить или создать прогресс маршрута
        try {
          const progress = ActualRouteTrackingService.initializeRouteProgressWithData(route, driver.id, vehicle.id);
          if (progress) {
            console.log(`✅ Прогресс маршрута инициализирован: ${route.name}`);
            console.log(`   Статусы складов:`, progress.warehouseStatuses.map(ws => `${ws.warehouseId}:${ws.status}`));
            initializedCount++;
          } else {
            console.warn(`⚠️ Не удалось инициализировать прогресс для маршрута: ${route.name}`);
            errorCount++;
          }
        } catch (error) {
          console.error(`❌ Ошибка инициализации прогресса маршрута ${route.name}:`, error);
          errorCount++;
        }
      } else {
        console.warn(`⚠️ Нет назначенного транспорта для водителя: ${driverFullName} в маршруте: ${route.name}`);
        errorCount++;
      }
    });
    
    console.log(`📊 Результат инициализации: ✅ ${initializedCount} успешно, ❌ ${errorCount} ошибок`);
    
    if (initializedCount === 0) {
      console.error('❌ НИ ОДИН МАРШРУТ НЕ ИНИЦИАЛИЗИРОВАН!');
      alert('❌ Не удалось инициализировать ни один маршрут!\nПроверьте назначение транспорта водителям.');
      return;
    }
    
    console.log('🚀 Запуск ActualRouteTrackingService.forceStartTrackingWithRoutes()...');
    ActualRouteTrackingService.forceStartTrackingWithRoutes(
      dailyRoutes,
      state.vehicles,
                    state.warehouses
                  );
                  
    // Обновляем статистику через небольшую задержку
    setTimeout(() => {
      console.log('📊 Обновление статистики отслеживания...');
      updateTrackingStats();
      
      // Проверяем результат
      setTimeout(() => {
        const stats = ActualRouteTrackingService.getTrackingStats();
        const isActive = ActualRouteTrackingService.isTrackingActive();
        console.log('🔍 Финальная проверка после запуска:', {
          isActive,
          activeRoutes: stats.activeRoutes,
          totalLogs: stats.totalLogs
        });
        
        if (!isActive || stats.activeRoutes === 0) {
          console.error('❌ ОТСЛЕЖИВАНИЕ НЕ ЗАПУСТИЛОСЬ!');
          alert('❌ Отслеживание не запустилось!\nПроверьте консоль для диагностики.');
      } else {
          console.log('✅ ОТСЛЕЖИВАНИЕ УСПЕШНО ЗАПУЩЕНО!');
        }
      }, 2000);
    }, 1000);
    
    console.log('🎯 ===== КОНЕЦ РУЧНОГО ЗАПУСКА ОТСЛЕЖИВАНИЯ =====');
  }, [updateTrackingStats, dailyRoutes, state.vehicles, isToday, selectedDate]);

  // Stop tracking manually
  const handleStopTracking = useCallback(() => {
    console.log('🛑 Ручная остановка отслеживания маршрутов');
    ActualRouteTrackingService.stopAllTracking();
    updateTrackingStats();
  }, [updateTrackingStats]);

  // Initialize map
  useEffect(() => {
    if (!isGoogleMapsLoaded || !mapRef.current || !dailyRoutes.length) return;

    const mapInstance = new google.maps.Map(mapRef.current, {
      zoom: 11,
      center: { lat: 34.0522, lng: -118.2437 }, // Default LA center
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      mapId: 'DEMO_MAP_ID',
    });

    mapInstanceRef.current = mapInstance;
    console.log('🗺️ RoutesOverviewMap: Карта инициализирована');
  }, [isGoogleMapsLoaded, dailyRoutes.length]);

  // Add warehouse markers
  useEffect(() => {
    if (!mapInstanceRef.current || !dailyRoutes.length) return;

    // Clear existing markers and circles
    markersRef.current.forEach(marker => {
      if (marker.map) {
        marker.map = null;
      }
    });
    markersRef.current = [];

    circlesRef.current.forEach(circle => {
      circle.setMap(null);
    });
    circlesRef.current = [];

    // Collect all unique warehouses from all routes
    const uniqueWarehouses: { [key: string]: { warehouse: any; routes: string[] } } = {};
    
    dailyRoutes.forEach(({ driver, route }) => {
      route.stops.forEach((stop: any) => {
        const warehouse = state.warehouses.find(w => w.id === stop.warehouseId);
        if (warehouse && warehouse.coordinates) {
          if (!uniqueWarehouses[warehouse.id]) {
            uniqueWarehouses[warehouse.id] = { warehouse, routes: [] };
          }
          if (!uniqueWarehouses[warehouse.id].routes.includes(route.name)) {
            uniqueWarehouses[warehouse.id].routes.push(route.name);
          }
        }
      });
    });

    // Create markers for unique warehouses
    Object.values(uniqueWarehouses).forEach(({ warehouse, routes }) => {
      if (warehouse.coordinates) {
        // Create circular marker using Circle
        const circle = new google.maps.Circle({
          strokeColor: warehouse.iconColor || '#3b82f6',
          strokeOpacity: 0.8,
        strokeWeight: 3,
          fillColor: warehouse.iconColor || '#3b82f6',
          fillOpacity: 0.6,
          map: mapInstanceRef.current,
          center: { lat: warehouse.coordinates.lat, lng: warehouse.coordinates.lng },
          radius: 100, // 100 meters radius
          clickable: true,
        });

        // Create a text label for warehouse initials
        const marker = new google.maps.marker.AdvancedMarkerElement({
          position: { lat: warehouse.coordinates.lat, lng: warehouse.coordinates.lng },
      map: mapInstanceRef.current,
          title: `${warehouse.name} (${routes.length} маршрут${routes.length > 1 ? 'а' : ''})`,
          content: (() => {
            const div = document.createElement('div');
            div.style.cssText = `
              width: 40px;
              height: 40px;
              background-color: ${warehouse.iconColor || '#3b82f6'};
              border: 3px solid white;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              font-size: 12px;
              color: white;
              cursor: pointer;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            `;
            div.textContent = warehouse.name.substring(0, 2).toUpperCase();
            return div;
          })(),
        });

        // Create info window
    const infoWindow = new google.maps.InfoWindow({
      content: `
            <div style="padding: 8px;">
              <h3 style="margin: 0 0 8px 0; color: ${warehouse.iconColor};">${warehouse.name}</h3>
              <p style="margin: 0; font-size: 12px; color: #666;">
                ${warehouse.fullAddress || warehouse.address || 'Адрес не указан'}
              </p>
              ${warehouse.unit ? `<p style="margin: 4px 0 0 0; font-size: 12px; font-weight: bold; color: #1976D2;">UNIT: ${warehouse.unit}</p>` : ''}
              <p style="margin: 8px 0 0 0; font-size: 12px; color: #333;">
                Маршруты: ${routes.join(', ')}
              </p>
          </div>
      `
    });

        // Add click listeners for both circle and marker
        const openInfoWindow = () => {
        infoWindow.open(mapInstanceRef.current, marker);
        };

        marker.addListener('click', openInfoWindow);
        circle.addListener('click', openInfoWindow);

        // Store both circle and marker for cleanup
        markersRef.current.push(marker);
        circlesRef.current.push(circle);
      }
    });

    // Adjust map bounds to fit all markers
    if (markersRef.current.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      Object.values(uniqueWarehouses).forEach(({ warehouse }) => {
        if (warehouse.coordinates) {
          bounds.extend({ lat: warehouse.coordinates.lat, lng: warehouse.coordinates.lng });
        }
      });
      mapInstanceRef.current.fitBounds(bounds);
      
      // Ensure minimum zoom level
      const listener = google.maps.event.addListener(mapInstanceRef.current, 'bounds_changed', () => {
        if (mapInstanceRef.current && mapInstanceRef.current.getZoom()! > 13) {
          mapInstanceRef.current.setZoom(13);
        }
        google.maps.event.removeListener(listener);
      });
    }

    console.log('🏭 Уникальные склады отображены на общей карте:', Object.keys(uniqueWarehouses).length);
  }, [dailyRoutes, state.warehouses]);

  // Load GPS data when map is initialized
  useEffect(() => {
    if (mapInstanceRef.current) {
      loadAllVehiclesGPS();
      updateTrackingStats(); // Initial stats update
      
      // Автоматически запускаем отслеживание если это сегодняшний день и есть маршруты
      if (isToday && dailyRoutes.length > 0) {
        console.log('🤖 Автоматический запуск отслеживания для сегодняшних маршрутов');
        
        // Небольшая задержка для инициализации карты
        setTimeout(() => {
          ActualRouteTrackingService.forceStartTrackingWithRoutes(
            dailyRoutes,
            state.vehicles,
            state.warehouses
          );
          
          setTimeout(() => {
            updateTrackingStats();
          }, 1000);
        }, 2000);
      }
      
      // Set up interval to refresh GPS data every 30 seconds
      console.log('⏰ Настройка интервала обновления GPS каждые 30 секунд');
      const interval = setInterval(() => {
        console.log('🔄 Автоматическое обновление GPS данных (каждые 30 сек)');
        loadAllVehiclesGPS();
        updateTrackingStats(); // Update tracking stats
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [mapInstanceRef.current, loadAllVehiclesGPS, updateTrackingStats, isToday, dailyRoutes, state.vehicles, state.warehouses]);

  // Listen for route progress changes
  useEffect(() => {
    const handleRouteProgressChange = () => {
      updateTrackingStats();
    };

    window.addEventListener('routeProgressChanged', handleRouteProgressChange);
    return () => {
      window.removeEventListener('routeProgressChanged', handleRouteProgressChange);
    };
  }, [updateTrackingStats]);

  // Create vehicle markers based on GPS data
  useEffect(() => {
    if (!mapInstanceRef.current) {
      console.log('⚠️ Карта не инициализирована, пропускаем обновление маркеров автомобилей');
      return;
    }
    
    if (!vehicleGPSData || Object.keys(vehicleGPSData).length === 0) {
      console.log('⚠️ Нет GPS данных автомобилей, пропускаем обновление маркеров');
      return;
    }

    console.log(`🚚 Обновление маркеров автомобилей на карте. GPS данных: ${Object.keys(vehicleGPSData).length}`);

    // Clear existing vehicle markers
    vehicleMarkersRef.current.forEach(marker => {
      if (marker.map) {
        marker.map = null;
      }
    });
    vehicleMarkersRef.current = [];
    
    console.log('🗑️ Очищены старые маркеры автомобилей');

    // Create markers for vehicles with GPS data
    Object.entries(vehicleGPSData).forEach(([vehicleId, gpsData]) => {
      if (!gpsData.position) return;

      const vehicle = state.vehicles.find(v => v.id === vehicleId);
      if (!vehicle) return;

      // Find assigned driver for this vehicle
      const assignedDriver = dailyRoutes.find(({ driver, route }) => {
        const driverFullName = `${driver.firstName} ${driver.lastName}`;
        return vehicle.assignedDriver === driverFullName;
      });

      // Get route color for this vehicle
      const routeColor = assignedDriver ? getRouteColor(assignedDriver.route.id) : '#FF4444';

      // Create vehicle marker using AdvancedMarkerElement
      const pinElement = new google.maps.marker.PinElement({
        background: routeColor, // Use route color
        borderColor: '#ffffff',
        glyphColor: 'white',
        glyph: '🚚', // Truck emoji
        scale: 1.5,
      });

      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: gpsData.position.latitude, lng: gpsData.position.longitude },
        map: mapInstanceRef.current,
        title: `${vehicle.name} - GPS: ${gpsData.lastUpdate}`,
        content: pinElement.element,
        zIndex: 1000, // Above warehouse markers
      });

      // Create info window
      const infoWindow = new google.maps.InfoWindow({
            content: `
          <div style="padding: 8px;">
            <h3 style="margin: 0 0 8px 0; color: ${routeColor};">🚚 ${vehicle.name}</h3>
            <p style="margin: 0; font-size: 12px; color: #666;">
              <strong>Номер:</strong> ${vehicle.licensePlate || 'Не указан'}
            </p>
            ${vehicle.assignedDriver ? `
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #333;">
                <strong>Водитель:</strong> ${vehicle.assignedDriver}
              </p>
                  ` : ''}
            ${assignedDriver ? `
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #1976D2;">
                <strong>Маршрут:</strong> ${assignedDriver.route.name}
              </p>
                  ` : ''}
            <p style="margin: 8px 0 0 0; font-size: 11px; color: #888;">
              <strong>GPS:</strong> ${gpsData.position.latitude.toFixed(6)}, ${gpsData.position.longitude.toFixed(6)}
            </p>
            <p style="margin: 4px 0 0 0; font-size: 11px; color: #888;">
              <strong>Обновлено:</strong> ${gpsData.lastUpdate}
            </p>
              </div>
            `
          });
          
          marker.addListener('click', () => {
        infoWindow.open(mapInstanceRef.current, marker);
      });

      vehicleMarkersRef.current.push(marker);
    });

    console.log(`🚚 Маркеры автомобилей обновлены на карте: ${vehicleMarkersRef.current.length} из ${Object.keys(vehicleGPSData).length} GPS данных`);
    console.log(`📍 Координаты автомобилей:`, Object.entries(vehicleGPSData).map(([id, data]) => ({
      vehicleId: id,
      lat: data.position.latitude,
      lng: data.position.longitude,
      lastUpdate: data.lastUpdate
    })));
  }, [vehicleGPSData, state.vehicles, dailyRoutes]);

  // Cleanup
  useEffect(() => {
    return () => {
      markersRef.current.forEach(marker => {
        if (marker.map) {
          marker.map = null;
        }
      });
      circlesRef.current.forEach(circle => {
        circle.setMap(null);
      });
      vehicleMarkersRef.current.forEach(marker => {
        if (marker.map) {
          marker.map = null;
        }
      });
    };
  }, []);

  if (!isGoogleMapsLoaded) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Обзор маршрутов на карте</h3>
        </div>
        <div className="bg-gray-100 rounded-lg p-8 text-center" style={{ height: '400px' }}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Загрузка Google Maps...</p>
        </div>
      </div>
    );
  }

  if (!dailyRoutes.length) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Обзор маршрутов на карте</h3>
          </div>
        <div className="bg-gray-50 rounded-lg p-8 text-center" style={{ height: '400px' }}>
          <Map className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Нет маршрутов для отображения на карте</p>
      </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          Обзор маршрутов на карте - {format(selectedDate, 'd MMMM yyyy', { locale: ru })}
          </h3>
        <div className="text-sm text-gray-500 flex items-center space-x-4">
          <span>
            {dailyRoutes.length} маршрут{dailyRoutes.length > 1 ? 'а' : ''} • {Object.keys(
              dailyRoutes.reduce((acc: any, { route }) => {
                route.stops.forEach((stop: any) => {
                  const warehouse = state.warehouses.find(w => w.id === stop.warehouseId);
                  if (warehouse) acc[warehouse.id] = true;
                });
                return acc;
              }, {})
            ).length} склад{Object.keys(
              dailyRoutes.reduce((acc: any, { route }) => {
                route.stops.forEach((stop: any) => {
                  const warehouse = state.warehouses.find(w => w.id === stop.warehouseId);
                  if (warehouse) acc[warehouse.id] = true;
                });
                return acc;
              }, {})
            ).length > 1 ? 'ов' : ''}
                    </span>
          <span className="flex items-center space-x-1">
            <span className={`inline-block w-2 h-2 rounded-full ${isLoadingGPS ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></span>
            <span>
              🚚 {Object.keys(vehicleGPSData).length} автомобил{Object.keys(vehicleGPSData).length === 1 ? 'ь' : Object.keys(vehicleGPSData).length < 5 ? 'я' : 'ей'} онлайн
                    </span>
                    </span>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2">
          <div 
            ref={mapRef} 
            className="w-full rounded-lg border border-gray-200"
            style={{ height: '400px', minHeight: '400px' }}
          />
          <div className="mt-2 text-xs text-gray-500 text-center">
            💡 Нажмите на склад (📍) или автомобиль (🚚) для подробной информации
              </div>
            </div>

        {/* GPS Status Panel */}
        <div className="lg:col-span-1">
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4" style={{ height: '400px' }}>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-900">
                  GPS Статус маршрутов
                  {!isToday && (
                    <span className="ml-2 text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">
                      Только сегодня
                    </span>
                  )}
                </h4>
                <div className="flex items-center space-x-1">
                  <span className={`inline-block w-2 h-2 rounded-full ${
                    !isToday ? 'bg-gray-400' : 
                    isTrackingActive ? 'bg-green-500' : 
                    isLoadingGPS ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
                  }`}></span>
                  <span className="text-xs text-gray-500">
                    {!isToday ? 'Неактивно' : 
                     isTrackingActive ? 'Отслеживание' : 
                     isLoadingGPS ? 'Загрузка...' : 'Остановлено'}
                  </span>
                </div>
              </div>
              
              {/* Tracking Stats and Controls */}
              {isToday && (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>Активных маршрутов: {trackingStats.activeRoutes}</span>
                      <span>GPS логов: {trackingStats.totalLogs}</span>
                    </div>
                    
                    <div className="text-xs text-gray-500">
                      Рабочее время: {(() => {
                        const settings = ActualRouteTrackingService.getTrackingTimeSettings();
                        return `${settings.startHour.toString().padStart(2, '0')}:00-${settings.endHour.toString().padStart(2, '0')}:00`;
                      })()} • Текущее: {new Date().toLocaleTimeString()}
                    </div>
                    <div className="text-xs text-gray-400">
                      GPS обновление: каждые 30 сек • Последнее: {new Date().toLocaleTimeString()}
                    </div>
            </div>
                  
                  {trackingStats.lastUpdate && (
                    <div className="text-xs text-gray-500">
                      Последнее обновление: {new Date(trackingStats.lastUpdate).toLocaleTimeString()}
            </div>
                  )}
            
            <div className="flex space-x-2">
                    {!isTrackingActive ? (
                <button
                        onClick={handleStartTracking}
                        className="flex-1 px-3 py-2 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Начать отслеживание
                </button>
              ) : (
                <button
                        onClick={handleStopTracking}
                        className="flex-1 px-3 py-2 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center"
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Остановить
                </button>
              )}
                  </div>
              
                  {/* GPS Update buttons */}
                  <div className="flex space-x-1">
              <button
                      onClick={() => {
                        console.log('🔄 Принудительное обновление GPS данных');
                        loadAllVehiclesGPS();
                      }}
                      className="flex-1 px-2 py-1 bg-blue-200 text-blue-700 text-xs rounded hover:bg-blue-300 transition-colors"
                    >
                      📡 Обновить GPS
                    </button>
                    <button
                      onClick={() => {
                        console.log('🔄 Принудительное обновление статистики');
                        updateTrackingStats();
                        // Force re-render
                        setVehicleGPSData(prev => ({ ...prev }));
                      }}
                      className="flex-1 px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300 transition-colors"
                    >
                      📊 Статистика
              </button>
            </div>
            </div>
              )}
          </div>
          
            <div className="space-y-3 overflow-y-auto" style={{ maxHeight: '340px' }}>
              {!isToday && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                  <div className="text-sm text-orange-700 font-medium mb-1">
                    📅 Отслеживание доступно только для сегодняшнего дня
              </div>
                  <div className="text-xs text-orange-600">
                    Выберите сегодняшнюю дату для просмотра фактических GPS статусов
            </div>
        </div>
      )}

              {dailyRoutes.map(({ driver, route }) => {
                const routeColor = getRouteColor(route.id);
                const driverFullName = `${driver.firstName} ${driver.lastName}`;
                
                // Ищем транспорт двумя способами: по vehicleId в маршруте или по assignedDriver
                let vehicle = null;
                if (route.vehicleId) {
                  vehicle = state.vehicles.find(v => v.id === route.vehicleId);
                }
                if (!vehicle) {
                  vehicle = state.vehicles.find(v => v.assignedDriver === driverFullName);
                }
                
                const gpsData = vehicle ? vehicleGPSData[vehicle.id] : null;
                const actualProgress = vehicle && isToday ? ActualRouteTrackingService.getRouteProgress(route.id, driver.id) : null;
                
                // Debug logging
                if (vehicle && isToday && !actualProgress) {
                  console.log(`🔍 Debug: Нет actualProgress для маршрута ${route.name}:`, {
                    routeId: route.id,
                    driverId: driver.id,
                    vehicleId: vehicle.id,
                    isToday,
                    driverFullName
                  });
                }
                
                return (
                  <div 
                    key={`${driver.id}-${route.id}`}
                    className="bg-white rounded-lg border p-3"
                    style={{ borderLeft: `4px solid ${routeColor}` }}
                  >
                    {/* Название маршрута */}
                    <div className="flex items-center space-x-2 mb-2">
                      <div 
                        className="w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: routeColor }}
                      >
                        <Map className="h-2 w-2 text-white" />
            </div>
                      <span className="text-sm font-medium" style={{ color: routeColor }}>
                        {route.name}
                  </span>
            </div>
          
                    {/* Водитель */}
                    <div className="text-xs text-gray-600 mb-1">
                      <span className="font-medium">Водитель:</span> {driver.firstName} {driver.lastName}
        </div>

                    {/* Транспорт */}
                    <div className="text-xs text-gray-600 mb-1">
                      <span className="font-medium">Транспорт:</span> {vehicle ? `${vehicle.name} ${vehicle.licensePlate ? `(${vehicle.licensePlate})` : ''}` : 'Не назначен'}
        </div>
                    
                    {/* Статус */}
                    <div className="text-xs">
                      <span className="font-medium">Статус:</span> {' '}
          {(() => {
                        if (!vehicle) {
                          return (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1"></span>
                              Транспорт не назначен
              </span>
                          );
                        }

                        if (!gpsData) {
                          return (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-red-100 text-red-700">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1"></span>
                              Нет GPS данных
              </span>
                          );
                        }

                        if (!actualProgress) {
                          return (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-700">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1"></span>
                              Отслеживание не начато
                      </span>
                          );
                        }

                        // Определяем текущий статус на основе фактического прогресса
                        const currentWarehouse = actualProgress.warehouseStatuses.find(ws => 
                          ws.status === 1 || ws.status === 2 || ws.status === 3
                        );

                        if (!currentWarehouse) {
                          const completedCount = actualProgress.warehouseStatuses.filter(ws => ws.status === 4).length;
                          const totalCount = actualProgress.warehouseStatuses.length;
                          
                          if (completedCount === totalCount) {
                            return (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-100 text-green-700">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1"></span>
                                Маршрут завершен
                    </span>
                            );
                          } else {
                            return (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-700">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1"></span>
                                Ожидание начала
                      </span>
                            );
                          }
                        }

                        // Получаем название текущего склада
                        const warehouse = state.warehouses.find(w => w.id === currentWarehouse.warehouseId);
                        const warehouseName = warehouse ? warehouse.name : 'Неизвестный склад';

                        // Определяем статус и цвет
                        const statusInfo = {
                          1: { text: `Едет к ${warehouseName}`, color: 'bg-blue-100 text-blue-700' },
                          2: { text: `На складе ${warehouseName}`, color: 'bg-green-100 text-green-700' },
                          3: { text: `Выезжает с ${warehouseName}`, color: 'bg-orange-100 text-orange-700' },
                        }[currentWarehouse.status] || { text: 'Неизвестный статус', color: 'bg-gray-100 text-gray-700' };

                        return (
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${statusInfo.color}`}>
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1"></span>
                            {statusInfo.text}
                    </span>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
                  </div>
            
            {dailyRoutes.length === 0 && (
              <div className="text-center py-8">
                <Map className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Нет маршрутов для отображения</p>
            </div>
          )}
        </div>
          </div>
        </div>
      
      <div className="mt-4 text-xs text-gray-500 text-center">
        🔄 GPS данные обновляются каждые 30 секунд автоматически
      </div>
    </div>
  );
};

const RequestsListView: React.FC = () => {
  const { state } = useAppContext();
  const [sortBy, setSortBy] = useState<'createdAt' | 'deadline' | 'status'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const getWarehouseName = (warehouseId: string) => {
    return state.warehouses.find(w => w.id === warehouseId)?.name || 'Неизвестный склад';
  };

  const getUserName = (userId: string) => {
    const user = state.users.find(u => u.id === userId);
    return user ? `${user.firstName} ${user.lastName}` : 'Неизвестный пользователь';
  };

  const getDriverName = (driverId?: string) => {
    if (!driverId) return 'Не назначен';
    const driver = state.users.find(u => u.id === driverId);
    return driver ? `${driver.firstName} ${driver.lastName}` : 'Неизвестный водитель';
  };

  const getRouteName = (routeId?: string) => {
    if (!routeId) return 'Не назначен';
    const route = state.routes.find(r => r.id === routeId);
    return route ? route.name : 'Неизвестный маршрут';
  };

  const getStatusLabel = (status: TransferStatus) => {
    const statusLabels = {
      created: 'Создана',
      in_progress: 'В процессе',
      received_by_driver: 'Получено водителем',
      delivered_to_warehouse: 'Передано на склад',
      completed: 'Завершена',
      cancelled: 'Отменена'
    };
    return statusLabels[status] || status;
  };

  const getStatusColor = (status: TransferStatus) => {
    const statusColors = {
      created: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      received_by_driver: 'bg-purple-100 text-purple-800',
      delivered_to_warehouse: 'bg-indigo-100 text-indigo-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  // Sort requests
  const sortedRequests = [...state.transferRequests].sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case 'createdAt':
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
        break;
      case 'deadline':
        aValue = new Date(a.deadline).getTime();
        bValue = new Date(b.deadline).getTime();
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
        break;
      default:
        return 0;
    }
    
    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Список всех заявок</h2>
        <div className="flex space-x-4">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="createdAt">По дате создания</option>
            <option value="deadline">По сроку выполнения</option>
            <option value="status">По статусу</option>
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="desc">По убыванию</option>
            <option value="asc">По возрастанию</option>
          </select>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  № Заявки
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Дата создания
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Создатель
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Позиции
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Откуда
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Куда
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Маршрут
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Водитель
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  История изменений
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedRequests.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    #{request.id.slice(-8).toUpperCase()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div>{format(new Date(request.createdAt), 'dd.MM.yyyy', { locale: ru })}</div>
                      <div className="text-gray-500">{format(new Date(request.createdAt), 'HH:mm', { locale: ru })}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getUserName(request.createdBy)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="max-w-xs">
                      {request.items.map((item, index) => (
                        <div key={index} className="truncate">
                          {item.name} - {item.quantity} шт.
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getWarehouseName(request.sourceWarehouse)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getWarehouseName(request.destinationWarehouse)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getRouteName(request.routeId)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getDriverName(request.assignedDriverId)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                      {getStatusLabel(request.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="max-w-xs">
                      {request.statusChangeLog && request.statusChangeLog.length > 0 ? (
                        <div className="space-y-1">
                          {request.statusChangeLog.slice(-3).map((log, index) => (
                            <div key={log.id} className="text-xs">
                              <div className="flex items-center space-x-2">
                                <span className="font-medium">{getStatusLabel(log.oldStatus)}</span>
                                <ArrowRight className="h-3 w-3" />
                                <span className="font-medium">{getStatusLabel(log.newStatus)}</span>
                              </div>
                              <div className="text-gray-500">
                                {getUserName(log.changedBy)} • {format(new Date(log.changedAt), 'dd.MM HH:mm', { locale: ru })}
                              </div>
                            </div>
                          ))}
                          {request.statusChangeLog.length > 3 && (
                            <div className="text-xs text-gray-400">
                              +{request.statusChangeLog.length - 3} еще...
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">Нет изменений</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
