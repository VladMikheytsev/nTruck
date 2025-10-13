// Simple localStorage-based database simulation
import { User, Warehouse, TransferRequest, Vehicle, Shift, WorkSchedule, Route } from '../types';

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
  static save(data: DatabaseSchema): void {
    try {
      const serializedData = serializeData(data);
      localStorage.setItem(DATABASE_KEY, JSON.stringify(serializedData));
      console.log('✅ Data saved to database');
    } catch (error) {
      console.error('❌ Error saving to database:', error);
    }
  }

  static load(): DatabaseSchema | null {
    try {
      const savedData = localStorage.getItem(DATABASE_KEY);
      if (!savedData) return null;
      
      const parsedData = JSON.parse(savedData);
      const deserializedData = deserializeData(parsedData);
      console.log('✅ Data loaded from database');
      return deserializedData;
    } catch (error) {
      console.error('❌ Error loading from database:', error);
      return null;
    }
  }

  static clear(): void {
    try {
      localStorage.removeItem(DATABASE_KEY);
      console.log('✅ Database cleared');
    } catch (error) {
      console.error('❌ Error clearing database:', error);
    }
  }

  static export(): string {
    const data = Database.load();
    return JSON.stringify(data, null, 2);
  }

  static import(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      Database.save(data);
      return true;
    } catch (error) {
      console.error('❌ Error importing data:', error);
      return false;
    }
  }
}
