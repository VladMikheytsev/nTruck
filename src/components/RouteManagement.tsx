import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Route, RouteStop } from '../types';
import RouteMapView from './RouteMapView';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Clock, 
  Save,
  Map,
  Building2,
  Printer,
  Settings,
  X,
  AlertCircle,
  User,
  Truck,
  Calendar,
  MapPin
} from 'lucide-react';
import WarehouseIcon from './WarehouseIcon';
import { RouteCalculationService } from '../services/routeCalculationService';
import { RouteAdjustmentService } from '../services/routeAdjustmentService';
import RouteAdjustmentModal from './RouteAdjustmentModal';
import { useGoogleMaps } from '../hooks/useGoogleMaps';

// Функция для получения названия дня недели
const getWeekdayName = (weekday: number | null | undefined): string => {
  if (weekday === null || weekday === undefined) return 'Любой день';
  
  const weekdays = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  return weekdays[weekday] || 'Неизвестно';
};

const RouteManagement: React.FC = () => {
  console.log('🚀 UPDATED VERSION: RouteManagement component loaded - Google Directions API enabled');
  const { state, dispatch } = useAppContext();
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [isCreatingRoute, setIsCreatingRoute] = useState(false);
  
  // Stop form state
  const [showStopForm, setShowStopForm] = useState(false);
  const [editingStop, setEditingStop] = useState<RouteStop | null>(null);
  const [stopFormMode, setStopFormMode] = useState<'create' | 'edit'>('create');
  const [isSaving, setIsSaving] = useState(false);
  
  // Force re-render when routes change
  const [forceUpdate, setForceUpdate] = useState(0);
  
  // Route adjustment state
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentRouteId, setAdjustmentRouteId] = useState<string>('');
  const [adjustmentStopId, setAdjustmentStopId] = useState<string>('');
  
  // Tab state for Route Management
  const [activeTab, setActiveTab] = useState<'routes' | 'route-map'>('routes');
  
  // Route Map state
  const [selectedRoutesForMap, setSelectedRoutesForMap] = useState<string[]>([]);
  const [timeSliderValue, setTimeSliderValue] = useState(390); // 390 minutes = 6:30 (start time)
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Loading state check
  if (!state.routes || !state.warehouses) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading route data...</p>
        </div>
      </div>
    );
  }

  const handleAddRoute = () => {
    setEditingRoute(null);
    setShowRouteForm(true);
  };

  const handleEditRoute = (route: Route) => {
    setEditingRoute(route);
    setShowRouteForm(true);
  };

  const handleDeleteRoute = (routeId: string) => {
    if (window.confirm('Are you sure you want to delete this route?')) {
      dispatch({ type: 'DELETE_ROUTE', payload: routeId });
      if (selectedRoute === routeId) {
        setSelectedRoute(null);
      }
    }
  };

  // Handle route adjustment
  const handleOpenAdjustment = (routeId: string, stopId: string) => {
    setAdjustmentRouteId(routeId);
    setAdjustmentStopId(stopId);
    setShowAdjustmentModal(true);
  };

  const handleCloseAdjustment = () => {
    setShowAdjustmentModal(false);
    setAdjustmentRouteId('');
    setAdjustmentStopId('');
  };

  const handleRouteUpdated = (updatedRoute: Route) => {
    dispatch({
      type: 'UPDATE_ROUTE',
      payload: updatedRoute
    });
    
    // Force re-render to show updated times
    setForceUpdate(prev => prev + 1);
  };

  const handleFormClose = () => {
    setShowRouteForm(false);
    setEditingRoute(null);
  };

  const handleRouteSave = async (route: Route) => {
    console.log('Saving route:', route);
    setIsCreatingRoute(true);
    
    try {
      if (editingRoute) {
        console.log('Updating existing route');
        dispatch({ type: 'UPDATE_ROUTE', payload: route });
      } else {
        console.log('Adding new route');
        dispatch({ type: 'ADD_ROUTE', payload: route });
        // Auto-select the newly created route
        setSelectedRoute(route.id);
      }
      handleFormClose();
      console.log('Routes after save:', state.routes.length);
    } catch (error) {
      console.error('Error saving route:', error);
    } finally {
      setIsCreatingRoute(false);
    }
  };

  // Stop management functions

  const handleEditStop = (stop: RouteStop) => {
    console.log('Editing stop:', stop);
    setStopFormMode('edit');
    setEditingStop(stop);
    setShowStopForm(true);
  };

  const handleDeleteStop = (stopId: string) => {
    if (!selectedRoute) return;
    
    if (window.confirm('Remove this stop from the route?')) {
      const currentRoute = state.routes.find(r => r.id === selectedRoute);
      if (currentRoute) {
        const updatedStops = currentRoute.stops.filter(s => s.id !== stopId);
        const updatedRoute = {
          ...currentRoute,
          stops: updatedStops,
          updatedAt: new Date(),
        };
        console.log('Deleting stop, updated route:', updatedRoute);
        dispatch({ type: 'UPDATE_ROUTE', payload: updatedRoute });
      }
    }
  };

  const handleStopSave = (stop: RouteStop) => {
    if (!selectedRoute) return;
    
    // Блокировка от двойного сохранения
    if (isSaving) {
      console.log('⚠️ Already saving, ignoring duplicate save request');
      return;
    }
    
    setIsSaving(true);
    
    console.log('🔄 handleStopSave called with:', {
      stopId: stop.id,
      stopWarehouse: stop.warehouseId,
      stopOrder: stop.order,
      editingStopId: editingStop?.id,
      isEditing: !!editingStop,
      selectedRoute: selectedRoute
    });
    
    // ВСЕГДА получаем СВЕЖИЕ данные маршрута
    const currentRoute = state.routes.find(r => r.id === selectedRoute);
    if (!currentRoute) {
      console.error('❌ Current route not found!');
      setIsSaving(false);
      return;
    }
    
    console.log('📊 CURRENT ROUTE BEFORE UPDATE:', {
      routeId: currentRoute.id,
      currentStopsCount: currentRoute.stops.length,
      currentStops: currentRoute.stops.map(s => ({ id: s.id, order: s.order, warehouse: s.warehouseId }))
    });
    
    let updatedStops;
    
    // ПРОСТАЯ ЛОГИКА: если это редактирование - обновляем, иначе ВСЕГДА добавляем
    if (editingStop && editingStop.id === stop.id) {
      console.log('✏️ EDITING existing stop');
      updatedStops = currentRoute.stops.map(s => s.id === stop.id ? stop : s);
    } else {
      console.log('➕ ADDING NEW STOP - ALWAYS ADD, NEVER REPLACE');
      updatedStops = [...currentRoute.stops, stop];
    }
    
    console.log('Updated stops count:', updatedStops.length);
    
    // Sort by order and normalize order numbers to avoid gaps
    updatedStops.sort((a, b) => a.order - b.order);
    
    // Normalize order numbers (1, 2, 3, ... without gaps)
    updatedStops = updatedStops.map((stop, index) => ({
      ...stop,
      order: index + 1
    }));
    
    console.log('📋 Normalized stop orders:', updatedStops.map(s => ({ id: s.id, order: s.order, warehouse: s.warehouseId })));
    
    const updatedRoute: Route = {
      id: currentRoute.id,
      name: currentRoute.name,
      weekday: currentRoute.weekday,
      isActive: currentRoute.isActive,
      stops: [...updatedStops], // Create new array
      createdAt: currentRoute.createdAt,
      updatedAt: new Date(),
    };
    
    console.log('🚀 BEFORE DISPATCH - Updated route:', {
      id: updatedRoute.id,
      stopsCount: updatedRoute.stops.length,
      stops: updatedRoute.stops.map(s => ({ id: s.id, warehouse: s.warehouseId, order: s.order }))
    });
    
    dispatch({ type: 'UPDATE_ROUTE', payload: updatedRoute });
    
    // Force re-render to ensure UI updates
    setForceUpdate(prev => prev + 1);
    
    // Log the state after dispatch to verify update
    setTimeout(() => {
      const updatedRouteFromState = state.routes.find(r => r.id === selectedRoute);
      console.log('🔍 AFTER DISPATCH - Route from state:', {
        id: updatedRouteFromState?.id,
        stopsCount: updatedRouteFromState?.stops.length,
        stops: updatedRouteFromState?.stops.map(s => ({ id: s.id, warehouse: s.warehouseId, order: s.order }))
      });
    }, 100);
    
    // Always close form after saving to prevent issues
    setShowStopForm(false);
    setEditingStop(null);
    setIsSaving(false); // Разблокировка
    
    console.log('🔄 handleStopSave completed:', {
      wasEditing: !!editingStop,
      formClosed: true,
      editingStopReset: true,
      finalStopsCount: updatedStops.length
    });
  };

  // Get assigned routes for selected date
  const getAssignedRoutesForDate = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    const drivers = state.users.filter(user => user.role === 'driver');
    const assignedRoutes: Route[] = [];

    drivers.forEach(driver => {
      const schedule = state.workSchedules.find(
        ws => ws.driverId === driver.id && ws.year === year && ws.month === month
      );
      
      if (schedule && schedule.schedule[day]) {
        const routeId = schedule.schedule[day];
        const route = state.routes.find(r => r.id === routeId);
        if (route) {
          assignedRoutes.push(route);
        }
      }
    });

    return assignedRoutes;
  };

  const assignedRoutes = getAssignedRoutesForDate(selectedDate);

  const getWarehouseName = (warehouseId: string) => {
    return state.warehouses.find(w => w.id === warehouseId)?.name || 'Unknown Warehouse';
  };

  const getWarehouseAddress = (warehouseId: string) => {
    return state.warehouses.find(w => w.id === warehouseId)?.fullAddress || 'Address not available';
  };

  const getWarehouseUnit = (warehouseId: string) => {
    return state.warehouses.find(w => w.id === warehouseId)?.unit || '';
  };

  const getWarehouseColor = (warehouseId: string) => {
    return state.warehouses.find(w => w.id === warehouseId)?.iconColor || '#3b82f6';
  };

  const getWarehouseInstructions = (warehouseId: string) => {
    return state.warehouses.find(w => w.id === warehouseId)?.instructions || '';
  };

  // ВСЕГДА получаем свежие данные маршрута из state
  const selectedRouteData = React.useMemo(() => {
    if (!selectedRoute) return null;
    const route = state.routes.find(r => r.id === selectedRoute);
    console.log('🔄 GETTING FRESH ROUTE DATA:', {
      selectedRouteId: selectedRoute,
      foundRoute: !!route,
      stopsCount: route?.stops.length || 0,
      stops: route?.stops.map(s => ({ id: s.id, warehouse: s.warehouseId, order: s.order })) || []
    });
    return route || null;
  }, [selectedRoute, state.routes, forceUpdate]);
  
  // Log selectedRouteData changes for debugging
  React.useEffect(() => {
    if (selectedRouteData) {
      console.log('🎯 selectedRouteData updated:', {
        id: selectedRouteData.id,
        name: selectedRouteData.name,
        stopsCount: selectedRouteData.stops.length,
        stops: selectedRouteData.stops.map(s => ({ id: s.id, warehouse: s.warehouseId, order: s.order })),
        forceUpdate: forceUpdate
      });
    }
  }, [selectedRouteData, forceUpdate]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Route Management</h1>
          <p className="text-gray-600 mt-1">Manage delivery routes and schedules</p>
        </div>
        <button
          onClick={handleAddRoute}
          className="btn-primary"
          disabled={isCreatingRoute}
        >
          {isCreatingRoute ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Creating...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Add Route
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('routes')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'routes'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Управление маршрутами
          </button>
          <button
            onClick={() => setActiveTab('route-map')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'route-map'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Карта маршрутов
          </button>
        </nav>
      </div>

      {/* Routes Tab Content */}
      {activeTab === 'routes' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Routes List */}
          <div className="lg:col-span-1">
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Routes</h3>
              <p className="text-sm text-gray-500">Total: {state.routes.length}</p>
            </div>
            
            <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
              {state.routes && state.routes.length > 0 ? state.routes.map((route) => (
                <div
                  key={route.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedRoute === route.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedRoute(route.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Map className="h-4 w-4 text-primary-600" />
                      <div>
                        <div className="font-medium text-gray-900">{route.name}</div>
                        <div className="text-xs text-gray-500 flex items-center space-x-1">
                          <span>{route.stops.length} stops</span>
                          {route.driverId && (
                            <>
                              <span>•</span>
                              <span className="text-blue-600">
                                {state.users.find(u => u.id === route.driverId)?.firstName} {state.users.find(u => u.id === route.driverId)?.lastName}
                              </span>
                            </>
                          )}
                          {route.vehicleId && (
                            <>
                              <span>•</span>
                              <span className="text-green-600">
                                🚚 {state.vehicles?.find(v => v.id === route.vehicleId)?.name || route.vehicleId}
                              </span>
                            </>
                          )}
                          {route.stops.length > 0 && (
                            <div className="flex space-x-1 ml-2">
                              {route.stops
                                .sort((a, b) => a.order - b.order)
                                .slice(0, 3)
                                .map((stop) => (
                                  <WarehouseIcon
                                    key={stop.id}
                                    name={getWarehouseName(stop.warehouseId)}
                                    color={getWarehouseColor(stop.warehouseId)}
                                    size="sm"
                                  />
                                ))}
                              {route.stops.length > 3 && (
                                <div className="w-4 h-4 bg-gray-300 rounded-full flex items-center justify-center text-xs text-gray-600">
                                  +{route.stops.length - 3}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditRoute(route);
                        }}
                        className="p-1 text-gray-400 hover:text-primary-600"
                      >
                        <Edit className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRoute(route.id);
                        }}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-xs text-gray-500 mt-1 truncate">{getWeekdayName(route.weekday)}</p>
                </div>
              )) : (
                <div className="text-center py-8">
                  <Map className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No routes available</p>
                  <p className="text-gray-400 text-xs">Create your first route to get started</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Timeline View */}
        <div className="lg:col-span-2">
          {selectedRouteData ? (
            <RouteTimeline
              key={`${selectedRouteData.id}-${selectedRouteData.stops.length}-${forceUpdate}`}
              route={selectedRouteData}
              warehouses={state.warehouses}
              getWarehouseName={getWarehouseName}
              getWarehouseAddress={getWarehouseAddress}
              getWarehouseUnit={getWarehouseUnit}
              getWarehouseColor={getWarehouseColor}
              getWarehouseInstructions={getWarehouseInstructions}
              onEditStop={handleEditStop}
              onDeleteStop={handleDeleteStop}
              onOpenAdjustment={handleOpenAdjustment}
            />
          ) : (
            <div className="card p-12 text-center">
              <Map className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Route</h3>
              <p className="text-gray-500">Choose a route from the list to view and edit its timeline</p>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Route Map Tab Content */}
      {activeTab === 'route-map' && (
        <RouteMapView 
          routes={state.routes}
          warehouses={state.warehouses}
          selectedRoutes={selectedRoutesForMap}
          onRouteSelectionChange={setSelectedRoutesForMap}
          timeSliderValue={timeSliderValue}
          onTimeSliderChange={setTimeSliderValue}
          assignedRoutes={assignedRoutes}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
        />
      )}

      {/* Route Form Modal */}
      {showRouteForm && (
        <RouteForm
          route={editingRoute}
          warehouses={state.warehouses}
          onClose={handleFormClose}
          onSave={handleRouteSave}
        />
      )}

      {/* Stop Form Modal */}
      {showStopForm && selectedRoute && (
        <StopForm
          stop={editingStop}
          route={state.routes.find(r => r.id === selectedRoute)!} // Always get fresh route data
          warehouses={state.warehouses}
          mode={stopFormMode}
          onClose={() => {
            console.log('🚪 Closing stop form and resetting state');
            setShowStopForm(false);
            setEditingStop(null);
            console.log('✅ Form closed, editingStop reset to null');
          }}
          onSave={handleStopSave}
        />
      )}
    </div>
  );
};

interface RouteTimelineProps {
  route: Route;
  warehouses: any[];
  getWarehouseName: (id: string) => string;
  getWarehouseAddress: (id: string) => string;
  getWarehouseUnit: (id: string) => string;
  getWarehouseColor: (id: string) => string;
  getWarehouseInstructions: (id: string) => string;
  onEditStop: (stop: RouteStop) => void;
  onDeleteStop: (stopId: string) => void;
  onOpenAdjustment: (routeId: string, stopId: string) => void;
}

const RouteTimeline: React.FC<RouteTimelineProps> = ({ 
  route,
  warehouses,
  getWarehouseName,
  getWarehouseAddress,
  getWarehouseUnit,
  getWarehouseColor,
  getWarehouseInstructions,
  onEditStop,
  onDeleteStop,
  onOpenAdjustment
}) => {
  
  // Log route data for debugging
  console.log('🎯 RouteTimeline rendering with route:', {
    id: route.id,
    name: route.name,
    stopsCount: route.stops.length,
    stops: route.stops.map(s => ({ id: s.id, warehouse: getWarehouseName(s.warehouseId), order: s.order }))
  });

  // Print route schedule function
  const handlePrintRoute = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const sortedStops = route.stops.sort((a, b) => a.order - b.order);
    
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>График маршрута - ${route.name}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #333;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #333;
              padding-bottom: 20px;
            }
            .route-title {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .route-description {
              font-size: 14px;
              color: #666;
            }
            .stops-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            .stops-table th,
            .stops-table td {
              border: 1px solid #ddd;
              padding: 12px;
              text-align: left;
            }
            .stops-table th {
              background-color: #f5f5f5;
              font-weight: bold;
            }
            .stop-order {
              text-align: center;
              font-weight: bold;
              width: 60px;
            }
            .warehouse-name {
              font-weight: bold;
            }
            .warehouse-address {
              font-size: 12px;
              color: #666;
            }
            .warehouse-unit {
              font-size: 12px;
              color: #0066cc;
              font-weight: bold;
            }
            .time {
              font-family: monospace;
              font-weight: bold;
            }
            .print-date {
              text-align: right;
              margin-top: 30px;
              font-size: 12px;
              color: #666;
            }
            @media print {
              body { margin: 0; }
              .header { page-break-after: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="route-title">${route.name}</div>
            <div class="route-description">${getWeekdayName(route.weekday)}</div>
          </div>
          
          <table class="stops-table">
            <thead>
              <tr>
                <th class="stop-order">#</th>
                <th>Склад</th>
                <th>Адрес</th>
                <th>Инструкции</th>
                <th>Время прибытия</th>
                <th>Время отправления</th>
              </tr>
            </thead>
            <tbody>
              ${sortedStops.map(stop => `
                <tr>
                  <td class="stop-order">${stop.order}</td>
                  <td>
                    <div class="warehouse-name">${getWarehouseName(stop.warehouseId)}</div>
                    ${getWarehouseUnit(stop.warehouseId) ? `<div class="warehouse-unit">UNIT: ${getWarehouseUnit(stop.warehouseId)}</div>` : ''}
                    ${stop.hasLunch && stop.lunchDuration ? `<div class="lunch-info" style="color: #ea580c; font-weight: 500; margin-top: 4px;">🍽️ Обед: ${stop.lunchDuration} минут</div>` : ''}
                  </td>
                  <td class="warehouse-address">${getWarehouseAddress(stop.warehouseId)}</td>
                  <td class="warehouse-address">${getWarehouseInstructions(stop.warehouseId) || '-'}</td>
                  <td class="time">${stop.arrivalTime}</td>
                  <td class="time">${stop.departureTime}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="print-date">
            Распечатано: ${new Date().toLocaleString('ru-RU')}
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="card">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">{route.name}</h3>
            <p className="text-sm text-gray-500">{getWeekdayName(route.weekday)}</p>
          </div>
          
          {/* Print Button */}
          {route.stops.length > 0 && (
            <button
              onClick={handlePrintRoute}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
              title="Распечатать график маршрута"
            >
              <Printer className="h-4 w-4 mr-2" />
              Распечатать график
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        {/* Route Stops - Simple List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-gray-900">Route Stops</h4>
          </div>
          
          {/* Простой список остановок */}
          <div className="space-y-2">
            {route.stops
              .sort((a, b) => a.order - b.order)
              .map((stop, index) => (
                <StopItem
                  key={`${stop.id}-${index}`}
                  stop={stop}
                  getWarehouseName={getWarehouseName}
                  getWarehouseAddress={getWarehouseAddress}
                  getWarehouseUnit={getWarehouseUnit}
                  getWarehouseColor={getWarehouseColor}
                  getWarehouseInstructions={getWarehouseInstructions}
                  onEdit={onEditStop}
                  onDelete={onDeleteStop}
                  onAdjust={(stopId) => onOpenAdjustment(route.id, stopId)}
                  routeId={route.id}
                />
              ))}
            
            {/* Inline форма добавления новой остановки */}
            <InlineStopForm
              route={route}
              warehouses={warehouses}
              onAdd={() => {}} // Не используется, логика внутри компонента
            />
          </div>
        </div>

      </div>

    </div>
  );
};

// Компонент выбора дня недели
interface WeekdayPickerProps {
  selectedWeekday: number | null;
  onWeekdayChange: (weekday: number | null) => void;
}

const WeekdayPicker: React.FC<WeekdayPickerProps> = ({ selectedWeekday, onWeekdayChange }) => {
  const weekdays = [
    { value: 1, label: 'Пн', fullName: 'Понедельник' },
    { value: 2, label: 'Вт', fullName: 'Вторник' },
    { value: 3, label: 'Ср', fullName: 'Среда' },
    { value: 4, label: 'Чт', fullName: 'Четверг' },
    { value: 5, label: 'Пт', fullName: 'Пятница' },
    { value: 6, label: 'Сб', fullName: 'Суббота' },
    { value: 0, label: 'Вс', fullName: 'Воскресенье' },
  ];

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        День недели
      </label>
      <div className="flex space-x-2 overflow-x-auto pb-2">
        {/* Кнопка "Не выбран" */}
        <button
          type="button"
          onClick={() => onWeekdayChange(null)}
          className={`flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            selectedWeekday === null
              ? 'bg-gray-500 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Любой
        </button>
        
        {/* Дни недели */}
        {weekdays.map((day) => (
          <button
            key={day.value}
            type="button"
            onClick={() => onWeekdayChange(day.value)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedWeekday === day.value
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-blue-100'
            }`}
            title={day.fullName}
          >
            {day.label}
          </button>
        ))}
      </div>
    </div>
  );
};

interface RouteFormProps {
  route: Route | null;
  warehouses: any[];
  onClose: () => void;
  onSave: (route: Route) => void;
}

const RouteForm: React.FC<RouteFormProps> = ({ route, onClose, onSave }) => {
  const { state } = useAppContext();
  const [formData, setFormData] = useState({
    name: route?.name || '',
    weekday: route?.weekday ?? null,
    driverId: route?.driverId || '',
    vehicleId: route?.vehicleId || '',
    isActive: route?.isActive ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newRoute: Route = {
      id: route?.id || `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...formData,
      stops: route?.stops || [],
      createdAt: route?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    onSave(newRoute);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {route ? 'Edit Route' : 'Add Route'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Route Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="input"
              placeholder="e.g., NYC Morning Route"
              required
            />
          </div>

          <WeekdayPicker
            selectedWeekday={formData.weekday}
            onWeekdayChange={(weekday) => setFormData(prev => ({ ...prev, weekday }))}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Водитель (опционально)
            </label>
            <select
              value={formData.driverId}
              onChange={(e) => setFormData(prev => ({ ...prev, driverId: e.target.value }))}
              className="input"
            >
              <option value="">Не назначен</option>
              {state.users.filter(user => user.role === 'driver').map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.firstName} {driver.lastName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Транспорт (опционально)
            </label>
            <select
              value={formData.vehicleId}
              onChange={(e) => setFormData(prev => ({ ...prev, vehicleId: e.target.value }))}
              className="input"
            >
              <option value="">Не назначен</option>
              {state.vehicles && state.vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.name} ({vehicle.licensePlate || vehicle.id})
                  {vehicle.assignedDriver && ` - ${vehicle.assignedDriver}`}
                </option>
              ))}
            </select>
            {formData.vehicleId && (
              <div className="mt-2 text-xs text-gray-600">
                {(() => {
                  const selectedVehicle = state.vehicles?.find(v => v.id === formData.vehicleId);
                  if (selectedVehicle) {
                    return (
                      <div className="bg-gray-50 p-2 rounded">
                        <p><strong>Транспорт:</strong> {selectedVehicle.name}</p>
                        {selectedVehicle.licensePlate && (
                          <p><strong>Номер:</strong> {selectedVehicle.licensePlate}</p>
                        )}
                        {selectedVehicle.assignedDriver && (
                          <p><strong>Назначенный водитель:</strong> {selectedVehicle.assignedDriver}</p>
                        )}
                        {selectedVehicle.speedLimit && (
                          <p><strong>Ограничение скорости:</strong> {selectedVehicle.speedLimit} mph</p>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
              Active route
            </label>
          </div>

          <div className="flex space-x-3 pt-4">
            <button type="submit" className="btn-primary flex-1">
              <Save className="h-4 w-4 mr-2" />
              {route ? 'Update' : 'Create'} Route
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface StopFormProps {
  stop: RouteStop | null;
  route: Route;
  warehouses: any[];
  mode: 'create' | 'edit';
  onClose: () => void;
  onSave: (stop: RouteStop) => void;
}

const StopForm: React.FC<StopFormProps> = ({ stop, route, warehouses, mode, onClose, onSave }) => {
  const { state } = useAppContext();
  const { isLoaded: isGoogleMapsLoaded, error: googleMapsError } = useGoogleMaps();
  
  // Debug logging
  console.log('📝 StopForm initialized with:', {
    stop: stop,
    stopId: stop?.id,
    isEditing: !!stop,
    mode,
    routeStopsCount: route.stops.length,
    calculatedOrder: route.stops.length + 1,
    timestamp: Date.now()
  });
  
  const [formData, setFormData] = useState({
    warehouseId: stop?.warehouseId || '',
    arrivalTime: stop?.arrivalTime || '08:00',
    departureTime: stop?.departureTime || '09:00',
    order: stop?.order || (route.stops.length > 0 ? Math.max(...route.stops.map(s => s.order)) + 1 : 1),
  });
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationInfo, setCalculationInfo] = useState<string>('');

  // Memoize current warehouse to detect changes
  const currentWarehouse = useMemo(() => 
    state.warehouses.find(w => w.id === formData.warehouseId), 
    [state.warehouses, formData.warehouseId]
  );

  // Effect to detect warehouse traffic scenario changes
  useEffect(() => {
    if (formData.warehouseId && currentWarehouse) {
      console.log('🔄 StopForm: Warehouse data updated for:', {
        warehouseId: formData.warehouseId,
        warehouseName: currentWarehouse.name,
        trafficScenario: currentWarehouse.trafficScenario
      });
      
      // Show notification if calculation info exists
      if (calculationInfo && !isCalculating) {
        const scenarioDisplayName = {
          'pessimistic': 'Пессимистический',
          'optimistic': 'Оптимистический', 
          'best_guess': 'Лучший прогноз'
        }[currentWarehouse.trafficScenario] || 'Неизвестный';
        
        setCalculationInfo(`ℹ️ Настройки склада обновлены. Текущий сценарий: ${scenarioDisplayName}. Пересчитайте маршрут для применения изменений.`);
      }
    }
  }, [currentWarehouse?.trafficScenario, formData.warehouseId, calculationInfo, isCalculating]);

  // Initialize form only when stop or mode changes (NOT when route.stops.length changes)
  React.useEffect(() => {
    console.log('StopForm initialized with:', {
      stop: stop,
      routeStopsLength: route.stops.length,
      calculatedOrder: route.stops.length + 1,
      isEditing: !!stop,
      mode
    });
    
    // Only reset form data when switching between edit/create modes or changing the stop being edited
    if (mode === 'edit' && stop) {
      // Editing existing stop - populate with stop data
      setFormData({
        warehouseId: stop.warehouseId || '',
        arrivalTime: stop.arrivalTime || '08:00',
        departureTime: stop.departureTime || '09:00',
        order: stop.order || (route.stops.length > 0 ? Math.max(...route.stops.map(s => s.order)) + 1 : 1),
      });
    } else if (mode === 'create' && !stop) {
      // Creating new stop - only reset if form is completely empty
      setFormData(prevData => ({
        warehouseId: prevData.warehouseId || '', // Keep selected warehouse
        arrivalTime: prevData.arrivalTime || '08:00',
        departureTime: prevData.departureTime || '09:00',
        order: route.stops.length > 0 ? Math.max(...route.stops.map(s => s.order)) + 1 : 1, // Update order based on current stops count
      }));
    }
    
    setCalculationInfo('');
  }, [stop, mode]); // Removed route.stops.length from dependencies

  // Auto-calculate times when warehouse is selected  
  const handleWarehouseChange = async (warehouseId: string) => {
    console.log('🔄 NEW VERSION: handleWarehouseChange called with:', warehouseId);
    
    // Update warehouse in form data
    setFormData(prev => ({ ...prev, warehouseId }));
    
    if (!warehouseId) {
      setCalculationInfo('');
      return;
    }
    
    const selectedWarehouse = warehouses.find(w => w.id === warehouseId);
    if (!selectedWarehouse) return;

    // Get the most current route data to ensure we have latest stops
    const currentRouteFromState = state.routes.find(r => r.id === route.id);
    const currentStops = currentRouteFromState ? currentRouteFromState.stops : route.stops;
    
    console.log('handleWarehouseChange - Route analysis:', {
      routeId: route.id,
      routeName: route.name,
      propStopsCount: route.stops.length,
      stateStopsCount: currentStops.length,
      propStops: route.stops,
      stateStops: currentStops,
      selectedWarehouse: selectedWarehouse.name
    });
    
    // Calculate arrival time using Google Directions API
    if (!isGoogleMapsLoaded) {
      if (googleMapsError) {
        setCalculationInfo('Google Maps API unavailable - please set arrival time manually');
      } else {
        setCalculationInfo('Loading Google Maps API...');
      }
      return;
    }
    
    setIsCalculating(true);
    setCalculationInfo('Calculating arrival time using Google Directions API...');
    
    try {
      // If no previous stops, just clear calculation info and let user set times manually
      if (currentStops.length === 0) {
        setCalculationInfo('No previous stops - set arrival and departure times manually');
        setIsCalculating(false);
        return;
      }
      
      const lastStop = currentStops
        .sort((a, b) => a.order - b.order)
        .pop();
      
      if (lastStop) {
        const previousWarehouse = warehouses.find(w => w.id === lastStop.warehouseId);
        
        if (previousWarehouse) {
          // Prepare clean addresses for Google API
          const originAddress = `${previousWarehouse.fullAddress}${previousWarehouse.unit ? `, ${previousWarehouse.unit}` : ''}`;
          const destinationAddress = `${selectedWarehouse.fullAddress}${selectedWarehouse.unit ? `, ${selectedWarehouse.unit}` : ''}`;
          
          // Validate addresses before API call
          if (!originAddress.trim() || !destinationAddress.trim()) {
            setCalculationInfo('❌ Invalid warehouse addresses - please check warehouse data');
            setIsCalculating(false);
            return;
          }
          
          // Get destination warehouse traffic scenario
          const trafficScenario = selectedWarehouse.trafficScenario || 'best_guess';
          
          const scenarioMap = {
            'pessimistic': 'Пессимистический',
            'optimistic': 'Оптимистический', 
            'best_guess': 'Лучший прогноз'
          } as const;
          const scenarioDisplayName = scenarioMap[trafficScenario as keyof typeof scenarioMap] || 'Неизвестный';
          
          // Convert departure time to actual departure Date object
          const [prevDepHour, prevDepMinute] = lastStop.departureTime.split(':').map(Number);
          const departureDateTime = new Date();
          departureDateTime.setHours(prevDepHour, prevDepMinute, 0, 0);
          
          console.log('🚗 Расчет точного маршрута с учетом сценария склада:', {
            origin: originAddress,
            destination: destinationAddress,
            departureTime: departureDateTime.toLocaleString(),
            previousDeparture: lastStop.departureTime,
            destinationWarehouse: selectedWarehouse.name,
            trafficScenario,
            scenarioDisplayName,
            isScenarioFromWarehouse: !!selectedWarehouse.trafficScenario
          });
          
          // Get vehicle speed limit if driver is assigned to route
          let vehicleSpeedLimit: number | undefined;
          if (route.driverId) {
            const driver = state.users.find(u => u.id === route.driverId);
            const driverFullName = driver ? `${driver.firstName} ${driver.lastName}` : '';
            const assignedVehicle = state.vehicles.find(v => v.assignedDriver === driverFullName);
            vehicleSpeedLimit = assignedVehicle?.speedLimit;
            
            console.log('🚗 Vehicle speed limit lookup (StopForm):', {
              routeDriverId: route.driverId,
              driverName: driverFullName,
              assignedVehicle: assignedVehicle?.name,
              speedLimit: vehicleSpeedLimit,
              allVehicles: state.vehicles.map(v => ({ name: v.name, driver: v.assignedDriver, speedLimit: v.speedLimit }))
            });
            
            if (!assignedVehicle) {
              console.warn('⚠️ No vehicle found for driver:', driverFullName);
            } else if (!vehicleSpeedLimit) {
              console.warn('⚠️ Vehicle found but no speed limit set:', assignedVehicle.name);
            } else {
              console.log('✅ Using vehicle speed limit:', vehicleSpeedLimit, 'mph for vehicle:', assignedVehicle.name);
            }
          } else {
            console.log('ℹ️ No driver assigned to route, using default traffic calculation');
          }

          // Calculate travel time using Google Directions API with route weekday, warehouse scenario, and vehicle speed
          const routeResult = await RouteCalculationService.calculateTravelTimeForRoute(
            originAddress,
            destinationAddress,
            route.weekday ?? undefined, // Pass the route's weekday for accurate traffic calculation
            departureDateTime, // Use exact departure time from previous stop
            trafficScenario, // Pass the destination warehouse's traffic scenario
            vehicleSpeedLimit // Pass the vehicle's speed limit
          );
          
          if (routeResult) {
            // Calculate exact arrival time: departure time + travel time
            const arrivalDateTime = new Date(departureDateTime.getTime() + routeResult.travelTimeMinutes * 60 * 1000);
            
            // Ensure arrival time is within working hours (07:00 - 20:00)
            if (arrivalDateTime.getHours() < 7) {
              arrivalDateTime.setHours(7, 0, 0, 0);
            } else if (arrivalDateTime.getHours() >= 20) {
              arrivalDateTime.setHours(19, 59, 0, 0);
            }
            
            const arrivalTimeStr = `${arrivalDateTime.getHours().toString().padStart(2, '0')}:${arrivalDateTime.getMinutes().toString().padStart(2, '0')}`;
            
            console.log('📍 Arrival time calculated:', {
              previousDeparture: lastStop.departureTime,
              travelTimeMinutes: routeResult.travelTimeMinutes,
              calculatedArrival: arrivalTimeStr,
              distance: routeResult.distance,
              duration: routeResult.duration
            });
            
            // Set calculated arrival time
            setFormData(prev => ({
              ...prev,
              arrivalTime: arrivalTimeStr,
            }));
            
            const scenarioExplanation = RouteCalculationService.explainTrafficScenarioSelection(
              trafficScenario,
              departureDateTime
            );
            
            setCalculationInfo(`🎯 Arrival calculated: ${arrivalTimeStr} (Travel: ${routeResult.duration}, Distance: ${routeResult.distance}). ${scenarioExplanation}. Set departure time manually.`);
          } else {
            setCalculationInfo('❌ Could not calculate travel time - please set arrival time manually');
          }
        }
      } else {
        setCalculationInfo('No previous stop found - set arrival and departure times manually');
      }
    } catch (error) {
      console.error('Error calculating arrival time:', error);
      setCalculationInfo('Error calculating arrival time - please set manually');
    }
    
    setIsCalculating(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Generate truly unique ID with timestamp and random component
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substr(2, 9);
    const generatedId = `stop_${timestamp}_${randomPart}`;
    const stopId = mode === 'edit' && stop?.id ? stop.id : generatedId;
    
    console.log('💾 StopForm handleSubmit:', {
      isEditing: mode === 'edit',
      existingStopId: mode === 'edit' ? stop?.id : undefined,
      generatedId: generatedId,
      finalId: stopId,
      formData: formData,
      shouldBeNewStop: mode === 'create'
    });
    
    const newStop: RouteStop = {
      id: stopId,
      ...formData,
    };

    console.log('📦 Created stop object:', {
      id: newStop.id,
      warehouseId: newStop.warehouseId,
      order: newStop.order,
      arrivalTime: newStop.arrivalTime,
      departureTime: newStop.departureTime
    });
    
    // Check for duplicate warehouse in the same route (only for new stops)
    if (mode === 'create') {
      const existingWarehouseStop = route.stops.find(s => s.warehouseId === newStop.warehouseId);
      if (existingWarehouseStop) {
        alert(`Warehouse "${warehouses.find(w => w.id === newStop.warehouseId)?.name}" is already added to this route at stop #${existingWarehouseStop.order}. Please select a different warehouse.`);
        return;
      }
    }
    
    onSave(newStop);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {stop ? 'Edit Stop' : 'Add Stop'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Warehouse
            </label>
            <select
              value={formData.warehouseId}
              onChange={(e) => handleWarehouseChange(e.target.value)}
              className="input"
              required
            >
              <option value="">Select warehouse...</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
            
            {/* Time Planning Status */}
            {calculationInfo && (
              <div className={`mt-2 p-2 rounded text-xs ${
                isCalculating
                  ? 'bg-blue-50 text-blue-700'
                  : calculationInfo.includes('❌') || calculationInfo.includes('unavailable')
                    ? 'bg-yellow-50 text-yellow-700'
                    : calculationInfo.includes('First stop')
                      ? 'bg-purple-50 text-purple-700'
                      : calculationInfo.includes('🎯')
                        ? 'bg-green-50 text-green-700'
                        : 'bg-blue-50 text-blue-700'
              }`}>
                {isCalculating ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                    <span>{calculationInfo}</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Clock className="h-3 w-3" />
                    <span>{calculationInfo}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Arrival Time
                <span className="text-xs text-blue-600 ml-1">(Auto-calculated if previous stops exist)</span>
              </label>
              <input
                type="time"
                min="07:00"
                max="20:00"
                value={formData.arrivalTime}
                onChange={(e) => setFormData(prev => ({ ...prev, arrivalTime: e.target.value }))}
                className="input"
                required
                disabled={isCalculating}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Departure Time
                <span className="text-xs text-green-600 ml-1">(Manual entry)</span>
              </label>
              <input
                type="time"
                min="07:00"
                max="20:00"
                value={formData.departureTime}
                onChange={(e) => setFormData(prev => ({ ...prev, departureTime: e.target.value }))}
                className="input"
                required
              />
            </div>
          </div>

          {/* Smart Time Calculation Info */}
          <div className="p-3 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-200">
            <h5 className="text-sm font-medium text-gray-700 mb-2">Smart Time Planning:</h5>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• <strong className="text-blue-600">Arrival time:</strong> Auto-calculated using Google Directions API when possible</li>
              <li>• <strong className="text-green-600">Departure time:</strong> Always set manually based on your requirements</li>
              <li>• Travel time includes traffic conditions and 15% buffer for delays</li>
              <li>• You can adjust calculated arrival time if needed</li>
              <li>• Choose realistic times within working hours (07:00 - 20:00)</li>
            </ul>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stop Order
            </label>
            <input
              type="number"
              min="1"
              value={formData.order}
              onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 1 }))}
              className="input"
              required
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button type="submit" className="btn-primary flex-1">
              <Save className="h-4 w-4 mr-2" />
              {stop ? 'Update' : 'Add'} Stop
            </button>
            {!stop && (
              <button
                type="button"
                onClick={() => {
                  // Clear form for next stop but keep it open
                  setFormData({
                    warehouseId: '',
                    arrivalTime: '08:00',
                    departureTime: '09:00',
                    order: route.stops.length > 0 ? Math.max(...route.stops.map(s => s.order)) + 1 : 1, // Next order number
                  });
                  setCalculationInfo('');
                }}
                className="btn-secondary flex-1"
              >
                Clear Form
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              {stop ? 'Cancel' : 'Close'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Простой компонент отображения остановки
interface StopItemProps {
  stop: RouteStop;
  getWarehouseName: (id: string) => string;
  getWarehouseAddress: (id: string) => string;
  getWarehouseUnit: (id: string) => string;
  getWarehouseColor: (id: string) => string;
  getWarehouseInstructions: (id: string) => string;
  onEdit: (stop: RouteStop) => void;
  onDelete: (stopId: string) => void;
  onAdjust?: (stopId: string) => void;
  routeId?: string;
}

const StopItem: React.FC<StopItemProps> = ({ 
  stop, 
  getWarehouseName, 
  getWarehouseAddress, 
  getWarehouseUnit, 
  getWarehouseColor, 
  getWarehouseInstructions,
  onEdit, 
  onDelete,
  onAdjust,
  routeId
}) => (
  <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
    <div className="flex items-center justify-between">
      {/* Left side: Icon + Info */}
      <div className="flex items-center space-x-3">
        <div className="relative flex-shrink-0">
          <WarehouseIcon
            name={getWarehouseName(stop.warehouseId)}
            color={getWarehouseColor(stop.warehouseId)}
            size="md"
          />
          <div className="absolute -top-1 -left-1 w-5 h-5 bg-gray-800 text-white rounded-full flex items-center justify-center text-xs font-bold">
            {stop.order}
          </div>
        </div>
        
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-gray-900 text-base">
            {getWarehouseName(stop.warehouseId)}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {getWarehouseAddress(stop.warehouseId)}
          </div>
          {getWarehouseInstructions(stop.warehouseId) && (
            <div className="text-xs text-orange-700 mt-1 italic">
              📋 {getWarehouseInstructions(stop.warehouseId)}
            </div>
          )}
          {getWarehouseUnit(stop.warehouseId) && (
            <div className="text-sm font-medium text-blue-600 mt-1">
              UNIT: {getWarehouseUnit(stop.warehouseId)}
            </div>
          )}
          {stop.hasLunch && stop.lunchDuration && (
            <div className="text-sm font-medium text-orange-600 mt-1 bg-orange-50 px-2 py-1 rounded">
              🍽️ Обед: {stop.lunchDuration} минут
            </div>
          )}
        </div>
      </div>
      
      {/* Right side: Times + Actions */}
      <div className="flex items-center space-x-6">
        <div className="text-right w-48 flex-shrink-0">
          <div className="flex items-center justify-end space-x-2 text-sm text-gray-600 mb-1">
            <Clock className="h-4 w-4" />
            <span>Arrival: <span className="font-mono font-semibold text-gray-900">{stop.arrivalTime}</span></span>
          </div>
          <div className="flex items-center justify-end space-x-2 text-sm text-gray-600">
            <Clock className="h-4 w-4" />
            <span>Departure: <span className="font-mono font-semibold text-gray-900">{stop.departureTime}</span></span>
          </div>
        </div>
        
        <div className="flex items-center space-x-1 w-32 flex-shrink-0">
          <button
            onClick={() => onEdit(stop)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Редактировать остановку"
          >
            <Edit className="h-4 w-4" />
          </button>
          {onAdjust && (
            <button
              onClick={() => onAdjust(stop.id)}
              className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
              title="Скорректировать время прибытия"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => onDelete(stop.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Удалить остановку"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          
          {/* Adjustment History Indicator */}
          {routeId && RouteAdjustmentService.hasAdjustments(routeId) && 
           RouteAdjustmentService.getLatestStopAdjustment(routeId, stop.id) && (
            <div className="ml-2 px-1 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded flex items-center space-x-1">
              <AlertCircle className="h-3 w-3" />
              <span>Скорр.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);

// Простая inline форма добавления остановки
interface InlineStopFormProps {
  route: Route;
  warehouses: any[];
  onAdd: (stop: RouteStop) => void;
}

const InlineStopForm: React.FC<InlineStopFormProps> = ({ route, warehouses }) => {
  const { state, dispatch } = useAppContext();
  const { isLoaded: isGoogleMapsLoaded, error: googleMapsError } = useGoogleMaps();
  const [isAdding, setIsAdding] = useState(false);
  const [warehouseId, setWarehouseId] = useState('');
  const [arrivalTime, setArrivalTime] = useState('08:00');
  const [departureTime, setDepartureTime] = useState('09:00');
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationInfo, setCalculationInfo] = useState<string>('');
  const [hasLunch, setHasLunch] = useState(false);
  const [lunchDuration, setLunchDuration] = useState(30); // По умолчанию 30 минут

  // Memoize current warehouse to detect changes
  const currentWarehouse = useMemo(() => 
    state.warehouses.find(w => w.id === warehouseId), 
    [state.warehouses, warehouseId]
  );

  // Effect to detect warehouse traffic scenario changes and show notification
  useEffect(() => {
    if (warehouseId && currentWarehouse) {
      console.log('🔄 Warehouse data updated for:', {
        warehouseId,
        warehouseName: currentWarehouse.name,
        trafficScenario: currentWarehouse.trafficScenario,
        timestamp: new Date().toISOString()
      });
      
      // Update calculation info to reflect current warehouse scenario
      if (calculationInfo && !isCalculating) {
        const scenarioDisplayName = {
          'pessimistic': 'Пессимистический',
          'optimistic': 'Оптимистический', 
          'best_guess': 'Лучший прогноз'
        }[currentWarehouse.trafficScenario] || 'Неизвестный';
        
        setCalculationInfo(prev => {
          // Always update if the scenario info is present
          if (prev.includes('сценарий') || prev.includes('Пересчитайте')) {
            return `ℹ️ Настройки склада обновлены. Текущий сценарий: ${scenarioDisplayName}. Пересчитайте маршрут для применения изменений.`;
          }
          return prev;
        });
      }
    }
  }, [currentWarehouse?.trafficScenario, currentWarehouse?.name, warehouseId]); // React to any warehouse changes

  // Helper functions

  // Функция для расчета departure time с учетом обеда
  const calculateDepartureTime = (arrival: string, hasLunchBreak: boolean, lunchMinutes: number) => {
    const [arrHour, arrMinute] = arrival.split(':').map(Number);
    const arrivalDateTime = new Date();
    arrivalDateTime.setHours(arrHour, arrMinute, 0, 0);
    
    let totalMinutes;
    
    if (hasLunchBreak) {
      // Если есть обед, то Departure = Arrival + время обеда
      totalMinutes = lunchMinutes;
    } else {
      // Если нет обеда, то базовое время на складе: 30 минут
      totalMinutes = 30;
    }
    
    const departureDateTime = new Date(arrivalDateTime);
    departureDateTime.setMinutes(departureDateTime.getMinutes() + totalMinutes);
    
    return departureDateTime.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  // Auto-calculate arrival time when warehouse is selected
  const handleWarehouseChange = async (selectedWarehouseId: string) => {
    setWarehouseId(selectedWarehouseId);
    
    if (!selectedWarehouseId) {
      setCalculationInfo('');
      return;
    }

    // Force refresh warehouse data to ensure we have the latest information
    console.log('🔄 handleWarehouseChange: Ensuring fresh warehouse data for:', selectedWarehouseId);
    
    // Validate that the warehouse exists in current state
    const freshWarehouse = state.warehouses.find(w => w.id === selectedWarehouseId);
    if (!freshWarehouse) {
      console.error('❌ Warehouse not found in current state:', selectedWarehouseId);
      setCalculationInfo('❌ Выбранный склад не найден. Обновите страницу.');
      return;
    }

    console.log('✅ Fresh warehouse data confirmed:', {
      id: freshWarehouse.id,
      name: freshWarehouse.name,
      trafficScenario: freshWarehouse.trafficScenario,
      lastUpdated: new Date().toISOString()
    });

    // Get current stops (fresh from route)
    const currentStops = route.stops.sort((a, b) => a.order - b.order);
    
    if (currentStops.length === 0) {
      setCalculationInfo('Первая остановка: установите время прибытия и отправления вручную');
      return;
    }

    // Check Google Maps availability
    if (!isGoogleMapsLoaded || googleMapsError) {
      setCalculationInfo('Google Maps недоступен - установите время вручную');
      return;
    }

    setIsCalculating(true);
    setCalculationInfo('Расчет времени в пути...');

    try {
      // Get the actual last stop by order (highest order number)
      const sortedStops = currentStops.sort((a, b) => a.order - b.order);
      const lastStop = sortedStops[sortedStops.length - 1];
      
      console.log('🔍 Finding previous stop for calculation:', {
        totalStops: currentStops.length,
        sortedStops: sortedStops.map(s => ({ 
          id: s.id, 
          order: s.order, 
          warehouseId: s.warehouseId,
          arrivalTime: s.arrivalTime,
          departureTime: s.departureTime
        })),
        lastStopId: lastStop.id,
        lastStopOrder: lastStop.order,
        lastStopWarehouseId: lastStop.warehouseId
      });
      
      const previousWarehouse = state.warehouses.find(w => w.id === lastStop.warehouseId);
      const currentWarehouse = state.warehouses.find(w => w.id === selectedWarehouseId);

      if (!previousWarehouse || !currentWarehouse) {
        setCalculationInfo('Ошибка: не найден склад');
        setIsCalculating(false);
        return;
      }

      // Construct full addresses
      const originAddress = `${previousWarehouse.fullAddress}${previousWarehouse.unit ? ', UNIT: ' + previousWarehouse.unit : ''}, USA`;
      const destinationAddress = `${currentWarehouse.fullAddress}${currentWarehouse.unit ? ', UNIT: ' + currentWarehouse.unit : ''}, USA`;

      console.log('🗺️ Calculating route:', {
        from: originAddress,
        to: destinationAddress,
        departureTime: lastStop.departureTime
      });

      // Create departure datetime ensuring it's in the future (for traffic calculation)
      const now = new Date();
      const [depHour, depMinute] = lastStop.departureTime.split(':').map(Number);
      
      // Start with today
      let departureDateTime = new Date(now);
      departureDateTime.setHours(depHour, depMinute, 0, 0);
      
      // If the time is in the past, move to tomorrow
      if (departureDateTime <= now) {
        departureDateTime.setDate(departureDateTime.getDate() + 1);
        console.log('⏰ Departure time was in the past, moved to tomorrow for traffic calculation');
      }
      
      console.log('🕐 Departure time for traffic calculation:', {
        originalTime: `${depHour}:${depMinute.toString().padStart(2, '0')}`,
        calculatedDateTime: departureDateTime.toLocaleString(),
        isToday: departureDateTime.toDateString() === now.toDateString(),
        isFuture: departureDateTime > now
      });

      // Get destination warehouse traffic scenario - always use fresh data from state
      const destinationWarehouse = state.warehouses.find(w => w.id === selectedWarehouseId);
      const trafficScenario = destinationWarehouse?.trafficScenario || 'best_guess';
      
      // Log to ensure we're using the most current data
      console.log('🔄 Using fresh warehouse data from state:', {
        selectedWarehouseId,
        warehouseName: destinationWarehouse?.name,
        trafficScenario,
        timestamp: new Date().toISOString()
      });

      const scenarioDisplayName = {
        'pessimistic': 'Пессимистический',
        'optimistic': 'Оптимистический', 
        'best_guess': 'Лучший прогноз'
      }[trafficScenario] || 'Неизвестный';

      console.log('🏭 Определение сценария расчета времени для склада:', {
        selectedWarehouseId,
        warehouseName: destinationWarehouse?.name,
        trafficScenario,
        scenarioDisplayName,
        isWarehouseFound: !!destinationWarehouse,
        isScenarioFromWarehouse: !!destinationWarehouse?.trafficScenario
      });

      // Validate warehouse and scenario
      if (!destinationWarehouse) {
        console.warn('⚠️ Склад не найден! Используется сценарий по умолчанию:', trafficScenario);
        setCalculationInfo('⚠️ Склад не найден - используется стандартный сценарий расчета');
      } else if (!destinationWarehouse.trafficScenario) {
        console.warn('⚠️ У склада не настроен сценарий расчета времени! Используется по умолчанию:', trafficScenario);
      } else {
        console.log('✅ Используется настроенный сценарий склада:', scenarioDisplayName);
      }

      // Get vehicle speed limit if driver is assigned to route
      let vehicleSpeedLimit: number | undefined;
      if (route.driverId) {
        const driver = state.users.find(u => u.id === route.driverId);
        const driverFullName = driver ? `${driver.firstName} ${driver.lastName}` : '';
        const assignedVehicle = state.vehicles.find(v => v.assignedDriver === driverFullName);
        vehicleSpeedLimit = assignedVehicle?.speedLimit;
        
        console.log('🚗 Vehicle speed limit lookup (InlineStopForm):', {
          routeDriverId: route.driverId,
          driverName: driverFullName,
          assignedVehicle: assignedVehicle?.name,
          speedLimit: vehicleSpeedLimit,
          allVehicles: state.vehicles.map(v => ({ name: v.name, driver: v.assignedDriver, speedLimit: v.speedLimit }))
        });
        
        if (!assignedVehicle) {
          console.warn('⚠️ No vehicle found for driver:', driverFullName);
        } else if (!vehicleSpeedLimit) {
          console.warn('⚠️ Vehicle found but no speed limit set:', assignedVehicle.name);
        } else {
          console.log('✅ Using vehicle speed limit:', vehicleSpeedLimit, 'mph for vehicle:', assignedVehicle.name);
        }
      } else {
        console.log('ℹ️ No driver assigned to route, using default traffic calculation');
      }

      // Calculate travel time using Google Directions API with route weekday awareness
      const result = await RouteCalculationService.calculateTravelTimeForRoute(
        originAddress,
        destinationAddress,
        route.weekday ?? undefined, // Pass the route's weekday for accurate traffic calculation
        departureDateTime,
        trafficScenario, // Pass the destination warehouse's traffic scenario
        vehicleSpeedLimit // Pass the vehicle's speed limit
      );

      console.log('🔍 Route calculation result:', result);
      
      if (result && result.success !== false && result.travelTimeMinutes) {
        // Calculate arrival time
        const arrivalDateTime = new Date(departureDateTime);
        arrivalDateTime.setMinutes(arrivalDateTime.getMinutes() + result!.travelTimeMinutes); // Direct travel time without buffer

        // Validate working hours (7 AM to 8 PM)
        const arrivalHour = arrivalDateTime.getHours();
        const weekdayName = route.weekday !== null && route.weekday !== undefined 
          ? ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'][route.weekday]
          : 'Любой день';
        
        
        const scenarioExplanation = RouteCalculationService.explainTrafficScenarioSelection(
          trafficScenario,
          departureDateTime
        );

        if (arrivalHour < 7 || arrivalHour >= 20) {
          setCalculationInfo(`⚠️ Время прибытия ${arrivalDateTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} вне рабочих часов (07:00-20:00)`);
        } else {
          const speedInfo = vehicleSpeedLimit ? ` (макс. скорость: ${vehicleSpeedLimit} mph)` : '';
          const trafficInfo = result!.trafficInfo ? 
            ` | Пробки: ${result!.trafficInfo.trafficConditions} (+${result!.trafficInfo.delayMinutes} мин)` : '';
          const roadSpeedInfo = result!.speedLimitInfo ? 
            ` | Дорожные ограничения: ${result!.speedLimitInfo.averageSpeedLimit} mph` : '';
          
          // Детальная информация о дополнительных задержках с указанием источника данных
          let additionalInfo = '';
          if (result!.additionalDelays) {
            const dataSource = result!.roadConditions ? '🎯 Routes API' : '📊 Оценка';
            const roadConditionsInfo = result!.roadConditions ? 
              ` (реальные данные: ${result!.roadConditions.trafficLightCount} светофоров, ${result!.roadConditions.stopSignCount} знаков STOP, ${result!.roadConditions.intersectionCount} перекрестков)` : '';
            
            additionalInfo = ` | Задержки ${dataSource}: светофоры ${result!.additionalDelays.trafficLightDelayMinutes}м, STOP ${result!.additionalDelays.stopSignDelayMinutes}м, перекрестки ${result!.additionalDelays.intersectionDelayMinutes}м, городские условия ${result!.additionalDelays.urbanComplexityMinutes}м (тип: ${result!.additionalDelays.routeComplexity}, всего +${result!.additionalDelays.totalDelayMinutes}м)${roadConditionsInfo}`;
          }
          
          setCalculationInfo(`✅ ${weekdayName}: ${result!.travelTimeMinutes} мин. ${scenarioExplanation}${speedInfo}${trafficInfo}${roadSpeedInfo}${additionalInfo}`);
        }

        // Set calculated arrival time
        const calculatedArrivalTime = arrivalDateTime.toLocaleTimeString('ru-RU', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        });
        setArrivalTime(calculatedArrivalTime);

        // Set departure time using lunch calculation
        const calculatedDepartureTime = calculateDepartureTime(calculatedArrivalTime, hasLunch, lunchDuration);
        setDepartureTime(calculatedDepartureTime);

      } else {
        setCalculationInfo(`❌ Ошибка расчета: ${result?.error || 'Неизвестная ошибка'}`);
        // Set default times
        setArrivalTime('08:00');
        setDepartureTime('09:00');
      }

    } catch (error) {
      console.error('Error calculating travel time:', error);
      setCalculationInfo('❌ Ошибка при расчете времени в пути');
      setArrivalTime('08:00');
      setDepartureTime('09:00');
    } finally {
      setIsCalculating(false);
    }
  };

  // Обработчики для обеда
  const handleLunchChange = (checked: boolean) => {
    setHasLunch(checked);
    // Пересчитываем departure time
    const newDepartureTime = calculateDepartureTime(arrivalTime, checked, lunchDuration);
    setDepartureTime(newDepartureTime);
  };

  const handleLunchDurationChange = (duration: number) => {
    setLunchDuration(duration);
    // Пересчитываем departure time если обед включен
    if (hasLunch) {
      const newDepartureTime = calculateDepartureTime(arrivalTime, hasLunch, duration);
      setDepartureTime(newDepartureTime);
    }
  };

  // Обработчик изменения arrival time с пересчетом departure
  const handleArrivalTimeChange = (time: string) => {
    setArrivalTime(time);
    const newDepartureTime = calculateDepartureTime(time, hasLunch, lunchDuration);
    setDepartureTime(newDepartureTime);
  };

  const handleAdd = () => {
    if (!warehouseId) return;

    // Calculate correct order for new stop
    const currentStops = route.stops.sort((a, b) => a.order - b.order);
    const nextOrder = currentStops.length > 0 ? 
      Math.max(...currentStops.map(s => s.order)) + 1 : 1;

    const newStop: RouteStop = {
      id: `stop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      warehouseId,
      arrivalTime,
      departureTime,
      order: nextOrder,
      hasLunch: hasLunch,
      lunchDuration: hasLunch ? lunchDuration : undefined,
    };

    console.log('📦 INLINE Creating new stop with correct order:', {
      newStop,
      currentStopsCount: currentStops.length,
      existingOrders: currentStops.map(s => s.order),
      nextOrder
    });
    
    // Прямое обновление маршрута
    const updatedRoute = {
      ...route,
      stops: [...route.stops, newStop],
      updatedAt: new Date(),
    };

    console.log('📡 INLINE Dispatching route update:', {
      routeId: updatedRoute.id,
      oldStopsCount: route.stops.length,
      newStopsCount: updatedRoute.stops.length,
      newStop: newStop
    });

    dispatch({ type: 'UPDATE_ROUTE', payload: updatedRoute });

    // Сбросить форму
    setWarehouseId('');
    setArrivalTime('08:00');
    setDepartureTime('09:00');
    setHasLunch(false);
    setLunchDuration(30);
    setIsAdding(false);
  };

  if (!isAdding) {
    return (
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
        <button
          onClick={() => setIsAdding(true)}
          className="btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Stop
        </button>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="space-y-4">
        <div className="space-y-4">
        {/* Первая строка: Warehouse и времена */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse</label>
            <select
              value={warehouseId}
              onChange={(e) => {
                const selectedId = e.target.value;
                console.log('🏭 Warehouse selected from dropdown:', {
                  selectedId,
                  timestamp: new Date().toISOString()
                });
                
                // Show current warehouse info immediately
                if (selectedId) {
                  const selectedWarehouse = state.warehouses.find(w => w.id === selectedId);
                  if (selectedWarehouse) {
                    console.log('📋 Current warehouse settings:', {
                      name: selectedWarehouse.name,
                      trafficScenario: selectedWarehouse.trafficScenario,
                      address: selectedWarehouse.fullAddress
                    });
                  }
                }
                
                handleWarehouseChange(selectedId);
              }}
              className="input"
              required
              disabled={isCalculating}
            >
              <option value="">Select warehouse...</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Arrival Time {route.stops.length > 0 ? '(Auto-calculated)' : '(Manual)'}
            </label>
            <input
              type="time"
              value={arrivalTime}
              onChange={(e) => handleArrivalTimeChange(e.target.value)}
              className="input"
              required
              disabled={isCalculating}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Departure Time {hasLunch ? '(Auto + Lunch)' : '(Auto)'}
            </label>
            <input
              type="time"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              className="input"
              required
              disabled={isCalculating}
            />
          </div>
        </div>

        {/* Вторая строка: Обед */}
        {warehouseId && (
          <div className="bg-white border border-blue-200 rounded-lg p-3">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="lunch-checkbox"
                  checked={hasLunch}
                  onChange={(e) => handleLunchChange(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="lunch-checkbox" className="text-sm font-medium text-gray-700">
                  Обед
                </label>
              </div>
              
              {hasLunch && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Длительность обеда</label>
                  <select
                    value={lunchDuration}
                    onChange={(e) => handleLunchDurationChange(Number(e.target.value))}
                    className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={15}>15 минут</option>
                    <option value={30}>30 минут</option>
                    <option value={45}>45 минут</option>
                    <option value={60}>1 час</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Кнопки */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleAdd}
            disabled={!warehouseId || isCalculating}
            className="btn-primary flex-1"
          >
            {isCalculating ? 'Calculating...' : 'Add'}
          </button>
          <button
            onClick={() => setIsAdding(false)}
            className="btn-secondary flex-1"
            disabled={isCalculating}
          >
            Cancel
          </button>
        </div>
        </div>

        {/* Calculation Info */}
        {calculationInfo && (
          <div className="bg-white border border-blue-200 rounded p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {isCalculating ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                ) : (
                  <Building2 className="h-4 w-4 text-blue-600" />
                )}
                <span className="text-sm text-gray-700">{calculationInfo}</span>
              </div>
              {warehouseId && !isCalculating && calculationInfo.includes('Пересчитайте') && (
                <button
                  onClick={() => handleWarehouseChange(warehouseId)}
                  className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                  title="Пересчитать с новыми настройками склада"
                >
                  Пересчитать
                </button>
              )}
            </div>
          </div>
        )}

        {/* Info Block */}
        <div className="bg-white border border-blue-200 rounded p-3">
          <div className="text-xs text-gray-600">
            {route.stops.length === 0 ? (
              <div>
                <strong>Первая остановка:</strong> Установите время прибытия и отправления вручную.
              </div>
            ) : (
              <div>
                <strong>Автоматический расчет:</strong> При выборе склада программа рассчитает время прибытия на основе предыдущей остановки с учетом пессимистического сценария пробок.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteManagement;
