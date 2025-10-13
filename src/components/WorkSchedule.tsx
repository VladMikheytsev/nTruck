import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Route, WorkSchedule as WorkScheduleType, User } from '../types';
import { 
  Calendar, 
  ChevronLeft,
  ChevronRight,
  Users,
  User as UserIcon,
  Map
} from 'lucide-react';
import { getDaysInMonth } from 'date-fns';
import WarehouseIcon from './WarehouseIcon';

const WorkSchedule: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [showRouteSelector, setShowRouteSelector] = useState(false);

  // Loading state check
  if (!state.users || !state.routes || !state.workSchedules || !state.warehouses) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading schedule data...</p>
        </div>
      </div>
    );
  }

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const daysInMonth = getDaysInMonth(currentDate);

  // Get drivers only
  const drivers = state.users.filter(user => user.role === 'driver');
  
  // Get active routes only
  const activeRoutes = state.routes.filter(route => route.isActive);

  // Get routes for specific driver
  const getRoutesForDriver = (driverId: string) => {
    return activeRoutes.filter(route => route.driverId === driverId);
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 2, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth, 1));
  };

  const handleDayClick = (driverId: string, day: number) => {
    setSelectedDriverId(driverId);
    setSelectedDay(day);
    setShowRouteSelector(true);
  };

  const handleRouteSelect = (routeId: string | null) => {
    if (!selectedDriverId || selectedDay === null) return;

    const existingSchedule = state.workSchedules.find(
      ws => ws.driverId === selectedDriverId && ws.year === currentYear && ws.month === currentMonth
    );

    let updatedSchedule: WorkScheduleType;

    if (existingSchedule) {
      // Update existing schedule
      const newScheduleData = { ...existingSchedule.schedule };
      if (routeId) {
        newScheduleData[selectedDay] = routeId;
      } else {
        delete newScheduleData[selectedDay];
      }

      updatedSchedule = {
        ...existingSchedule,
        schedule: newScheduleData,
        updatedAt: new Date(),
      };
      dispatch({ type: 'UPDATE_WORK_SCHEDULE', payload: updatedSchedule });
    } else {
      // Create new schedule
      updatedSchedule = {
        id: Date.now().toString(),
        driverId: selectedDriverId,
        year: currentYear,
        month: currentMonth,
        schedule: routeId ? { [selectedDay]: routeId } : {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      dispatch({ type: 'ADD_WORK_SCHEDULE', payload: updatedSchedule });
    }

    setShowRouteSelector(false);
    setSelectedDay(null);
    setSelectedDriverId(null);
  };

  const getRouteForDriverAndDay = (driverId: string, day: number): Route | null => {
    const schedule = state.workSchedules.find(
      ws => ws.driverId === driverId && ws.year === currentYear && ws.month === currentMonth
    );
    if (!schedule) return null;
    
    const routeId = schedule.schedule[day];
    return routeId ? state.routes.find(r => r.id === routeId) || null : null;
  };

  const getDriverName = (driverId: string): string => {
    const driver = drivers.find(d => d.id === driverId);
    return driver ? `${driver.firstName} ${driver.lastName}` : 'Unknown Driver';
  };

  const getWarehouseName = (warehouseId: string) => {
    return state.warehouses.find(w => w.id === warehouseId)?.name || 'Unknown';
  };

  const getWarehouseColor = (warehouseId: string) => {
    return state.warehouses.find(w => w.id === warehouseId)?.iconColor || '#3b82f6';
  };

  const renderDaysHeader = () => {
    const days = [];
    const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth - 1, day);
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      days.push(
        <th 
          key={day}
          className={`px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[50px] ${
            isWeekend ? 'bg-red-50' : 'bg-gray-50'
          }`}
        >
          <div className={isWeekend ? 'text-red-600 font-semibold' : ''}>{day}</div>
          <div className={`text-xs ${isWeekend ? 'text-red-500' : 'text-gray-400'}`}>
            {dayNames[dayOfWeek]}
          </div>
        </th>
      );
    }
    return days;
  };

  const renderDriverRow = (driver: User) => {
    const cells = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const route = getRouteForDriverAndDay(driver.id, day);
      const date = new Date(currentYear, currentMonth - 1, day);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      
      cells.push(
        <td 
          key={day}
          className={`shift-cell px-2 py-3 text-center cursor-pointer min-w-[50px] ${
            isWeekend ? 'bg-red-50' : 'bg-white'
          }`}
          onClick={() => handleDayClick(driver.id, day)}
        >
          {route ? (
            <div className="flex flex-col items-center space-y-1">
              <div className="flex space-x-1">
                {route.stops.slice(0, 2).map((stop) => (
                  <WarehouseIcon
                    key={stop.id}
                    name={getWarehouseName(stop.warehouseId)}
                    color={getWarehouseColor(stop.warehouseId)}
                    size="sm"
                  />
                ))}
                {route.stops.length > 2 && (
                  <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-xs">
                    +{route.stops.length - 2}
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-600 font-medium truncate max-w-[80px]">
                {route.name}
              </div>
            </div>
          ) : (
            <div className="w-6 h-6 mx-auto flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-gray-300"></div>
            </div>
          )}
        </td>
      );
    }
    
    return cells;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">График Работ</h1>
          <p className="text-gray-600 mt-1">Назначение маршрутов водителям по дням</p>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Calendar className="h-5 w-5 text-primary-600" />
            <h3 className="text-lg font-medium text-gray-900">
              График на {(() => {
                const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                              'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
                return `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
              })()}
            </h3>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={goToPreviousMonth}
              className="p-2 hover:bg-gray-100 rounded-md"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={goToNextMonth}
              className="p-2 hover:bg-gray-100 rounded-md"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>


      {/* Schedule Table */}
      {drivers.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              График работы водителей
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Кликните на ячейку для назначения маршрута. Всего водителей: {drivers.length}
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="schedule-table min-w-full">
              <thead>
                <tr>
                  <th className="driver-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Водитель
                  </th>
                  {renderDaysHeader()}
                </tr>
              </thead>
              <tbody>
                {drivers.map((driver, index) => (
                  <tr key={driver.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="driver-cell px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8">
                          <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                            <UserIcon className="h-4 w-4 text-primary-600" />
                          </div>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {driver.firstName} {driver.lastName}
                          </div>
                          <div className="text-xs text-gray-500">
                            @{driver.login}
                          </div>
                        </div>
                      </div>
                    </td>
                    {renderDriverRow(driver)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card p-12 text-center">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Нет водителей</h3>
          <p className="text-gray-500">Сначала добавьте пользователей с ролью "Водитель" в разделе Модерация</p>
        </div>
      )}

      {/* Route Selector Modal */}
      {showRouteSelector && selectedDay && selectedDriverId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Выбор маршрута на {selectedDay} число
            </h3>
            <div className="text-sm text-gray-600 mb-4">
              Водитель: {getDriverName(selectedDriverId)}
            </div>
            
            <div className="max-h-96 overflow-y-auto space-y-3">
              <button
                onClick={() => handleRouteSelect(null)}
                className="w-full p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="font-medium text-gray-900">Выходной</div>
                <div className="text-sm text-gray-500">Нет маршрута</div>
              </button>
              
              {(() => {
                const driverRoutes = selectedDriverId ? getRoutesForDriver(selectedDriverId) : [];
                
                if (driverRoutes.length === 0) {
                  return (
                    <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-lg">
                      <Map className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <div className="font-medium">Нет назначенных маршрутов</div>
                      <div className="text-sm">Для этого водителя не назначено ни одного маршрута</div>
                    </div>
                  );
                }
                
                return driverRoutes.map((route) => (
                  <button
                    key={route.id}
                    onClick={() => handleRouteSelect(route.id)}
                    className="w-full p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex space-x-1">
                        {route.stops.slice(0, 3).map((stop) => (
                          <WarehouseIcon
                            key={stop.id}
                            name={getWarehouseName(stop.warehouseId)}
                            color={getWarehouseColor(stop.warehouseId)}
                            size="sm"
                          />
                        ))}
                        {route.stops.length > 3 && (
                          <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-xs">
                            +{route.stops.length - 3}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{route.name}</div>
                        <div className="text-sm text-gray-500">
                          {route.stops.length} остановок
                        </div>
                        {route.weekday !== undefined && route.weekday !== null && (
                          <div className="text-xs text-blue-600 mt-1">
                            {['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][route.weekday]}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ));
              })()}
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowRouteSelector(false)}
                className="btn-secondary"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkSchedule;