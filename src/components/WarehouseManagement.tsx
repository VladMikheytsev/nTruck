import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Warehouse, TrafficScenario } from '../types';
import { Plus, Edit, Trash2, Building2, Phone, User, Clock, FileText, Navigation, MapPin, Search } from 'lucide-react';
import AddressAutocomplete from './AddressAutocomplete';
import WarehouseIcon from './WarehouseIcon';
import ColorPicker from './ColorPicker';
import { GeocodingService, GeocodeResult } from '../services/geocodingService';
import { Database } from '../utils/database';

const WarehouseManagement: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [showForm, setShowForm] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [geocodingWarehouse, setGeocodingWarehouse] = useState<string | null>(null);

  // Loading state check
  if (!state.warehouses) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Загрузка складов...</p>
        </div>
      </div>
    );
  }

  const handleAddWarehouse = () => {
    setEditingWarehouse(null);
    setShowForm(true);
  };

  const handleEditWarehouse = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse);
    setShowForm(true);
  };

  const handleDeleteWarehouse = (warehouseId: string) => {
    if (window.confirm('Вы уверены, что хотите удалить этот склад?')) {
      dispatch({ type: 'DELETE_WAREHOUSE', payload: warehouseId });
      // Немедленно сохраняем изменения на сервер, не дожидаясь эффекта
      const nextWarehouses = state.warehouses.filter(w => w.id !== warehouseId);
      const dataToSave = {
        users: state.users,
        warehouses: nextWarehouses,
        transferRequests: state.transferRequests,
        vehicles: state.vehicles,
        shifts: state.shifts,
        workSchedules: state.workSchedules,
        routes: state.routes,
      };
      void Database.save(dataToSave as any);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingWarehouse(null);
  };

  // Быстрое геокодирование для склада
  const handleQuickGeocode = async (warehouse: Warehouse) => {
    if (!warehouse.fullAddress.trim()) {
      alert('❌ У склада не указан адрес для геокодирования');
      return;
    }

    setGeocodingWarehouse(warehouse.id);

    try {
      console.log('🗺️ Quick geocoding for warehouse:', warehouse.name, warehouse.fullAddress);
      const result = await GeocodingService.getCoordinatesByAddress(warehouse.fullAddress);

      if ('error' in result) {
        alert(`❌ Ошибка геокодирования:\n${result.error}`);
        console.error('❌ Quick geocoding error:', result);
      } else {
        // Обновляем склад с новыми координатами
        const updatedWarehouse: Warehouse = {
          ...warehouse,
          coordinates: {
            lat: result.latitude,
            lng: result.longitude
          }
        };

        dispatch({ type: 'UPDATE_WAREHOUSE', payload: updatedWarehouse });
        
        alert(`✅ Координаты получены!\n\nАдрес: ${result.formattedAddress}\nКоординаты: ${result.latitude.toFixed(6)}, ${result.longitude.toFixed(6)}`);
        console.log('✅ Quick geocoding successful:', result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      alert(`❌ Ошибка геокодирования: ${errorMessage}`);
      console.error('❌ Quick geocoding exception:', error);
    } finally {
      setGeocodingWarehouse(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Управление складами</h1>
        <button
          onClick={handleAddWarehouse}
          className="btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Добавить склад
        </button>
      </div>

      {/* Warehouses Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {state.warehouses.map((warehouse) => (
          <div key={warehouse.id} className="card p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-3">
                <WarehouseIcon 
                  name={warehouse.name}
                  color={warehouse.iconColor}
                  size="lg"
                />
                <h3 className="text-lg font-semibold text-gray-900">{warehouse.name}</h3>
              </div>
              <div className="flex space-x-2">
                {/* Кнопка быстрого геокодирования */}
                {warehouse.fullAddress && !warehouse.coordinates && (
                  <button
                    onClick={() => handleQuickGeocode(warehouse)}
                    disabled={geocodingWarehouse === warehouse.id}
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                    title="Получить GPS координаты по адресу"
                  >
                    {geocodingWarehouse === warehouse.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </button>
                )}
                
                <button
                  onClick={() => handleEditWarehouse(warehouse)}
                  className="p-1 text-gray-400 hover:text-primary-600 transition-colors"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteWarehouse(warehouse.id)}
                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start">
                <Building2 className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <div>{warehouse.fullAddress}</div>
                  {warehouse.unit && (
                    <div className="text-xs text-primary-600 font-medium mt-1">
                      UNIT: {warehouse.unit}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center">
                <Phone className="h-4 w-4 mr-2 flex-shrink-0" />
                <span>{warehouse.phoneNumber}</span>
              </div>
              <div className="flex items-center">
                <User className="h-4 w-4 mr-2 flex-shrink-0" />
                <span>{warehouse.assignedEmployee}</span>
              </div>
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                <span>{warehouse.workingHours}</span>
              </div>
              <div className="flex items-center">
                <Navigation className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="text-sm">
                  Расчет времени: 
                  <span className={`ml-1 px-2 py-1 rounded-full text-xs font-medium ${
                    warehouse.trafficScenario === 'pessimistic' 
                      ? 'bg-red-100 text-red-800'
                      : warehouse.trafficScenario === 'optimistic'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {warehouse.trafficScenario === 'pessimistic' 
                      ? 'Пессимистический'
                      : warehouse.trafficScenario === 'optimistic'
                      ? 'Оптимистический'
                      : 'Лучший прогноз'
                    }
                  </span>
                </span>
              </div>
              
              {/* GPS Coordinates Display */}
              {warehouse.coordinates && (
                <div className="flex items-center">
                  <Navigation className="h-4 w-4 mr-2 flex-shrink-0 text-green-500" />
                  <span className="text-xs">
                    📍 GPS: {warehouse.coordinates.lat.toFixed(6)}, {warehouse.coordinates.lng.toFixed(6)}
                  </span>
                </div>
              )}
              
              {!warehouse.coordinates && (
                <div className="flex items-center">
                  <Navigation className="h-4 w-4 mr-2 flex-shrink-0 text-yellow-500" />
                  <span className="text-xs text-yellow-600">
                    ⚠️ GPS координаты не заданы
                  </span>
                </div>
              )}
              
              {warehouse.instructions && (
                <div className="flex items-start">
                  <FileText className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0 text-blue-500" />
                  <div>
                    <div className="font-medium text-blue-600 text-xs mb-1">Instructions:</div>
                    <div className="text-xs text-gray-700 bg-blue-50 p-2 rounded border-l-2 border-blue-200">
                      {warehouse.instructions}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <span className="text-xs text-gray-500">
                Created: {new Date(warehouse.createdAt).toLocaleDateString('en-US')}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {state.warehouses.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Нет складов</h3>
          <p className="text-gray-500 mb-4">Начните с создания первого склада</p>
          <button onClick={handleAddWarehouse} className="btn-primary">
            <Plus className="h-4 w-4 mr-2" />
            Добавить склад
          </button>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <WarehouseForm
          warehouse={editingWarehouse}
          onClose={handleFormClose}
          onSave={(warehouse) => {
            if (editingWarehouse) {
              dispatch({ type: 'UPDATE_WAREHOUSE', payload: warehouse });
            } else {
              dispatch({ type: 'ADD_WAREHOUSE', payload: warehouse });
            }
            handleFormClose();
          }}
        />
      )}
    </div>
  );
};

interface WarehouseFormProps {
  warehouse: Warehouse | null;
  onClose: () => void;
  onSave: (warehouse: Warehouse) => void;
}

const WarehouseForm: React.FC<WarehouseFormProps> = ({ warehouse, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: warehouse?.name || '',
    fullAddress: warehouse?.fullAddress || '',
    unit: warehouse?.unit || '',
    phoneNumber: warehouse?.phoneNumber || '',
    assignedEmployee: warehouse?.assignedEmployee || '',
    workingHours: warehouse?.workingHours || '',
    instructions: warehouse?.instructions || '',
    iconColor: warehouse?.iconColor || '#3b82f6',
    trafficScenario: warehouse?.trafficScenario || 'best_guess' as TrafficScenario,
    coordinates: warehouse?.coordinates || { lat: 34.0522, lng: -118.2437 }, // Default LA coordinates
  });

  // Состояние для геокодирования
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeResult, setGeocodeResult] = useState<GeocodeResult | null>(null);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Функция геокодирования адреса
  const handleGeocodeAddress = async () => {
    if (!formData.fullAddress.trim()) {
      setGeocodeError('Введите адрес для получения координат');
      return;
    }

    setIsGeocoding(true);
    setGeocodeError(null);
    setGeocodeResult(null);

    try {
      console.log('🗺️ Geocoding address:', formData.fullAddress);
      const result = await GeocodingService.getCoordinatesByAddress(formData.fullAddress);

      if ('error' in result) {
        setGeocodeError(result.error);
        console.error('❌ Geocoding error:', result);
      } else {
        setGeocodeResult(result);
        // Автоматически обновляем координаты в форме
        setFormData(prev => ({
          ...prev,
          coordinates: {
            lat: result.latitude,
            lng: result.longitude
          }
        }));
        console.log('✅ Geocoding successful:', result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      setGeocodeError(errorMessage);
      console.error('❌ Geocoding exception:', error);
    } finally {
      setIsGeocoding(false);
    }
  };

  // Функция обратного геокодирования (координаты -> адрес)
  const handleReverseGeocode = async () => {
    if (!formData.coordinates.lat || !formData.coordinates.lng) {
      setGeocodeError('Введите координаты для получения адреса');
      return;
    }

    setIsGeocoding(true);
    setGeocodeError(null);
    setGeocodeResult(null);

    try {
      console.log('🗺️ Reverse geocoding coordinates:', formData.coordinates);
      const result = await GeocodingService.getAddressByCoordinates(
        formData.coordinates.lat,
        formData.coordinates.lng
      );

      if ('error' in result) {
        setGeocodeError(result.error);
        console.error('❌ Reverse geocoding error:', result);
      } else {
        setGeocodeResult(result);
        // Предлагаем обновить адрес
        if (window.confirm(`Найден адрес: ${result.formattedAddress}\n\nОбновить адрес склада?`)) {
          setFormData(prev => ({
            ...prev,
            fullAddress: result.formattedAddress
          }));
        }
        console.log('✅ Reverse geocoding successful:', result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      setGeocodeError(errorMessage);
      console.error('❌ Reverse geocoding exception:', error);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newWarehouse: Warehouse = {
      id: warehouse?.id || Date.now().toString(),
      ...formData,
      createdAt: warehouse?.createdAt || new Date(),
    };

    onSave(newWarehouse);
  };

  const handleChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {warehouse ? 'Edit Warehouse' : 'Add Warehouse'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Warehouse Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={handleChange('name')}
                className="input"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Icon
              </label>
              <div className="flex items-center justify-center">
                <WarehouseIcon
                  name={formData.name || 'WAR'}
                  color={formData.iconColor}
                  size="lg"
                  onClick={() => setShowColorPicker(true)}
                />
              </div>
              <p className="text-xs text-gray-500 text-center mt-1">
                Click to change color
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Address
              </label>
              <AddressAutocomplete
                value={formData.fullAddress}
                onChange={(address) => setFormData(prev => ({ ...prev, fullAddress: address }))}
                placeholder="Start typing US address..."
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                UNIT
              </label>
              <input
                type="text"
                value={formData.unit}
                onChange={handleChange('unit')}
                className="input"
                placeholder="Suite 100A, Apt 5B, etc."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              value={formData.phoneNumber}
              onChange={handleChange('phoneNumber')}
              className="input"
              placeholder="+1 (555) 123-4567"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assigned Employee
            </label>
            <input
              type="text"
              value={formData.assignedEmployee}
              onChange={handleChange('assignedEmployee')}
              className="input"
              placeholder="Employee name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Working Hours
            </label>
            <input
              type="text"
              value={formData.workingHours}
              onChange={handleChange('workingHours')}
              placeholder="e.g., 9:00 AM - 6:00 PM"
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instructions
            </label>
            <textarea
              value={formData.instructions}
              onChange={handleChange('instructions')}
              className="input min-h-[120px] resize-none"
              placeholder="Special instructions for this warehouse (loading procedures, security codes, contact information, etc.)"
            />
            <p className="text-xs text-gray-500 mt-1">
              Optional instructions for drivers and staff visiting this warehouse
            </p>
          </div>

          {/* GPS Coordinates Section */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <Navigation className="h-4 w-4 mr-2 text-blue-600" />
              GPS Координаты
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Широта (Latitude)
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.coordinates.lat}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    coordinates: { ...prev.coordinates, lat: parseFloat(e.target.value) || 0 }
                  }))}
                  className="input"
                  placeholder="34.0522"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Долгота (Longitude)
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.coordinates.lng}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    coordinates: { ...prev.coordinates, lng: parseFloat(e.target.value) || 0 }
                  }))}
                  className="input"
                  placeholder="-118.2437"
                  required
                />
              </div>
            </div>
            
            {/* Кнопки геокодирования */}
            <div className="mt-3 flex space-x-2">
              <button
                type="button"
                onClick={handleGeocodeAddress}
                disabled={isGeocoding || !formData.fullAddress.trim()}
                className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isGeocoding ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    Получение...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Получить координаты
                  </>
                )}
              </button>
              
              <button
                type="button"
                onClick={handleReverseGeocode}
                disabled={isGeocoding || !formData.coordinates.lat || !formData.coordinates.lng}
                className="px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <MapPin className="h-4 w-4 mr-2" />
                Получить адрес
              </button>
            </div>

            {/* Результат геокодирования */}
            {geocodeResult && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center mb-2">
                  <MapPin className="h-4 w-4 text-green-600 mr-2" />
                  <span className="text-sm font-medium text-green-800">Координаты найдены!</span>
                </div>
                <div className="text-sm text-green-700">
                  <div><strong>Адрес:</strong> {geocodeResult.formattedAddress}</div>
                  <div><strong>Координаты:</strong> {geocodeResult.latitude.toFixed(6)}, {geocodeResult.longitude.toFixed(6)}</div>
                  {geocodeResult.addressComponents.locality && (
                    <div><strong>Город:</strong> {geocodeResult.addressComponents.locality}</div>
                  )}
                </div>
              </div>
            )}

            {/* Ошибка геокодирования */}
            {geocodeError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center mb-1">
                  <Navigation className="h-4 w-4 text-red-600 mr-2" />
                  <span className="text-sm font-medium text-red-800">Ошибка геокодирования</span>
                </div>
                <div className="text-sm text-red-700">{geocodeError}</div>
              </div>
            )}
            
            <p className="text-xs text-gray-500 mt-2">
              📍 GPS координаты используются для отслеживания прибытия/отъезда водителей и расчета расстояний
            </p>
            
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-xs text-blue-800">
                💡 <strong>Автоматическое получение координат:</strong>
              </div>
              <div className="text-xs text-blue-600 mt-1">
                1. Введите полный адрес склада выше<br/>
                2. Нажмите "Получить координаты" - система автоматически найдет GPS координаты<br/>
                3. Или введите координаты вручную и нажмите "Получить адрес" для проверки
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Navigation className="inline h-4 w-4 mr-1" />
              Сценарий расчета времени прибытия
            </label>
            <select
              value={formData.trafficScenario}
              onChange={(e) => setFormData(prev => ({ ...prev, trafficScenario: e.target.value as TrafficScenario }))}
              className="input"
              required
            >
              <option value="optimistic">Оптимистический (быстрее)</option>
              <option value="best_guess">Лучший прогноз (рекомендуется)</option>
              <option value="pessimistic">Пессимистический (с запасом времени)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Влияет на расчет времени прибытия в маршрутах с учетом пробок
            </p>
          </div>

          <div className="flex space-x-3 pt-4">
            <button type="submit" className="btn-primary flex-1">
              {warehouse ? 'Update' : 'Create'} Warehouse
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

        {/* Color Picker Modal */}
        {showColorPicker && (
          <ColorPicker
            selectedColor={formData.iconColor}
            onColorSelect={(color) => setFormData(prev => ({ ...prev, iconColor: color }))}
            onClose={() => setShowColorPicker(false)}
          />
        )}
      </div>
    </div>
  );
};

export default WarehouseManagement;
