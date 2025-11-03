// Server-backed database utility over HTTP
import { User, Warehouse, TransferRequest, Vehicle, Shift, WorkSchedule, Route } from '../types';
import { API_CONFIG } from '../config/api';

interface DatabaseSchema {
  users: User[];
  warehouses: Warehouse[];
  transferRequests: TransferRequest[];
  vehicles: Vehicle[];
  shifts: Shift[];
  workSchedules: WorkSchedule[];
  routes: Route[];
}

const DATABASE_KEY = 'ntruck_database';
const BASE_URL = API_CONFIG.API_URL;

// Serialize dates for localStorage
const serializeData = (data: any): any => {
  return JSON.parse(JSON.stringify(data, (_key, value) => {
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }
    return value;
  }));
};

// Deserialize dates from localStorage
const deserializeData = (data: any): any => {
  return JSON.parse(JSON.stringify(data), (_key, value) => {
    if (value && typeof value === 'object' && value.__type === 'Date') {
      return new Date(value.value);
    }
    return value;
  });
};

export class Database {
  static async save(data: DatabaseSchema): Promise<void> {
    try {
      const serializedData = serializeData(data);
      const res = await fetch(`${BASE_URL}/api/app-data`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serializedData),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      console.log('✅ Data saved to server database');
    } catch (error) {
      console.error('❌ Error saving to server database:', error);
    }
  }

  static async load(): Promise<DatabaseSchema | null> {
    try {
      const res = await fetch(`${BASE_URL}/api/app-data`, { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      if (!payload || !payload.data) return null;
      const deserializedData = deserializeData(payload.data);
      console.log('✅ Data loaded from server database');
      return deserializedData as DatabaseSchema;
    } catch (error) {
      console.error('❌ Error loading from server database:', error);
      return null;
    }
  }

  static async clear(): Promise<void> {
    try {
      // Store an empty object to effectively clear
      await fetch(`${BASE_URL}/api/app-data`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      console.log('✅ Server database cleared');
    } catch (error) {
      console.error('❌ Error clearing server database:', error);
    }
  }

  static async export(): Promise<string> {
    const data = await Database.load();
    return JSON.stringify(data, null, 2);
  }

  static async import(jsonData: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonData);
      await Database.save(data);
      return true;
    } catch (error) {
      console.error('❌ Error importing data to server:', error);
      return false;
    }
  }
}
