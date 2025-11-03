import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { User, Warehouse, TransferRequest, Vehicle, Shift, WorkSchedule, Route } from '../types';
import { Database } from '../utils/database';

interface AppState {
  currentUser: User | null;
  users: User[];
  warehouses: Warehouse[];
  transferRequests: TransferRequest[];
  vehicles: Vehicle[];
  shifts: Shift[];
  workSchedules: WorkSchedule[];
  routes: Route[];
  isLoading: boolean;
}

type AppAction = 
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'LOGOUT' }
  | { type: 'ADD_USER'; payload: User }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'DELETE_USER'; payload: string }
  | { type: 'ADD_WAREHOUSE'; payload: Warehouse }
  | { type: 'UPDATE_WAREHOUSE'; payload: Warehouse }
  | { type: 'DELETE_WAREHOUSE'; payload: string }
  | { type: 'ADD_TRANSFER_REQUEST'; payload: TransferRequest }
  | { type: 'UPDATE_TRANSFER_REQUEST'; payload: TransferRequest }
  | { type: 'DELETE_TRANSFER_REQUEST'; payload: string }
  | { type: 'ADD_VEHICLE'; payload: Vehicle }
  | { type: 'UPDATE_VEHICLE'; payload: Vehicle }
  | { type: 'DELETE_VEHICLE'; payload: string }
  | { type: 'ADD_SHIFT'; payload: Shift }
  | { type: 'UPDATE_SHIFT'; payload: Shift }
  | { type: 'DELETE_SHIFT'; payload: string }
  | { type: 'ADD_WORK_SCHEDULE'; payload: WorkSchedule }
  | { type: 'UPDATE_WORK_SCHEDULE'; payload: WorkSchedule }
  | { type: 'DELETE_WORK_SCHEDULE'; payload: string }
  | { type: 'ADD_ROUTE'; payload: Route }
  | { type: 'UPDATE_ROUTE'; payload: Route }
  | { type: 'DELETE_ROUTE'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'INITIALIZE_DATA'; payload: { users: User[]; warehouses: Warehouse[]; transferRequests: TransferRequest[]; vehicles: Vehicle[]; shifts: Shift[]; workSchedules: WorkSchedule[]; routes: Route[] } };

const initialState: AppState = {
  currentUser: null,
  users: [],
  warehouses: [],
  transferRequests: [],
  vehicles: [],
  shifts: [],
  workSchedules: [],
  routes: [],
  isLoading: false,
};

// Mock data for demo
const mockWarehouses: Warehouse[] = [
  {
    id: '1',
    name: 'Central Warehouse',
    fullAddress: '123 Main Street, New York, NY 10001',
    unit: 'Suite 100A',
    phoneNumber: '+1 (555) 123-4567',
    assignedEmployee: 'John Smith',
    workingHours: '9:00 AM - 6:00 PM',
    instructions: 'Main distribution center. Use loading dock B for large deliveries. Security code: 1234. Contact John Smith for special handling requirements.',
    iconColor: '#3b82f6', // Blue
    trafficScenario: 'best_guess', // Лучший прогноз для центрального склада
    coordinates: { lat: 34.0522, lng: -118.2437 }, // Downtown LA coordinates
    createdAt: new Date('2023-01-15'),
  },
  {
    id: '2',
    name: 'Warehouse #2',
    fullAddress: '456 Industrial Blvd, Los Angeles, CA 90028',
    unit: 'Building C, Floor 2',
    phoneNumber: '+1 (555) 987-6543',
    assignedEmployee: 'Mike Johnson',
    workingHours: '8:00 AM - 5:00 PM',
    instructions: 'Secondary storage facility. Fragile items only. Ring doorbell twice. Parking available in rear. Check temperature-controlled section for special items.',
    iconColor: '#10b981', // Green
    trafficScenario: 'pessimistic', // Пессимистический для хрупких товаров
    coordinates: { lat: 34.0928, lng: -118.3287 }, // Beverly Hills area coordinates
    createdAt: new Date('2023-02-20'),
  },
];


// Mock users for demo
const mockUsers: User[] = [
  {
    id: '1',
    firstName: 'Admin',
    lastName: 'User',
    login: 'admin',
    password: 'admin123',
    phoneNumber: '+1 (555) 123-4567',
    warehouseId: '1',
    role: 'admin',
    email: 'admin@ntruck.com',
    name: 'Admin User',
    createdAt: new Date('2023-01-01'),
  },
  {
    id: '2',
    firstName: 'John',
    lastName: 'Warehouse',
    login: 'warehouse1',
    password: 'warehouse123',
    phoneNumber: '+1 (555) 234-5678',
    warehouseId: '1',
    role: 'warehouse_employee',
    email: 'warehouse@ntruck.com',
    name: 'John Warehouse',
    createdAt: new Date('2023-01-15'),
  },
  {
    id: '3',
    firstName: 'Mike',
    lastName: 'Driver',
    login: 'driver1',
    password: 'driver123',
    phoneNumber: '+1 (555) 345-6789',
    warehouseId: '2',
    role: 'driver',
    createdAt: new Date('2023-02-01'),
  },
  {
    id: '4',
    firstName: 'Sarah',
    lastName: 'Johnson',
    login: 'driver2',
    password: 'driver456',
    phoneNumber: '+1 (555) 456-7890',
    warehouseId: '1',
    role: 'driver',
    createdAt: new Date('2023-02-15'),
  },
  {
    id: '5',
    firstName: 'Vlad',
    lastName: 'Driver',
    login: 'vlad_driver',
    password: 'vlad123',
    phoneNumber: '+1 (555) 567-8901',
    warehouseId: '2',
    role: 'driver',
    email: 'vlad@ntruck.com',
    name: 'Vlad Driver',
    createdAt: new Date('2023-03-01'),
  },
];

// Mock shifts for demo
const mockShifts: Shift[] = [
  {
    id: '1',
    number: 1,
    startTime: '08:00',
    endTime: '16:00',
    name: 'Day Shift',
    createdAt: new Date('2023-01-01'),
  },
  {
    id: '2',
    number: 2,
    startTime: '16:00',
    endTime: '00:00',
    name: 'Evening Shift',
    createdAt: new Date('2023-01-01'),
  },
  {
    id: '3',
    number: 3,
    startTime: '00:00',
    endTime: '08:00',
    name: 'Night Shift',
    createdAt: new Date('2023-01-01'),
  },
];

// Mock vehicles for demo
const mockVehicles: Vehicle[] = [
  {
    id: '1',
    name: 'Truck 001',
    seatingCapacity: 2,
    weight: 8000,
    odometerMiles: 45000,
    lastMaintenanceDate: new Date('2024-01-15'),
    assignedDriver: 'Mike Driver',
    speedLimit: 55,
    gpsApiKey: 'Xx7MWwsUEOBjRVr7NfDQc9PEBiEN1qna',
    gpsDeviceId: '153332', // Trak-4 DeviceID (Peterbilt_220)
    createdAt: new Date('2023-01-01'),
  },
  {
    id: '2',
    name: 'Truck 002',
    seatingCapacity: 2,
    weight: 7500,
    odometerMiles: 32000,
    lastMaintenanceDate: new Date('2024-02-01'),
    assignedDriver: 'Vlad Driver',
    speedLimit: 60,
    gpsApiKey: 'Xx7MWwsUEOBjRVr7NfDQc9PEBiEN1qna',
    gpsDeviceId: '153159', // Trak-4 DeviceID с реальными GPS данными
    createdAt: new Date('2023-02-01'),
  },
  {
    id: '3',
    name: 'Van 003',
    seatingCapacity: 3,
    weight: 5500,
    odometerMiles: 28000,
    lastMaintenanceDate: new Date('2024-01-20'),
    assignedDriver: 'John Smith',
    speedLimit: 65,
    gpsApiKey: 'Xx7MWwsUEOBjRVr7NfDQc9PEBiEN1qna',
    gpsDeviceId: '153332', // Trak-4 DeviceID (Peterbilt_220)
    createdAt: new Date('2023-03-01'),
  },
];

// Mock work schedules for demo
const mockWorkSchedules: WorkSchedule[] = [
  {
    id: '1',
    driverId: '3', // Mike Driver
    year: 2024,
    month: 1, // January
    schedule: {
      1: '1', 2: '1', 3: '2', 4: '2', 5: '1', // routeId instead of shiftId
      8: '1', 9: '1', 10: '2', 11: '2', 12: '1',
      15: '2', 16: '2', 17: '1', 18: '1', 19: '2',
      22: '2', 23: '1', 24: '1', 25: '2', 26: '2',
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: '2',
    driverId: '4', // Sarah Johnson
    year: 2024,
    month: 1, // January
    schedule: {
      2: '2', 3: '1', 4: '1', 5: '2', 6: '2',
      9: '2', 10: '1', 11: '1', 12: '2', 13: '2',
      16: '1', 17: '2', 18: '2', 19: '1', 20: '1',
      23: '1', 24: '2', 25: '1', 26: '1', 27: '2',
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

// Mock routes for demo
const mockRoutes: Route[] = [
  {
    id: '1',
    name: 'NYC Morning Route',
    stops: [
      {
        id: '1',
        warehouseId: '1', // Central Warehouse
        arrivalTime: '07:00',
        departureTime: '08:30',
        order: 1,
      },
      {
        id: '2',
        warehouseId: '2', // Warehouse #2
        arrivalTime: '10:00',
        departureTime: '11:30',
        order: 2,
      },
    ],
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: '2',
    name: 'Evening Distribution',
    stops: [
      {
        id: '3',
        warehouseId: '2', // Warehouse #2
        arrivalTime: '15:00',
        departureTime: '16:00',
        order: 1,
      },
      {
        id: '4',
        warehouseId: '1', // Central Warehouse
        arrivalTime: '17:30',
        departureTime: '19:00',
        order: 2,
      },
    ],
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: '3',
    name: 'Vlad Daily Route',
    stops: [
      {
        id: '5',
        warehouseId: '1', // Central Warehouse
        arrivalTime: '09:00',
        departureTime: '10:00',
        order: 1,
      },
      {
        id: '6',
        warehouseId: '2', // Warehouse #2
        arrivalTime: '11:00',
        departureTime: '12:00',
        order: 2,
      },
    ],
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    driverId: '5', // Vlad Driver ID
    weekday: 1, // Monday (1 = Monday, 2 = Tuesday, etc.)
  },
];

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, currentUser: action.payload };
    case 'LOGOUT':
      return { ...state, currentUser: null };
    case 'ADD_USER':
      return {
        ...state,
        users: [...state.users, action.payload],
      };
    case 'UPDATE_USER':
      return {
        ...state,
        users: state.users.map(u =>
          u.id === action.payload.id ? action.payload : u
        ),
      };
    case 'DELETE_USER':
      return {
        ...state,
        users: state.users.filter(u => u.id !== action.payload),
      };
    case 'ADD_WAREHOUSE':
      return { 
        ...state, 
        warehouses: [...state.warehouses, action.payload] 
      };
    case 'UPDATE_WAREHOUSE':
      return {
        ...state,
        warehouses: state.warehouses.map(w => 
          w.id === action.payload.id ? action.payload : w
        ),
      };
    case 'DELETE_WAREHOUSE':
      return {
        ...state,
        warehouses: state.warehouses.filter(w => w.id !== action.payload),
      };
    case 'ADD_TRANSFER_REQUEST':
      return {
        ...state,
        transferRequests: [...state.transferRequests, action.payload],
      };
    case 'UPDATE_TRANSFER_REQUEST':
      return {
        ...state,
        transferRequests: state.transferRequests.map(tr =>
          tr.id === action.payload.id ? action.payload : tr
        ),
      };
    case 'DELETE_TRANSFER_REQUEST':
      return {
        ...state,
        transferRequests: state.transferRequests.filter(tr => tr.id !== action.payload),
      };
    case 'ADD_VEHICLE':
      return {
        ...state,
        vehicles: [...state.vehicles, action.payload],
      };
    case 'UPDATE_VEHICLE':
      return {
        ...state,
        vehicles: state.vehicles.map(v =>
          v.id === action.payload.id ? action.payload : v
        ),
      };
    case 'DELETE_VEHICLE':
      return {
        ...state,
        vehicles: state.vehicles.filter(v => v.id !== action.payload),
      };
    case 'ADD_SHIFT':
      return {
        ...state,
        shifts: [...state.shifts, action.payload],
      };
    case 'UPDATE_SHIFT':
      return {
        ...state,
        shifts: state.shifts.map(s =>
          s.id === action.payload.id ? action.payload : s
        ),
      };
    case 'DELETE_SHIFT':
      return {
        ...state,
        shifts: state.shifts.filter(s => s.id !== action.payload),
      };
    case 'ADD_WORK_SCHEDULE':
      return {
        ...state,
        workSchedules: [...state.workSchedules, action.payload],
      };
    case 'UPDATE_WORK_SCHEDULE':
      return {
        ...state,
        workSchedules: state.workSchedules.map(ws =>
          ws.id === action.payload.id ? action.payload : ws
        ),
      };
    case 'DELETE_WORK_SCHEDULE':
      return {
        ...state,
        workSchedules: state.workSchedules.filter(ws => ws.id !== action.payload),
      };
    case 'ADD_ROUTE':
      console.log('ADD_ROUTE reducer called with:', action.payload);
      console.log('Current routes count:', state.routes.length);
      const newState = {
        ...state,
        routes: [...state.routes, action.payload],
      };
      console.log('New routes count:', newState.routes.length);
      return newState;
    case 'UPDATE_ROUTE':
      console.log('UPDATE_ROUTE reducer called with:', action.payload);
      return {
        ...state,
        routes: state.routes.map(r =>
          r.id === action.payload.id ? action.payload : r
        ),
      };
    case 'DELETE_ROUTE':
      return {
        ...state,
        routes: state.routes.filter(r => r.id !== action.payload),
      };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'INITIALIZE_DATA':
      return {
        ...state,
        users: action.payload.users,
        warehouses: action.payload.warehouses,
        transferRequests: action.payload.transferRequests,
        vehicles: action.payload.vehicles,
        shifts: action.payload.shifts,
        workSchedules: action.payload.workSchedules,
        routes: action.payload.routes,
      };
    default:
      return state;
  }
};

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Initialize with data from server database or mock data
  React.useEffect(() => {
    (async () => {
      try {
        const savedData = await Database.load();
        if (savedData) {
          dispatch({
            type: 'INITIALIZE_DATA',
            payload: savedData,
          });
        } else {
          const initialData = {
            users: mockUsers,
            warehouses: mockWarehouses,
            transferRequests: [],
            vehicles: mockVehicles,
            shifts: mockShifts,
            workSchedules: mockWorkSchedules,
            routes: mockRoutes,
          };
          dispatch({
            type: 'INITIALIZE_DATA',
            payload: initialData,
          });
          await Database.save(initialData);
        }
      } catch (e) {
        console.error('❌ Failed to initialize app data:', e);
      }
    })();
  }, []);

  // Auto-save to database whenever state changes (except currentUser)
  React.useEffect(() => {
    if (state.users.length > 0) { // Only save if data is initialized
      const dataToSave = {
        users: state.users,
        warehouses: state.warehouses,
        transferRequests: state.transferRequests,
        vehicles: state.vehicles,
        shifts: state.shifts,
        workSchedules: state.workSchedules,
        routes: state.routes,
      };
      void Database.save(dataToSave);
    }
  }, [
    state.users,
    state.warehouses,
    state.transferRequests,
    state.vehicles,
    state.shifts,
    state.workSchedules,
    state.routes,
  ]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};
