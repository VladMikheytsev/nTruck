import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Route, Warehouse } from '../types';
import '../styles/route-map.css';
import { format, addDays, subDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import TrafficAwareRouteMap from './TrafficAwareRouteMap';

interface RouteMapViewProps {
  routes: Route[];
  warehouses: Warehouse[];
  selectedRoutes: string[];
  onRouteSelectionChange: (routes: string[]) => void;
  timeSliderValue: number; // 390-1260 minutes (6:30-21:00)
  onTimeSliderChange: (value: number) => void;
  assignedRoutes?: Route[]; // Маршруты назначенные на выбранную дату
  selectedDate?: Date; // Выбранная дата
  onDateChange?: (date: Date) => void; // Обработчик изменения даты
}

interface WarehousePosition {
  id: string;
  x: number;
  y: number;
  warehouse: Warehouse;
}

const RouteMapView: React.FC<RouteMapViewProps> = ({
  routes,
  warehouses,
  selectedRoutes,
  onRouteSelectionChange,
  timeSliderValue,
  onTimeSliderChange,
  assignedRoutes = [],
  selectedDate: propSelectedDate,
  onDateChange
}) => {
  const [warehousePositions, setWarehousePositions] = useState<WarehousePosition[]>([]);
  const [draggedWarehouse, setDraggedWarehouse] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedDate, setSelectedDate] = useState(propSelectedDate || new Date());
  const [showTrafficMap, setShowTrafficMap] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  // Используем назначенные маршруты, если они есть, иначе все маршруты
  const routesToDisplay = assignedRoutes.length > 0 ? assignedRoutes : routes;

  // Синхронизируем selectedDate с propSelectedDate
  useEffect(() => {
    if (propSelectedDate && propSelectedDate.getTime() !== selectedDate.getTime()) {
      setSelectedDate(propSelectedDate);
    }
  }, [propSelectedDate]);

  // Цвета для стрелок маршрутов
  const routeColors = [
    '#ef4444', // Красный
    '#3b82f6', // Синий
    '#10b981', // Зеленый
    '#f59e0b', // Оранжевый
    '#8b5cf6', // Фиолетовый
    '#ec4899', // Розовый
    '#14b8a6', // Бирюзовый
    '#f97316', // Темно-оранжевый
    '#6366f1', // Индиго
    '#84cc16', // Лайм
    '#06b6d4', // Голубой
    '#d946ef', // Фуксия
  ];

  // Получение цвета для маршрута
  const getRouteColor = (routeId: string): string => {
    const routeIndex = routesToDisplay.findIndex(r => r.id === routeId);
    return routeColors[routeIndex % routeColors.length];
  };



  // localStorage ключ для сохранения позиций складов
  const POSITIONS_STORAGE_KEY = 'routeMapWarehousePositions';

  // Загрузка позиций из localStorage
  const loadPositionsFromStorage = (): { [key: string]: { x: number, y: number } } => {
    try {
      const saved = localStorage.getItem(POSITIONS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.error('❌ Ошибка загрузки позиций складов:', error);
      return {};
    }
  };

  // Сохранение позиций в localStorage
  const savePositionsToStorage = (positions: WarehousePosition[]) => {
    try {
      const positionsMap = positions.reduce((acc, pos) => {
        acc[pos.id] = { x: pos.x, y: pos.y };
        return acc;
      }, {} as { [key: string]: { x: number, y: number } });
      
      localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(positionsMap));
      console.log('💾 Позиции складов сохранены в localStorage:', {
        savedPositions: Object.keys(positionsMap).length
      });
    } catch (error) {
      console.error('❌ Ошибка сохранения позиций складов:', error);
    }
  };

  // Initialize warehouse positions
  useEffect(() => {
    if (warehouses.length > 0) {
      // Get unique warehouses from selected routes
      const uniqueWarehouses = getUniqueWarehousesFromRoutes();
      
      console.log('🔄 Обновляем позиции складов:', {
        totalWarehouses: warehouses.length,
        uniqueWarehouses: uniqueWarehouses.length,
        selectedRoutes: selectedRoutes.length
      });
      
      // Загружаем сохраненные позиции из localStorage
      const savedPositions = loadPositionsFromStorage();
      
      // Create initial positions in a grid
      const positions: WarehousePosition[] = uniqueWarehouses.map((warehouse, index) => {
        // Проверяем, есть ли сохраненная позиция в localStorage
        const savedPosition = savedPositions[warehouse.id];
        
        if (savedPosition) {
          // Используем сохраненную позицию из localStorage
          console.log('📍 Загружена сохраненная позиция для склада:', {
            warehouseId: warehouse.id,
            name: warehouse.name,
            position: savedPosition
          });
          
          return {
            id: warehouse.id,
            x: savedPosition.x,
            y: savedPosition.y,
            warehouse
          };
        } else {
          // Проверяем, есть ли уже позиция в текущем состоянии
          const existingPosition = warehousePositions.find(p => p.id === warehouse.id);
          
          if (existingPosition) {
            // Используем существующую позицию из состояния
            return {
              ...existingPosition,
              warehouse // Обновляем данные склада
            };
          } else {
            // Создаем новую позицию в сетке
            const cols = Math.ceil(Math.sqrt(uniqueWarehouses.length));
            const row = Math.floor(index / cols);
            const col = index % cols;
            
            console.log('🆕 Создана новая позиция для склада:', {
              warehouseId: warehouse.id,
              name: warehouse.name,
              gridPosition: { row, col },
              pixelPosition: { x: 100 + col * 180, y: 100 + row * 100 }
            });
            
            return {
              id: warehouse.id,
              x: 100 + col * 180, // Увеличенное расстояние для полных названий
              y: 100 + row * 100, // Уменьшенное расстояние по вертикали
              warehouse
            };
          }
        }
      });
      
      setWarehousePositions(positions);
    }
  }, [warehouses, routesToDisplay]);

  // Get warehouses from assigned routes
  const getUniqueWarehousesFromRoutes = () => {
    if (routesToDisplay.length === 0) {
      console.log('📍 Маршруты не найдены - карта пуста');
      return [];
    }
    
    const uniqueWarehouseIds = new Set<string>();
    const uniqueWarehouses: Warehouse[] = [];
    
    // Добавляем склады из назначенных маршрутов
    routesToDisplay.forEach(route => {
      if (route.stops) {
        route.stops.forEach(stop => {
          if (!uniqueWarehouseIds.has(stop.warehouseId)) {
            const warehouse = warehouses.find(w => w.id === stop.warehouseId);
            if (warehouse) {
              uniqueWarehouseIds.add(stop.warehouseId);
              uniqueWarehouses.push(warehouse);
            }
          }
        });
      }
    });
    
    console.log('📍 Отображаем склады из назначенных маршрутов:', {
      totalAssignedRoutes: routesToDisplay.length,
      totalAllRoutes: routes.length,
      warehousesFromAssignedRoutes: uniqueWarehouseIds.size,
      totalWarehousesOnMap: uniqueWarehouses.length,
      allWarehousesInSystem: warehouses.length,
      warehouseNames: uniqueWarehouses.map(w => w.name)
    });
    
    return uniqueWarehouses;
  };

  // Convert time slider value (390-1260 minutes) to HH:MM format (6:30-21:00)
  const formatTimeFromSlider = (minutes: number): string => {
    // Ограничиваем диапазон 6:30 (390 мин) - 21:00 (1260 мин)
    const constrainedMinutes = Math.max(390, Math.min(1260, minutes));
    const hours = Math.floor(constrainedMinutes / 60);
    const mins = constrainedMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Parse HH:MM time to minutes from start of day
  const parseTimeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Get warehouse status at current time
  const getWarehouseStatusAtTime = (warehouseId: string, currentTimeMinutes: number) => {
    let isActive = false;
    let isTransitioning = false;
    let transitFrom: string | null = null;
    let transitTo: string | null = null;
    let isStartWarehouse = false;
    let startWarehouseColor: string | null = null;

    selectedRoutes.forEach(routeId => {
      const route = routes.find(r => r.id === routeId);
      if (route && route.stops) {
        const sortedStops = route.stops.sort((a, b) => a.order - b.order);
        const routeColor = getRouteColor(routeId);
        
        // Проверяем, является ли этот склад начальным для маршрута
        if (sortedStops.length > 0 && sortedStops[0].warehouseId === warehouseId) {
          isStartWarehouse = true;
          startWarehouseColor = routeColor;
        }
        
        const stops = route.stops.filter(s => s.warehouseId === warehouseId);
        
        stops.forEach(stop => {
          const arrivalMinutes = parseTimeToMinutes(stop.arrivalTime);
          const departureMinutes = parseTimeToMinutes(stop.departureTime);
          
          // Check if current time is between arrival and departure
          if (currentTimeMinutes >= arrivalMinutes && currentTimeMinutes <= departureMinutes) {
            isActive = true;
          }
        });

        // Check for transitions (between departure and next arrival)
        for (let i = 0; i < sortedStops.length - 1; i++) {
          const currentStop = sortedStops[i];
          const nextStop = sortedStops[i + 1];
          
          const currentDepartureMinutes = parseTimeToMinutes(currentStop.departureTime);
          const nextArrivalMinutes = parseTimeToMinutes(nextStop.arrivalTime);
          
          if (currentTimeMinutes >= currentDepartureMinutes && currentTimeMinutes <= nextArrivalMinutes) {
            if (currentStop.warehouseId === warehouseId || nextStop.warehouseId === warehouseId) {
              isTransitioning = true;
              transitFrom = currentStop.warehouseId;
              transitTo = nextStop.warehouseId;
            }
          }
        }
      }
    });

    return { isActive, isTransitioning, transitFrom, transitTo, isStartWarehouse, startWarehouseColor };
  };

  // Handle warehouse drag
  const handleMouseDown = (e: React.MouseEvent, warehouseId: string) => {
    e.preventDefault();
    const position = warehousePositions.find(p => p.id === warehouseId);
    if (!position) return;

    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDraggedWarehouse(warehouseId);
    setDragOffset({
      x: e.clientX - rect.left - position.x,
      y: e.clientY - rect.top - position.y
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggedWarehouse || !mapRef.current) return;

    const rect = mapRef.current.getBoundingClientRect();
    const newX = e.clientX - rect.left - dragOffset.x;
    const newY = e.clientY - rect.top - dragOffset.y;

    // Constrain to map bounds
    const constrainedX = Math.max(20, Math.min(rect.width - 80, newX));
    const constrainedY = Math.max(20, Math.min(rect.height - 80, newY));

    setWarehousePositions(prev => 
      prev.map(pos => 
        pos.id === draggedWarehouse 
          ? { ...pos, x: constrainedX, y: constrainedY }
          : pos
      )
    );
  }, [draggedWarehouse, dragOffset]);

  const handleMouseUp = useCallback(() => {
    if (draggedWarehouse) {
      const updatedPosition = warehousePositions.find(p => p.id === draggedWarehouse);
      
      console.log('📍 Warehouse position saved:', {
        warehouseId: draggedWarehouse,
        warehouseName: updatedPosition?.warehouse.name,
        position: updatedPosition ? { x: updatedPosition.x, y: updatedPosition.y } : null
      });
      
      // Сохраняем все позиции в localStorage
      savePositionsToStorage(warehousePositions);
      
      setDraggedWarehouse(null);
    }
  }, [draggedWarehouse, warehousePositions]);

  // Add global mouse event listeners
  useEffect(() => {
    if (draggedWarehouse) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggedWarehouse, handleMouseMove, handleMouseUp]);

  // Handle route selection
  const handleRouteToggle = (routeId: string) => {
    if (selectedRoutes.includes(routeId)) {
      onRouteSelectionChange(selectedRoutes.filter(id => id !== routeId));
    } else {
      onRouteSelectionChange([...selectedRoutes, routeId]);
    }
  };

  // Get transition arrows with route colors
  const getTransitionArrows = () => {
    const arrows: Array<{
      from: WarehousePosition, 
      to: WarehousePosition, 
      routeId: string, 
      routeName: string,
      color: string
    }> = [];
    
    routesToDisplay.forEach(route => {
      if (route && route.stops) {
        const sortedStops = route.stops.sort((a, b) => a.order - b.order);
        const routeColor = getRouteColor(route.id);
        
        for (let i = 0; i < sortedStops.length - 1; i++) {
          const currentStop = sortedStops[i];
          const nextStop = sortedStops[i + 1];
          
          const currentDepartureMinutes = parseTimeToMinutes(currentStop.departureTime);
          const nextArrivalMinutes = parseTimeToMinutes(nextStop.arrivalTime);
          
          if (timeSliderValue >= currentDepartureMinutes && timeSliderValue <= nextArrivalMinutes) {
            const fromPos = warehousePositions.find(p => p.id === currentStop.warehouseId);
            const toPos = warehousePositions.find(p => p.id === nextStop.warehouseId);
            
            if (fromPos && toPos) {
              arrows.push({ 
                from: fromPos, 
                to: toPos, 
                routeId: route.id,
                routeName: route.name || `Маршрут ${route.id.substring(0, 8)}`,
                color: routeColor
              });
            }
          }
        }
      }
    });
    
    console.log('🔴 Отображаем стрелки маршрутов:', {
      totalArrows: arrows.length,
      arrowsData: arrows.map(a => ({
        routeName: a.routeName,
        color: a.color,
        from: a.from.warehouse.name,
        to: a.to.warehouse.name
      }))
    });
    
    return arrows;
  };

  // Get vehicle positions for each route
  const getVehiclePositions = () => {
    const vehicles: Array<{
      routeId: string,
      routeName: string,
      color: string,
      x: number,
      y: number,
      status: 'at_warehouse' | 'in_transit',
      currentWarehouse?: string,
      fromWarehouse?: string,
      toWarehouse?: string,
      progress?: number, // 0-1 for transit progress
      isLunchTime?: boolean,
      lunchDuration?: number
    }> = [];

    routesToDisplay.forEach(route => {
      if (!route || !route.stops) return;

      const sortedStops = route.stops.sort((a, b) => a.order - b.order);
      const routeColor = getRouteColor(route.id);
      const routeName = route.name || `Маршрут ${route.id.substring(0, 8)}`;

      // Проверяем, находится ли автомобиль на складе
      for (const stop of sortedStops) {
        const arrivalMinutes = parseTimeToMinutes(stop.arrivalTime);
        const departureMinutes = parseTimeToMinutes(stop.departureTime);

        if (timeSliderValue >= arrivalMinutes && timeSliderValue <= departureMinutes) {
          // Автомобиль на складе
          const warehousePos = warehousePositions.find(p => p.id === stop.warehouseId);
          if (warehousePos) {
            // Проверяем, время обеда ли сейчас
            let isLunchTime = false;
            let lunchDuration = 0;
            
            if (stop.hasLunch && stop.lunchDuration) {
              // Рассчитываем время начала обеда (в середине пребывания на складе)
              const stayDuration = departureMinutes - arrivalMinutes;
              const workTime = stayDuration - stop.lunchDuration;
              const lunchStartMinutes = arrivalMinutes + (workTime / 2);
              const lunchEndMinutes = lunchStartMinutes + stop.lunchDuration;
              
              isLunchTime = timeSliderValue >= lunchStartMinutes && timeSliderValue <= lunchEndMinutes;
              lunchDuration = stop.lunchDuration;
            }

            vehicles.push({
              routeId: route.id,
              routeName,
              color: routeColor,
              x: warehousePos.x + 60, // Центр склада
              y: warehousePos.y + 30,
              status: 'at_warehouse',
              currentWarehouse: stop.warehouseId,
              isLunchTime,
              lunchDuration
            });
          }
          return; // Выходим из цикла, так как нашли текущую позицию
        }
      }

      // Проверяем, находится ли автомобиль в пути между складами
      for (let i = 0; i < sortedStops.length - 1; i++) {
        const currentStop = sortedStops[i];
        const nextStop = sortedStops[i + 1];

        const departureMinutes = parseTimeToMinutes(currentStop.departureTime);
        const arrivalMinutes = parseTimeToMinutes(nextStop.arrivalTime);

        if (timeSliderValue >= departureMinutes && timeSliderValue <= arrivalMinutes) {
          // Автомобиль в пути
          const fromPos = warehousePositions.find(p => p.id === currentStop.warehouseId);
          const toPos = warehousePositions.find(p => p.id === nextStop.warehouseId);

          if (fromPos && toPos) {
            // Рассчитываем прогресс движения (0-1)
            const totalTravelTime = arrivalMinutes - departureMinutes;
            const elapsedTime = timeSliderValue - departureMinutes;
            const progress = Math.max(0, Math.min(1, elapsedTime / totalTravelTime));

            // Рассчитываем позицию на стрелке
            const deltaX = toPos.x - fromPos.x;
            const deltaY = toPos.y - fromPos.y;
            const vehicleX = fromPos.x + 60 + (deltaX * progress); // +60 для центра склада
            const vehicleY = fromPos.y + 30 + (deltaY * progress); // +30 для центра склада

            vehicles.push({
              routeId: route.id,
              routeName,
              color: routeColor,
              x: vehicleX,
              y: vehicleY,
              status: 'in_transit',
              fromWarehouse: currentStop.warehouseId,
              toWarehouse: nextStop.warehouseId,
              progress
            });
          }
          return; // Выходим из цикла
        }
      }
    });

    console.log('🚗 Позиции автомобилей:', {
      totalVehicles: vehicles.length,
      vehiclesData: vehicles.map(v => ({
        routeName: v.routeName,
        status: v.status,
        position: { x: Math.round(v.x), y: Math.round(v.y) },
        progress: v.progress ? Math.round(v.progress * 100) + '%' : 'N/A'
      }))
    });

    return vehicles;
  };

  // Get all arrows (current and previous) with opacity based on time distance
  const getAllArrowsWithOpacity = () => {
    const allArrows: Array<{
      from: WarehousePosition,
      to: WarehousePosition,
      routeId: string,
      routeName: string,
      color: string,
      opacity: number,
      isCurrent: boolean,
      timeDistance: number
    }> = [];

    routesToDisplay.forEach(route => {
      if (!route || !route.stops) return;

      const sortedStops = route.stops.sort((a, b) => a.order - b.order);
      const routeColor = getRouteColor(route.id);

      for (let i = 0; i < sortedStops.length - 1; i++) {
        const currentStop = sortedStops[i];
        const nextStop = sortedStops[i + 1];

        const departureMinutes = parseTimeToMinutes(currentStop.departureTime);
        const arrivalMinutes = parseTimeToMinutes(nextStop.arrivalTime);
        
        const fromPos = warehousePositions.find(p => p.id === currentStop.warehouseId);
        const toPos = warehousePositions.find(p => p.id === nextStop.warehouseId);

        if (fromPos && toPos) {
          // Рассчитываем расстояние по времени от текущего момента
          const segmentMidTime = (departureMinutes + arrivalMinutes) / 2;
          const timeDistance = Math.abs(timeSliderValue - segmentMidTime);
          
          // Определяем, является ли это текущей стрелкой
          const isCurrent = timeSliderValue >= departureMinutes && timeSliderValue <= arrivalMinutes;
          
          // Рассчитываем прозрачность (10%-50% для предыдущих, 100% для текущих)
          let opacity = 1; // Полная для текущих
          
          if (!isCurrent) {
            // Для предыдущих стрелок: чем дальше по времени, тем прозрачнее
            // Максимальное расстояние для расчета: 4 часа (240 минут)
            const maxTimeDistance = 240;
            const normalizedDistance = Math.min(timeDistance, maxTimeDistance) / maxTimeDistance;
            
            // Прозрачность от 50% (близко) до 10% (далеко)
            opacity = 0.5 - (normalizedDistance * 0.4); // 0.5 - 0.4 = 0.1 (10%)
            opacity = Math.max(0.1, Math.min(0.5, opacity)); // Ограничиваем 10%-50%
          }

          allArrows.push({
            from: fromPos,
            to: toPos,
            routeId: route.id,
            routeName: route.name || `Маршрут ${route.id.substring(0, 8)}`,
            color: routeColor,
            opacity,
            isCurrent,
            timeDistance
          });
        }
      }
    });

    console.log('🔄 Все стрелки маршрутов (текущие + предыдущие):', {
      totalArrows: allArrows.length,
      currentArrows: allArrows.filter(a => a.isCurrent).length,
      previousArrows: allArrows.filter(a => !a.isCurrent).length,
      arrowsData: allArrows.map(a => ({
        routeName: a.routeName,
        isCurrent: a.isCurrent,
        opacity: Math.round(a.opacity * 100) + '%',
        timeDistance: Math.round(a.timeDistance) + ' мин'
      }))
    });

    return allArrows;
  };

  const currentTime = formatTimeFromSlider(timeSliderValue);
  const transitionArrows = getTransitionArrows(); // Оставляем для совместимости
  const allArrows = getAllArrowsWithOpacity();
  const vehiclePositions = getVehiclePositions();

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    onDateChange?.(date);
  };

  const goToPreviousDay = () => {
    const newDate = subDays(selectedDate, 1);
    setSelectedDate(newDate);
    onDateChange?.(newDate);
  };

  const goToNextDay = () => {
    const newDate = addDays(selectedDate, 1);
    setSelectedDate(newDate);
    onDateChange?.(newDate);
  };

  const goToToday = () => {
    const today = new Date();
    setSelectedDate(today);
    onDateChange?.(today);
  };

  return (
    <div className="space-y-6">
      {/* Date Selection */}
      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {assignedRoutes.length > 0 
            ? `Назначенные маршруты на ${format(selectedDate, 'd MMMM yyyy', { locale: ru })}`
            : 'Выбор даты для графика работ'
          }
        </h3>
        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={goToPreviousDay}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            title="Предыдущий день"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {format(selectedDate, 'd MMMM', { locale: ru })}
            </div>
            <div className="text-sm text-gray-500">
              {format(selectedDate, 'EEEE', { locale: ru })}
            </div>
          </div>
          
          <button
            onClick={goToNextDay}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            title="Следующий день"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        
        <div className="mt-4 flex justify-center">
          <button
            onClick={goToToday}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
          >
            Сегодня
          </button>
        </div>
        
        <div className="mt-4 text-center">
          <input
            type="date"
            value={format(selectedDate, 'yyyy-MM-dd')}
            onChange={(e) => handleDateChange(new Date(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        
        {assignedRoutes.length > 0 && (
          <div className="mt-4 text-center">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
              📋 {assignedRoutes.length} маршрут{assignedRoutes.length === 1 ? '' : assignedRoutes.length < 5 ? 'а' : 'ов'} назначено
            </div>
          </div>
        )}
        
        {assignedRoutes.length === 0 && (
          <div className="mt-4 text-center">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-sm font-medium">
              📅 На выбранную дату маршруты не назначены
            </div>
          </div>
        )}

        {/* Map Mode Toggle */}
        <div className="mt-4 flex justify-center">
          <div className="bg-gray-100 rounded-lg p-1 flex">
            <button
              onClick={() => setShowTrafficMap(false)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                !showTrafficMap
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🗺️ Интерактивная карта
            </button>
            <button
              onClick={() => setShowTrafficMap(true)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                showTrafficMap
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🚦 Карта с пробками
            </button>
          </div>
        </div>
      </div>

      {/* Traffic Map or Interactive Map */}
      {showTrafficMap ? (
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Карта маршрутов с пробками</h3>
          <TrafficAwareRouteMap
            routes={routesToDisplay}
            warehouses={warehouses}
            selectedDate={selectedDate}
            height="600px"
          />
        </div>
      ) : (
        <>
          {/* Time Slider */}
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Временная шкала</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">06:30</span>
                <span className="text-lg font-bold text-primary-600">{currentTime}</span>
                <span className="text-sm font-medium text-gray-700">21:00</span>
              </div>
              
              {/* Timeline with driver segments */}
              <div className="relative">
                <input
                  type="range"
                  min="390"
                  max="1260"
                  value={Math.max(390, Math.min(1260, timeSliderValue))}
                  onChange={(e) => onTimeSliderChange(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider relative z-20"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((Math.max(390, Math.min(1260, timeSliderValue)) - 390) / (1260 - 390)) * 100}%, #e5e7eb ${((Math.max(390, Math.min(1260, timeSliderValue)) - 390) / (1260 - 390)) * 100}%, #e5e7eb 100%)`
                  }}
                />
                
              </div>
              
              <div className="text-sm text-gray-500 text-center">
                Перемещайте бегунок для просмотра состояния маршрутов в разное время.
              </div>
            </div>
            
          </div>

          {/* Interactive Map */}
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Интерактивная карта складов</h3>
            <div 
              ref={mapRef}
              className="relative bg-gray-50 border-2 border-gray-200 rounded-lg overflow-hidden"
              style={{ height: '600px', width: '100%' }}
            >
              {/* Warehouse Icons */}
              {warehousePositions.map(position => {
                const status = getWarehouseStatusAtTime(position.id, timeSliderValue);
                const isActive = status.isActive || status.isTransitioning;
                
                // Определяем цвет склада
                let warehouseBackgroundColor = '#9ca3af'; // Серый по умолчанию
                let borderColor = '#9ca3af';
                let borderStyle = 'border-gray-400';
                
                if (status.isStartWarehouse && status.startWarehouseColor) {
                  // Начальный склад подсвечивается цветом маршрута
                  warehouseBackgroundColor = status.startWarehouseColor;
                  borderColor = status.startWarehouseColor;
                  borderStyle = 'border-white';
                } else if (isActive) {
                  // Активный склад обычным цветом
                  warehouseBackgroundColor = position.warehouse.color;
                  borderColor = 'white';
                  borderStyle = 'border-white';
                }
                
                return (
                  <div
                    key={position.id}
                    className={`absolute rounded-lg border-4 flex flex-col items-center justify-center text-white font-bold text-xs cursor-move transition-all duration-200 ${
                      isActive || status.isStartWarehouse
                        ? `${borderStyle} shadow-lg transform scale-105` 
                        : 'border-gray-400 opacity-60'
                    }`}
                    style={{
                      left: position.x,
                      top: position.y,
                      backgroundColor: warehouseBackgroundColor,
                      borderColor: borderColor,
                      zIndex: draggedWarehouse === position.id ? 1000 : status.isTransitioning ? 100 : 10,
                      minWidth: '120px',
                      minHeight: '60px',
                      padding: '8px',
                      // Дополнительная подсветка для начального склада
                      boxShadow: status.isStartWarehouse 
                        ? `0 0 20px ${status.startWarehouseColor}60, 0 4px 8px rgba(0,0,0,0.2)` 
                        : isActive 
                        ? '0 4px 8px rgba(0,0,0,0.2)'
                        : 'none'
                    }}
                    onMouseDown={(e) => handleMouseDown(e, position.id)}
                    title={`${position.warehouse.name}\nID: ${position.id}\nАдрес: ${position.warehouse.fullAddress || 'Не указан'}\nСтатус: ${
                      status.isStartWarehouse ? 'Начальный склад маршрута' :
                      isActive ? 'Активен' : 'Неактивен'
                    }`}
                  >
                    <div className="text-center leading-tight">
                      {(() => {
                        const warehouseName = position.warehouse.name || `Склад ${position.id.substring(0, 8)}`;
                        
                        if (warehouseName.length <= 12) {
                          // Короткое название - показываем в одну строку
                          return (
                            <div className="font-bold text-xs">
                              {warehouseName}
                            </div>
                          );
                        } else if (warehouseName.length <= 20) {
                          // Среднее название - разбиваем на две строки по словам
                          const words = warehouseName.split(' ');
                          const midPoint = Math.ceil(words.length / 2);
                          const firstLine = words.slice(0, midPoint).join(' ');
                          const secondLine = words.slice(midPoint).join(' ');
                          
                          return (
                            <>
                              <div className="font-bold text-xs">
                                {firstLine}
                              </div>
                              <div className="text-xs opacity-90 mt-1">
                                {secondLine}
                              </div>
                            </>
                          );
                        } else {
                          // Длинное название - обрезаем с многоточием
                          return (
                            <div className="font-bold text-xs">
                              {warehouseName.substring(0, 17)}...
                            </div>
                          );
                        }
                      })()}
                    </div>
                  </div>
                );
              })}

              {/* All Arrows - текущие и предыдущие с прозрачностью */}
              {allArrows.map((arrow, index) => {
                const deltaX = arrow.to.x - arrow.from.x;
                const deltaY = arrow.to.y - arrow.from.y;
                const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
                
                // Конвертируем opacity в hex для цветов
                const opacityHex = Math.round(arrow.opacity * 255).toString(16).padStart(2, '0');
                const colorWithOpacity = arrow.color + opacityHex;
                
                return (
                  <div
                    key={`${arrow.routeId}-${index}-${arrow.isCurrent ? 'current' : 'previous'}`}
                    className={`absolute pointer-events-none ${arrow.isCurrent ? 'transition-arrow' : ''}`}
                    style={{
                      left: arrow.from.x + 60, // Center of warehouse icon (120px width / 2)
                      top: arrow.from.y + 30, // Center of warehouse icon (60px height / 2)
                      width: length,
                      height: arrow.isCurrent ? '6px' : '4px', // Текущие стрелки толще
                      backgroundColor: colorWithOpacity,
                      transformOrigin: '0 50%',
                      transform: `rotate(${angle}deg)`,
                      zIndex: arrow.isCurrent ? 50 : 30, // Текущие стрелки выше
                      opacity: arrow.opacity,
                      boxShadow: arrow.isCurrent ? `0 0 8px ${arrow.color}40` : 'none'
                    }}
                    title={`${arrow.routeName}\nОт: ${arrow.from.warehouse.name}\nДо: ${arrow.to.warehouse.name}\nСтатус: ${arrow.isCurrent ? 'Текущий переход' : 'Предыдущий переход'}\nПрозрачность: ${Math.round(arrow.opacity * 100)}%\nВременное расстояние: ${Math.round(arrow.timeDistance)} мин`}
                  >
                    {/* Arrow head */}
                    <div
                      className="absolute right-0 top-1/2 transform -translate-y-1/2"
                      style={{
                        width: 0,
                        height: 0,
                        borderLeft: `${arrow.isCurrent ? '12px' : '8px'} solid ${colorWithOpacity}`,
                        borderTop: `${arrow.isCurrent ? '8px' : '6px'} solid transparent`,
                        borderBottom: `${arrow.isCurrent ? '8px' : '6px'} solid transparent`,
                        opacity: arrow.opacity
                      }}
                    />
                    
                    {/* Route label - только для текущих стрелок */}
                    {arrow.isCurrent && (
                      <div
                        className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 px-2 py-1 bg-white border rounded shadow-sm text-xs font-medium whitespace-nowrap"
                        style={{
                          color: arrow.color,
                          borderColor: arrow.color
                        }}
                      >
                        {arrow.routeName}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Vehicle Icons */}
              {vehiclePositions.map((vehicle, index) => (
                <div
                  key={`vehicle-${vehicle.routeId}-${index}`}
                  className="absolute pointer-events-none"
                  style={{
                    left: vehicle.x - 16, // Центрируем иконку (32px width / 2)
                    top: vehicle.y - 16, // Центрируем иконку (32px height / 2)
                    zIndex: 200 // Поверх всех остальных элементов
                  }}
                >
                  {/* Vehicle Icon */}
                  <div
                    className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white font-bold text-lg shadow-lg transform transition-all duration-300"
                    style={{
                      backgroundColor: vehicle.color,
                      animation: vehicle.status === 'in_transit' ? 'pulse 2s infinite' : 'none'
                    }}
                    title={`${vehicle.routeName}\nСтатус: ${
                      vehicle.isLunchTime ? 'Обед' : 
                      vehicle.status === 'at_warehouse' ? 'На складе' : 'В пути'
                    }\n${
                      vehicle.status === 'in_transit' 
                        ? `Прогресс: ${Math.round((vehicle.progress || 0) * 100)}%\nОт: ${getWarehouseName(vehicle.fromWarehouse || '')}\nДо: ${getWarehouseName(vehicle.toWarehouse || '')}`
                        : vehicle.isLunchTime
                        ? `Обед: ${vehicle.lunchDuration} мин\nСклад: ${getWarehouseName(vehicle.currentWarehouse || '')}`
                        : `Склад: ${getWarehouseName(vehicle.currentWarehouse || '')}`
                    }`}
                  >
                    {vehicle.isLunchTime ? '🍽️' : '🚚'}
                  </div>
                  
                  {/* Lunch Time Indicator */}
                  {vehicle.isLunchTime && (
                    <div
                      className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-orange-100 border border-orange-300 rounded shadow-sm text-xs font-medium whitespace-nowrap"
                      style={{
                        color: '#ea580c'
                      }}
                    >
                      🍽️ Обед {vehicle.lunchDuration} мин
                    </div>
                  )}
                  
                  {/* Vehicle Label */}
                  <div
                    className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 px-2 py-1 bg-white border rounded shadow-sm text-xs font-medium whitespace-nowrap"
                    style={{
                      color: vehicle.color,
                      borderColor: vehicle.color
                    }}
                  >
                    {vehicle.routeName}
                    {vehicle.status === 'in_transit' && vehicle.progress && (
                      <div className="text-xs opacity-75">
                        {Math.round(vehicle.progress * 100)}%
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Grid lines for better positioning */}
              <svg 
                className="absolute inset-0 pointer-events-none opacity-20"
                width="100%" 
                height="100%"
              >
                <defs>
                  <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                    <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#d1d5db" strokeWidth="1"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>

              {/* Instructions overlay */}
              {warehousePositions.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <div className="text-4xl mb-4">🗺️</div>
                    <h4 className="text-lg font-medium mb-2">Выберите маршруты</h4>
                    <p>Выберите один или несколько маршрутов выше для отображения складов на карте</p>
                  </div>
                </div>
              )}
            </div>
            
            {warehousePositions.length > 0 && (
              <div className="mt-4 space-y-4">
                {/* Легенда цветов маршрутов */}
                {routesToDisplay.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">
                      {assignedRoutes.length > 0 ? 'Назначенные маршруты:' : 'Цвета маршрутов:'}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {routesToDisplay.map((route, index) => {
                        const routeColor = getRouteColor(route.id);
                        
                        return (
                          <div key={route.id} className="flex items-center space-x-2">
                            <div 
                              className="w-4 h-4 rounded border"
                              style={{ 
                                backgroundColor: routeColor,
                                borderColor: routeColor
                              }}
                            />
                            <span className="text-sm text-gray-700 truncate">
                              {route.name || `Маршрут ${index + 1}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Инструкции */}
                <div className="text-sm text-gray-600">
                  <p><strong>Инструкции:</strong></p>
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    <li>Перетаскивайте склады левой кнопкой мыши для изменения позиции</li>
                    <li>Используйте временную шкалу для просмотра активности складов</li>
                    <li>Цветные склады - активны в выбранное время</li>
                    <li>Серые склады - неактивны в выбранное время</li>
                    <li>Цветные стрелки - движение между складами (каждый маршрут своим цветом)</li>
                    <li>🚚 Иконки автомобилей - показывают текущее положение каждого маршрута</li>
                    <li>Автомобили двигаются по стрелкам в зависимости от времени на шкале</li>
                    <li>Позиции складов сохраняются автоматически при перетаскивании</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Route Details */}
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Детали маршрутов на время {currentTime}
            </h3>
            <div className="space-y-4">
              {routesToDisplay.map(route => {

                const currentActivity = getCurrentRouteActivity(route, timeSliderValue);
                
                return (
                  <div key={route.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">
                        {route.name || `Маршрут ${route.id.substring(0, 8)}`}
                      </h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        currentActivity.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : currentActivity.isTransitioning
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {currentActivity.status}
                      </span>
                    </div>
                    
                    {currentActivity.currentStop && (
                      <div className="text-sm text-gray-600">
                        <p><strong>Текущая остановка:</strong> {getWarehouseName(currentActivity.currentStop.warehouseId)}</p>
                        <p><strong>Прибытие:</strong> {currentActivity.currentStop.arrivalTime}</p>
                        <p><strong>Отъезд:</strong> {currentActivity.currentStop.departureTime}</p>
                      </div>
                    )}
                    
                    {currentActivity.transitInfo && (
                      <div className="text-sm text-gray-600">
                        <p><strong>В пути:</strong> {getWarehouseName(currentActivity.transitInfo.from)} → {getWarehouseName(currentActivity.transitInfo.to)}</p>
                        <p><strong>Отъезд:</strong> {currentActivity.transitInfo.departureTime}</p>
                        <p><strong>Ожидаемое прибытие:</strong> {currentActivity.transitInfo.arrivalTime}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );

  // Helper function to get current route activity
  function getCurrentRouteActivity(route: Route, currentTimeMinutes: number) {
    if (!route.stops) return { status: 'Нет остановок', isActive: false, isTransitioning: false };

    const sortedStops = route.stops.sort((a, b) => a.order - b.order);
    
    // Check if currently at a warehouse
    for (const stop of sortedStops) {
      const arrivalMinutes = parseTimeToMinutes(stop.arrivalTime);
      const departureMinutes = parseTimeToMinutes(stop.departureTime);
      
      if (currentTimeMinutes >= arrivalMinutes && currentTimeMinutes <= departureMinutes) {
        return {
          status: 'На складе',
          isActive: true,
          isTransitioning: false,
          currentStop: stop
        };
      }
    }
    
    // Check if in transit between warehouses
    for (let i = 0; i < sortedStops.length - 1; i++) {
      const currentStop = sortedStops[i];
      const nextStop = sortedStops[i + 1];
      
      const currentDepartureMinutes = parseTimeToMinutes(currentStop.departureTime);
      const nextArrivalMinutes = parseTimeToMinutes(nextStop.arrivalTime);
      
      if (currentTimeMinutes >= currentDepartureMinutes && currentTimeMinutes <= nextArrivalMinutes) {
        return {
          status: 'В пути',
          isActive: false,
          isTransitioning: true,
          transitInfo: {
            from: currentStop.warehouseId,
            to: nextStop.warehouseId,
            departureTime: currentStop.departureTime,
            arrivalTime: nextStop.arrivalTime
          }
        };
      }
    }
    
    return { status: 'Неактивен', isActive: false, isTransitioning: false };
  }

  // Helper function to get warehouse name
  function getWarehouseName(warehouseId: string): string {
    const warehouse = warehouses.find(w => w.id === warehouseId);
    return warehouse?.name || warehouseId.substring(0, 8);
  }
};

export default RouteMapView;
