import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Vehicle } from '../types';
import { Plus, Edit, Trash2, Truck, Users, Weight, Gauge, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';
import { GPSTrackingService } from '../services/gpsTrackingService';

const FleetManagement: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [testingGPS, setTestingGPS] = useState<string | null>(null); // vehicleId being tested

  // Loading state check
  if (!state.vehicles || !state.users) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading fleet data...</p>
        </div>
      </div>
    );
  }

  const handleAddVehicle = () => {
    setEditingVehicle(null);
    setShowForm(true);
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setShowForm(true);
  };

  const handleDeleteVehicle = (vehicleId: string) => {
    if (window.confirm('Are you sure you want to delete this vehicle?')) {
      dispatch({ type: 'DELETE_VEHICLE', payload: vehicleId });
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingVehicle(null);
  };

  const handleTestGPS = async (vehicle: Vehicle) => {
    if (!vehicle.gpsApiKey || !vehicle.gpsDeviceId) {
      alert('GPS не настроен для этого автомобиля. Добавьте API ключ и Device ID.');
      return;
    }

    setTestingGPS(vehicle.id);
    
    try {
      console.log('🧪 Testing GPS for vehicle:', vehicle.name);
      console.log('📋 GPS Config:', {
        vehicleId: vehicle.id,
        apiKey: vehicle.gpsApiKey.substring(0, 8) + '...',
        deviceId: vehicle.gpsDeviceId
      });

      // Test API connection
      const testResult = await GPSTrackingService.testTrak4API(
        vehicle.gpsApiKey, 
        parseInt(vehicle.gpsDeviceId)
      );

      console.log('🧪 GPS Test Result:', testResult);

      if (testResult.success) {
        if (testResult.deviceFound) {
          if (testResult.hasCoordinates) {
            alert(`✅ GPS тест успешен!\n\n` +
              `Автомобиль: ${vehicle.name}\n` +
              `Device ID: ${vehicle.gpsDeviceId}\n` +
              `Координаты: ${testResult.coordinates.latitude}, ${testResult.coordinates.longitude}\n\n` +
              `GPS отслеживание работает корректно!`);
          } else {
            alert(`⚠️ Устройство найдено, но нет GPS координат!\n\n` +
              `Автомобиль: ${vehicle.name}\n` +
              `Device ID: ${vehicle.gpsDeviceId}\n\n` +
              `Возможные причины:\n` +
              `• GPS трекер не имеет фиксации спутников\n` +
              `• Устройство находится в помещении\n` +
              `• Устройство выключено или разряжено`);
          }
        } else {
          alert(`❌ Устройство не найдено!\n\n` +
            `Автомобиль: ${vehicle.name}\n` +
            `Device ID: ${vehicle.gpsDeviceId}\n\n` +
            `Проверьте правильность Device ID в системе Trak-4`);
        }
      } else {
        alert(`❌ Ошибка подключения к GPS!\n\n` +
          `Автомобиль: ${vehicle.name}\n` +
          `Ошибка: ${testResult.error}\n\n` +
          `Проверьте:\n` +
          `• Правильность API ключа\n` +
          `• Правильность Device ID\n` +
          `• Интернет соединение\n` +
          `• Работу прокси сервера (localhost:3002)`);
      }
    } catch (error) {
      console.error('❌ GPS Test Error:', error);
      alert(`❌ Ошибка тестирования GPS!\n\n` +
        `Автомобиль: ${vehicle.name}\n` +
        `Ошибка: ${error}\n\n` +
        `Убедитесь, что прокси сервер запущен на localhost:3002`);
    } finally {
      setTestingGPS(null);
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString('en-US');
  };

  const isMaintenanceDue = (lastMaintenanceDate: Date | string) => {
    const now = new Date();
    const maintenanceDate = new Date(lastMaintenanceDate);
    const timeDiff = now.getTime() - maintenanceDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    return daysDiff > 90; // Maintenance due if more than 90 days
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fleet Management</h1>
          <p className="text-gray-600 mt-1">Manage your vehicle fleet</p>
        </div>
        <button
          onClick={handleAddVehicle}
          className="btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Vehicle
        </button>
      </div>

      {/* Fleet Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center">
            <Truck className="h-5 w-5 text-primary-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Vehicles</p>
              <p className="text-lg font-semibold text-gray-900">{state.vehicles.length}</p>
            </div>
          </div>
        </div>
        
        <div className="card p-4">
          <div className="flex items-center">
            <Users className="h-5 w-5 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Capacity</p>
              <p className="text-lg font-semibold text-gray-900">
                {state.vehicles.reduce((sum, v) => sum + v.seatingCapacity, 0)} seats
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <Weight className="h-5 w-5 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Weight</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatNumber(state.vehicles.reduce((sum, v) => sum + v.weight, 0))} lbs
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <Calendar className="h-5 w-5 text-yellow-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Maintenance Due</p>
              <p className="text-lg font-semibold text-gray-900">
                {state.vehicles.filter(v => isMaintenanceDue(v.lastMaintenanceDate)).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Vehicles Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {state.vehicles.map((vehicle) => (
          <div key={vehicle.id} className={`card p-6 ${isMaintenanceDue(vehicle.lastMaintenanceDate) ? 'border-yellow-300 bg-yellow-50' : ''}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center">
                <Truck className="h-5 w-5 text-primary-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">{vehicle.name}</h3>
              </div>
              <div className="flex space-x-2">
                {/* GPS Test Button - only show if GPS is configured */}
                {vehicle.gpsApiKey && vehicle.gpsDeviceId && (
                  <button
                    onClick={() => handleTestGPS(vehicle)}
                    disabled={testingGPS === vehicle.id}
                    className="p-1 text-gray-400 hover:text-green-600 transition-colors disabled:opacity-50"
                    title="Тестировать GPS подключение"
                  >
                    {testingGPS === vehicle.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-600 border-t-transparent"></div>
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                )}
                
                <button
                  onClick={() => handleEditVehicle(vehicle)}
                  className="p-1 text-gray-400 hover:text-primary-600 transition-colors"
                  title="Редактировать автомобиль"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteVehicle(vehicle.id)}
                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                  title="Удалить автомобиль"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {isMaintenanceDue(vehicle.lastMaintenanceDate) && (
              <div className="mb-4 p-2 bg-yellow-100 border border-yellow-300 rounded-md">
                <p className="text-yellow-800 text-sm font-medium">⚠️ Maintenance Due</p>
              </div>
            )}

            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-center">
                <Users className="h-4 w-4 mr-2 flex-shrink-0" />
                <span>{vehicle.seatingCapacity} seats</span>
              </div>
              <div className="flex items-center">
                <Weight className="h-4 w-4 mr-2 flex-shrink-0" />
                <span>{formatNumber(vehicle.weight)} lbs</span>
              </div>
              <div className="flex items-center">
                <Gauge className="h-4 w-4 mr-2 flex-shrink-0" />
                <span>{formatNumber(vehicle.odometerMiles)} miles</span>
              </div>
              <div className="flex items-center">
                <User className="h-4 w-4 mr-2 flex-shrink-0" />
                <span>{vehicle.assignedDriver}</span>
              </div>
              <div className="flex items-center">
                <Gauge className="h-4 w-4 mr-2 flex-shrink-0 text-blue-500" />
                <span className="text-blue-600 font-medium">{vehicle.speedLimit} mph max</span>
              </div>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
                <span>Last maintenance: {format(new Date(vehicle.lastMaintenanceDate), 'MMM d, yyyy')}</span>
              </div>
              
              {/* GPS Status */}
              <div className="flex items-center">
                {vehicle.gpsApiKey && vehicle.gpsDeviceId ? (
                  <>
                    <svg className="h-4 w-4 mr-2 flex-shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-green-600 font-medium">GPS активен</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 mr-2 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-gray-500">GPS не настроен</span>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <span className="text-xs text-gray-500">
                Added: {format(new Date(vehicle.createdAt), 'MMM d, yyyy')}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {state.vehicles.length === 0 && (
        <div className="text-center py-12">
          <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No vehicles</h3>
          <p className="text-gray-500 mb-4">Start by adding your first vehicle to the fleet</p>
          <button onClick={handleAddVehicle} className="btn-primary">
            <Plus className="h-4 w-4 mr-2" />
            Add Vehicle
          </button>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <VehicleForm
          vehicle={editingVehicle}
          onClose={handleFormClose}
          onSave={(vehicle) => {
            if (editingVehicle) {
              dispatch({ type: 'UPDATE_VEHICLE', payload: vehicle });
            } else {
              dispatch({ type: 'ADD_VEHICLE', payload: vehicle });
            }
            handleFormClose();
          }}
          testingGPS={testingGPS}
          onTestGPS={handleTestGPS}
        />
      )}
    </div>
  );
};

interface VehicleFormProps {
  vehicle: Vehicle | null;
  onClose: () => void;
  onSave: (vehicle: Vehicle) => void;
  testingGPS: string | null;
  onTestGPS: (vehicle: Vehicle) => void;
}

const VehicleForm: React.FC<VehicleFormProps> = ({ vehicle, onClose, onSave, testingGPS, onTestGPS }) => {
  const { state } = useAppContext();
  const [formData, setFormData] = useState({
    name: vehicle?.name || '',
    seatingCapacity: vehicle?.seatingCapacity || 2,
    weight: vehicle?.weight || 5000,
    odometerMiles: vehicle?.odometerMiles || 0,
    lastMaintenanceDate: vehicle?.lastMaintenanceDate 
      ? format(new Date(vehicle.lastMaintenanceDate), 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd'),
    assignedDriver: vehicle?.assignedDriver || '',
    speedLimit: vehicle?.speedLimit || 55, // По умолчанию 55 mph
    gpsApiKey: vehicle?.gpsApiKey || '',
    gpsDeviceId: vehicle?.gpsDeviceId || '',
  });

  // Get available drivers
  const drivers = state.users.filter(user => user.role === 'driver');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newVehicle: Vehicle = {
      id: vehicle?.id || Date.now().toString(),
      name: formData.name,
      seatingCapacity: formData.seatingCapacity,
      weight: formData.weight,
      odometerMiles: formData.odometerMiles,
      lastMaintenanceDate: new Date(formData.lastMaintenanceDate),
      assignedDriver: formData.assignedDriver,
      speedLimit: formData.speedLimit,
      gpsApiKey: formData.gpsApiKey || undefined,
      gpsDeviceId: formData.gpsDeviceId || undefined,
      createdAt: vehicle?.createdAt || new Date(),
    };

    onSave(newVehicle);
  };

  const handleChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = ['seatingCapacity', 'weight', 'odometerMiles'].includes(field) 
      ? parseInt(e.target.value) || 0
      : e.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {vehicle ? 'Edit Vehicle' : 'Add Vehicle'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vehicle Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={handleChange('name')}
              className="input"
              placeholder="e.g., Ford Transit Van #1"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Seating Capacity
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={formData.seatingCapacity}
                onChange={handleChange('seatingCapacity')}
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Weight (lbs)
              </label>
              <input
                type="number"
                min="0"
                value={formData.weight}
                onChange={handleChange('weight')}
                className="input"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Odometer (miles)
            </label>
            <input
              type="number"
              min="0"
              value={formData.odometerMiles}
              onChange={handleChange('odometerMiles')}
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Maintenance Date
            </label>
            <input
              type="date"
              value={formData.lastMaintenanceDate}
              onChange={handleChange('lastMaintenanceDate')}
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assigned Driver
            </label>
            <select
              value={formData.assignedDriver}
              onChange={handleChange('assignedDriver')}
              className="input"
              required
            >
              <option value="">Select driver...</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={`${driver.firstName} ${driver.lastName}`}>
                  {driver.firstName} {driver.lastName} (@{driver.login})
                </option>
              ))}
            </select>
            {drivers.length === 0 && (
              <p className="text-xs text-yellow-600 mt-1">
                No drivers available. Please add drivers in User Management first.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Скоростной режим (mph)
            </label>
            <select
              value={formData.speedLimit}
              onChange={handleChange('speedLimit')}
              className="input"
              required
            >
              {[45, 50, 55, 60, 65].map((speed) => (
                <option key={speed} value={speed}>
                  {speed} mph
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Максимальная скорость для расчета времени маршрута
            </p>
          </div>

          {/* GPS Configuration Section */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <svg className="h-4 w-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              GPS Отслеживание
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                GPS API Ключ
              </label>
              <input
                type="text"
                value={formData.gpsApiKey}
                onChange={handleChange('gpsApiKey')}
                className="input"
                placeholder="Введите API ключ для GPS отслеживания"
              />
              <p className="text-xs text-gray-500 mt-1">
                API ключ от системы Trak-4 для отслеживания автомобиля
              </p>
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Trak-4 Device ID
              </label>
              <input
                type="number"
                value={formData.gpsDeviceId}
                onChange={handleChange('gpsDeviceId')}
                className="input"
                placeholder="Введите DeviceID (например: 123001)"
              />
              <p className="text-xs text-gray-500 mt-1">
                DeviceID из системы Trak-4 (целое число). Найдите в настройках устройства на gps.trak-4.com
              </p>
            </div>

            {formData.gpsApiKey && formData.gpsDeviceId && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <svg className="h-4 w-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-green-800">GPS отслеживание настроено</span>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => onTestGPS({ 
                      id: 'temp', 
                      name: formData.name || 'Тестовый автомобиль',
                      gpsApiKey: formData.gpsApiKey,
                      gpsDeviceId: formData.gpsDeviceId
                    } as Vehicle)}
                    disabled={testingGPS === 'temp'}
                    className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center"
                  >
                    {testingGPS === 'temp' ? (
                      <>
                        <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent mr-1"></div>
                        Тест...
                      </>
                    ) : (
                      <>
                        <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Тест GPS
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-green-600 mt-1">
                  Автомобиль будет отображаться на карте Dashboard с реальными GPS координатами
                </p>
              </div>
            )}

            {(!formData.gpsApiKey || !formData.gpsDeviceId) && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center">
                  <svg className="h-4 w-4 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <span className="text-sm text-yellow-800">GPS отслеживание не настроено</span>
                </div>
                <p className="text-xs text-yellow-600 mt-1">
                  Заполните оба поля для активации GPS отслеживания автомобиля
                </p>
              </div>
            )}
          </div>

          <div className="flex space-x-3 pt-4">
            <button type="submit" className="btn-primary flex-1">
              {vehicle ? 'Update' : 'Add'} Vehicle
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

export default FleetManagement;
