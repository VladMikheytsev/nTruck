export type UserRole = 'admin' | 'warehouse_employee' | 'driver';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  login: string;
  password: string;
  phoneNumber: string;
  telegramId?: string; // Telegram ID пользователя
  warehouseId: string; // ID склада к которому привязан
  role: UserRole;
  email?: string; // Optional for backward compatibility
  name?: string; // Optional for backward compatibility
  createdAt: Date;
}

export interface Vehicle {
  id: string;
  name: string;
  model?: string;
  licensePlate?: string;
  driverId?: string;
  status: 'available' | 'in_use' | 'maintenance' | 'out_of_service';
  location?: string;
  fuelLevel?: number;
  mileage?: number;
  lastMaintenance?: string;
  gpsApiKey?: string;
  gpsDeviceId?: string | number;
  trak4DeviceId?: string | number;
  createdAt: string;
}

export type TrafficScenario = 'pessimistic' | 'optimistic' | 'best_guess';

export interface Warehouse {
  id: string;
  name: string;
  fullAddress: string;
  unit: string; // Номер квартиры/офиса/склада
  phoneNumber: string;
  assignedEmployee: string;
  workingHours: string;
  instructions: string; // Инструкция для склада
  iconColor: string; // Цвет иконки склада
  trafficScenario: TrafficScenario; // Сценарий расчета времени прибытия
  coordinates?: { lat: number; lng: number }; // GPS координаты склада для расчета расстояний
  createdAt: Date;
}

export interface TransferItem {
  id: string;
  name: string;
  type: string; // Тип позиции вписывается вручную
  quantity: number;
}

export type TransferStatus = 'created' | 'in_progress' | 'completed' | 'cancelled';

export interface TransferRequest {
  id: string;
  createdBy: string;
  createdAt: Date;
  deadline: Date;
  sourceWarehouse: string;
  destinationWarehouse: string;
  items: TransferItem[];
  status: TransferStatus;
  notes?: string;
  // Route information
  routeId?: string;
  sourceDepartureTime?: string;
  destinationArrivalTime?: string;
  assignedDriverId?: string;
  assignedVehicle?: string;
  // Audit trail
  updatedBy?: string;
  updatedAt?: Date;
  deletedBy?: string;
  deletedAt?: Date;
}

export interface Vehicle {
  id: string;
  name: string;
  seatingCapacity: number;
  weight: number; // in pounds
  odometerMiles: number;
  lastMaintenanceDate: Date;
  assignedDriver: string;
  speedLimit: number; // Максимальная скорость в милях в час (45-65 mph)
  gpsApiKey?: string; // GPS API ключ для отслеживания автомобиля
  gpsDeviceId?: string; // ID GPS устройства в системе trak-4.com (DeviceID - integer)
  createdAt: Date;
}

export interface Shift {
  id: string;
  number: number; // Цифра смены (1, 2, 3, etc.)
  startTime: string; // Время начала в формате "HH:MM"
  endTime: string; // Время окончания в формате "HH:MM"
  name?: string; // Название смены (опционально)
  createdAt: Date;
}

export interface WorkSchedule {
  id: string;
  driverId: string; // ID водителя
  year: number;
  month: number; // 1-12
  schedule: { [day: number]: string | null }; // day -> routeId or null
  createdAt: Date;
  updatedAt: Date;
}

export interface RouteStop {
  id: string;
  warehouseId: string;
  arrivalTime: string; // Время приезда в формате "HH:MM"
  departureTime: string; // Время выезда в формате "HH:MM"
  order: number; // Порядок остановки в маршруте
  hasLunch?: boolean; // Есть ли обед на этой остановке
  lunchDuration?: number; // Длительность обеда в минутах
}

export interface Route {
  id: string;
  name: string;
  weekday?: number | null; // 0 = Воскресенье, 1 = Понедельник, ..., 6 = Суббота
  driverId?: string; // ID назначенного водителя
  vehicleId?: string; // ID назначенного транспорта
  stops: RouteStop[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Интерфейсы для отслеживания прогресса маршрута
export interface RouteProgressStop {
  stopId: string;
  warehouseId: string;
  order: number;
  plannedArrival: string;
  plannedDeparture: string;
  actualArrival?: string;
  actualDeparture?: string;
  status: 'pending' | 'en_route' | 'arrived' | 'departed' | 'completed';
  enteredRadius?: string; // время входа в радиус 0.1 мили
  exitedRadius?: string; // время выхода из радиуса 0.1 мили
}

export interface IntermediateStop {
  id: string;
  position: {
    latitude: number;
    longitude: number;
  };
  startTime: string;
  endTime?: string;
  duration?: number; // в минутах
  type: 'intermediate' | 'unplanned';
  betweenStops: {
    fromStopId: string;
    toStopId: string;
  };
}

export interface RouteProgress {
  routeId: string;
  driverId: string;
  vehicleId: string;
  date: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'paused';
  currentStopIndex: number;
  stops: RouteProgressStop[];
  intermediateStops: IntermediateStop[];
  totalDistance?: number;
  totalDuration?: number;
  startTime?: string;
  endTime?: string;
  lastGPSUpdate: string;
}

// GPS Tracking Types
export interface GPSPosition {
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number; // km/h
  heading?: number; // degrees
  accuracy?: number; // meters
  timestamp: string;
  positionSource?: 'gps' | 'wifi' | 'bluetooth' | 'cell' | 'none' | 'unknown';
  hdop?: number; // GPS signal quality
}

export interface VehicleGPSData {
  vehicleId: string; // Our internal vehicle ID
  deviceId: number; // Trak-4 DeviceID (integer)
  keyCode?: string; // Trak-4 KeyCode (human-friendly identifier)
  label?: string; // Device label
  position: GPSPosition;
  status: 'online' | 'offline' | 'idle' | 'moving';
  lastUpdate: string;
  batteryLevel?: number; // VoltagePercent
  signalStrength?: number; // RSSI converted to 1-5 scale
  temperature?: number; // Internal temperature in Celsius
  deviceState?: string; // NotMoving_NotCharging, Moving_Charging, etc.
  reportReason?: string; // PeriodicReport, MovementChange, etc.
}
