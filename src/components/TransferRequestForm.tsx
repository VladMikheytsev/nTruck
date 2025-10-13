import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { TransferRequest, TransferItem } from '../types';
import { Calendar, Plus, Trash2, Package, ArrowRight } from 'lucide-react';
import { format, isAfter, startOfDay, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';

const TransferRequestForm: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [currentStep, setCurrentStep] = useState<'date' | 'form'>('date');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [formData, setFormData] = useState({
    sourceWarehouse: '',
    destinationWarehouse: '',
    notes: '',
  });
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [items, setItems] = useState<Omit<TransferItem, 'id'>[]>([
    { name: '', type: '', quantity: 1 }
  ]);

  const today = startOfDay(new Date());
  const maxDate = addDays(today, 365); // Можно создавать заявки на год вперед

  // Get available routes for selected date
  const getRoutesForDate = (date: Date) => {
    if (!date || !state.currentUser) return [];
    
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    const availableRoutes: any[] = [];

    // Find all drivers scheduled for this date
    state.workSchedules.forEach(schedule => {
      if (schedule.year === year && schedule.month === month && schedule.schedule[day]) {
        const routeId = schedule.schedule[day];
        const route = state.routes.find(r => r.id === routeId);
        if (route) {
          availableRoutes.push(route);
        }
      }
    });

    return availableRoutes;
  };

  // Check if warehouse is available based on current time and arrival time
  const isWarehouseAvailable = (_arrivalTime: string, selectedDate: Date) => {
    // Склады всегда доступны - убрана блокировка по времени
    return selectedDate !== null;
  };

  // Get all warehouse options from all routes with all time variants
  const getAllWarehouseOptions = () => {
    if (!selectedDate) return [];
    
    const routes = getRoutesForDate(selectedDate);
    const warehouseOptions: any[] = [];
    
    routes.forEach(route => {
      route.stops.forEach((stop: any) => {
        const warehouse = state.warehouses.find(w => w.id === stop.warehouseId);
        if (warehouse) {
          warehouseOptions.push({
            ...warehouse,
            routeId: route.id,
            routeName: route.name,
            stopOrder: stop.order,
            arrivalTime: stop.arrivalTime,
            departureTime: stop.departureTime,
            isAvailable: isWarehouseAvailable(stop.arrivalTime, selectedDate),
            uniqueKey: `${warehouse.id}-${route.id}-${stop.order}`, // Unique identifier for each time variant
          });
        }
      });
    });
    
    // Sort by warehouse name, then by arrival time
    return warehouseOptions.sort((a, b) => {
      if (a.name !== b.name) {
        return a.name.localeCompare(b.name);
      }
      return a.arrivalTime.localeCompare(b.arrivalTime);
    });
  };

  // Get available source warehouses (only available ones)
  const getAvailableSourceWarehouses = () => {
    return getAllWarehouseOptions().filter(option => option.isAvailable);
  };

  // Get available destination warehouses (same route, higher order, all time variants)
  const getAvailableDestinationWarehouses = () => {
    if (!formData.sourceWarehouse) return [];
    
    // Find the selected source warehouse option (with route and time info)
    const selectedSourceOption = availableSourceWarehouses.find(w => 
      formData.sourceWarehouse.includes(w.uniqueKey)
    );
    
    if (!selectedSourceOption) return [];
    
    const route = state.routes.find(r => r.id === selectedSourceOption.routeId);
    if (!route) return [];
    
    const availableWarehouses: any[] = [];
    
    route.stops.forEach((stop: any) => {
      if (stop.order > selectedSourceOption.stopOrder) {
        const warehouse = state.warehouses.find(w => w.id === stop.warehouseId);
        if (warehouse) {
          availableWarehouses.push({
            ...warehouse,
            routeId: route.id,
            routeName: route.name,
            stopOrder: stop.order,
            arrivalTime: stop.arrivalTime,
            departureTime: stop.departureTime,
            uniqueKey: `${warehouse.id}-${route.id}-${stop.order}`,
          });
        }
      }
    });
    
    return availableWarehouses.sort((a, b) => a.stopOrder - b.stopOrder);
  };

  const availableSourceWarehouses = getAvailableSourceWarehouses();
  const availableDestinationWarehouses = getAvailableDestinationWarehouses();

  // Handle source warehouse selection
  const handleSourceWarehouseChange = (uniqueKey: string) => {
    setFormData(prev => ({ ...prev, sourceWarehouse: uniqueKey, destinationWarehouse: '' }));
    
    // Find which route this warehouse option belongs to
    const sourceWarehouse = availableSourceWarehouses.find(w => w.uniqueKey === uniqueKey);
    if (sourceWarehouse) {
      setSelectedRoute(sourceWarehouse.routeId);
    }
  };


  const handleDateSelect = (date: Date) => {
    if (isAfter(date, today) || date.getTime() === today.getTime()) {
      setSelectedDate(date);
      // Reset warehouse selection when date changes
      setFormData(prev => ({ ...prev, sourceWarehouse: '', destinationWarehouse: '' }));
      setSelectedRoute(null);
      setCurrentStep('form');
    }
  };

  const handleAddItem = () => {
    setItems([...items, { name: '', type: '', quantity: 1 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, field: keyof Omit<TransferItem, 'id'>, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDate || !state.currentUser) return;

    // Extract detailed information from selected options
    const sourceOption = availableSourceWarehouses.find(w => w.uniqueKey === formData.sourceWarehouse);
    const destinationOption = availableDestinationWarehouses.find(w => w.uniqueKey === formData.destinationWarehouse);
    
    // Find assigned driver for this route on selected date
    const getAssignedDriver = () => {
      if (!sourceOption || !selectedDate) return null;
      
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth() + 1;
      const day = selectedDate.getDate();
      
      const driverSchedule = state.workSchedules.find(ws => 
        ws.year === year && 
        ws.month === month && 
        ws.schedule[day] === sourceOption.routeId
      );
      
      return driverSchedule ? state.users.find(u => u.id === driverSchedule.driverId) : null;
    };
    
    // Find assigned vehicle for the driver
    const getAssignedVehicle = (driverName: string) => {
      return state.vehicles.find(v => v.assignedDriver === driverName);
    };
    
    const assignedDriver = getAssignedDriver();
    const assignedVehicle = assignedDriver ? getAssignedVehicle(`${assignedDriver.firstName} ${assignedDriver.lastName}`) : null;

    const transferRequest: TransferRequest = {
      id: Date.now().toString(),
      createdBy: state.currentUser.id,
      createdAt: new Date(),
      deadline: selectedDate,
      sourceWarehouse: sourceOption?.id || formData.sourceWarehouse,
      destinationWarehouse: destinationOption?.id || formData.destinationWarehouse,
      items: items.map((item, index) => ({
        ...item,
        id: `${Date.now()}-${index}`,
      })),
      status: 'created',
      notes: formData.notes,
      // Route information
      routeId: sourceOption?.routeId,
      sourceDepartureTime: sourceOption?.departureTime,
      destinationArrivalTime: destinationOption?.arrivalTime,
      assignedDriverId: assignedDriver?.id,
      assignedVehicle: assignedVehicle?.name,
    };

    dispatch({ type: 'ADD_TRANSFER_REQUEST', payload: transferRequest });

    // Reset form
    setCurrentStep('date');
    setSelectedDate(null);
    setFormData({ sourceWarehouse: '', destinationWarehouse: '', notes: '' });
    setSelectedRoute(null);
    setItems([{ name: '', type: '', quantity: 1 }]);

    alert('Заявка успешно создана!');
  };

  const isFormValid = () => {
    return (
      formData.sourceWarehouse &&
      formData.destinationWarehouse &&
      formData.sourceWarehouse !== formData.destinationWarehouse &&
      items.every(item => item.name.trim() && item.quantity > 0)
    );
  };

  if (currentStep === 'date') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-6">
          <div className="text-center mb-6">
            <Calendar className="h-12 w-12 text-primary-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Создание заявки на перемещение
            </h1>
            <p className="text-gray-600">
              Выберите крайний срок исполнения заявки
            </p>
          </div>

          <DatePicker
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            minDate={today}
            maxDate={maxDate}
          />

          {selectedDate && (
            <div className="mt-6 p-4 bg-green-50 rounded-lg">
              <p className="text-green-800 text-center">
                Выбрана дата: <strong>
                  {format(selectedDate, 'd MMMM yyyy', { locale: ru })}
                </strong>
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Создание заявки на перемещение</h1>
            <p className="text-gray-600 mt-1">
              Крайний срок: {selectedDate && format(selectedDate, 'd MMMM yyyy', { locale: ru })}
            </p>
          </div>
          <button
            onClick={() => setCurrentStep('date')}
            className="btn-secondary"
          >
            Изменить дату
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Warehouse Selection */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Склад отправитель
              </label>
              <select
                value={formData.sourceWarehouse}
                onChange={(e) => handleSourceWarehouseChange(e.target.value)}
                className="input"
                required
              >
                <option value="">Выберите склад из маршрута...</option>
                {availableSourceWarehouses.map((warehouse) => (
                  <option 
                    key={warehouse.uniqueKey} 
                    value={warehouse.uniqueKey}
                  >
                    {warehouse.name} - {warehouse.routeName} ({warehouse.arrivalTime}-{warehouse.departureTime})
                  </option>
                ))}
              </select>
              {selectedDate && availableSourceWarehouses.length === 0 && (
                <p className="text-xs text-yellow-600 mt-1">
                  Нет доступных складов на выбранную дату
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Склад получатель
              </label>
              <select
                value={formData.destinationWarehouse}
                onChange={(e) => setFormData({ ...formData, destinationWarehouse: e.target.value })}
                className="input"
                required
                disabled={!formData.sourceWarehouse}
              >
                <option value="">
                  {formData.sourceWarehouse 
                    ? 'Выберите склад получатель...' 
                    : 'Сначала выберите склад отправитель'}
                </option>
                {availableDestinationWarehouses.map((warehouse) => (
                  <option key={warehouse.uniqueKey} value={warehouse.uniqueKey}>
                    {warehouse.name} - Остановка #{warehouse.stopOrder} ({warehouse.arrivalTime}-{warehouse.departureTime})
                  </option>
                ))}
              </select>
              {formData.sourceWarehouse && availableDestinationWarehouses.length === 0 && (
                <p className="text-xs text-yellow-600 mt-1">
                  Нет доступных складов получателей в том же маршруте
                </p>
              )}
            </div>
          </div>

          {/* Route Preview */}
          {selectedRoute && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-center mb-3">
                <span className="text-sm font-medium text-blue-900">
                  Маршрут: {state.routes.find(r => r.id === selectedRoute)?.name}
                </span>
              </div>
              
              {formData.sourceWarehouse && formData.destinationWarehouse && (
                <div className="space-y-2">
                  <div className="flex items-center justify-center space-x-4 text-sm">
                    <div className="text-center">
                      <div className="font-medium text-blue-900">
                        {availableSourceWarehouses.find(w => w.uniqueKey === formData.sourceWarehouse)?.name}
                      </div>
                      <div className="text-xs text-blue-600">
                        {availableSourceWarehouses.find(w => w.uniqueKey === formData.sourceWarehouse)?.arrivalTime} - 
                        {availableSourceWarehouses.find(w => w.uniqueKey === formData.sourceWarehouse)?.departureTime}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-blue-600" />
                    <div className="text-center">
                      <div className="font-medium text-blue-900">
                        {availableDestinationWarehouses.find(w => w.uniqueKey === formData.destinationWarehouse)?.name}
                      </div>
                      <div className="text-xs text-blue-600">
                        {availableDestinationWarehouses.find(w => w.uniqueKey === formData.destinationWarehouse)?.arrivalTime} - 
                        {availableDestinationWarehouses.find(w => w.uniqueKey === formData.destinationWarehouse)?.departureTime}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Time Warning */}
          {selectedDate && selectedDate.toDateString() === new Date().toDateString() && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ Внимание: Заявка создается на сегодня. Доступны только склады с временем прибытия через час или позже.
              </p>
            </div>
          )}

          {/* Items */}
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
                <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border border-gray-200 rounded-lg">
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
              Примечания (опционально)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input min-h-[100px] resize-none"
              placeholder="Дополнительная информация о заявке..."
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setCurrentStep('date')}
              className="btn-secondary"
            >
              Назад
            </button>
            <button
              type="submit"
              disabled={!isFormValid()}
              className="btn-primary disabled:opacity-50"
            >
              <Package className="h-4 w-4 mr-2" />
              Создать заявку
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface DatePickerProps {
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  minDate: Date;
  maxDate: Date;
}

const DatePicker: React.FC<DatePickerProps> = ({ selectedDate, onDateSelect, minDate }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // Adjust for Monday start

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: adjustedFirstDay }, (_, i) => i);

  const isDateDisabled = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return date < startOfDay(minDate);
  };

  const isDateSelected = (day: number) => {
    if (!selectedDate) return false;
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return date.getTime() === selectedDate.getTime();
  };

  const handleDateClick = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    if (!isDateDisabled(day)) {
      onDateSelect(date);
    }
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  return (
    <div className="bg-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPreviousMonth}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
        >
          ←
        </button>
        <h2 className="text-lg font-semibold">
          {format(currentMonth, 'LLLL yyyy', { locale: ru })}
        </h2>
        <button
          onClick={goToNextMonth}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
        >
          →
        </button>
      </div>

      {/* Days of week */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
          <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {emptyDays.map((_, index) => (
          <div key={`empty-${index}`} className="p-2" />
        ))}
        {days.map((day) => (
          <button
            key={day}
            onClick={() => handleDateClick(day)}
            disabled={isDateDisabled(day)}
            className={`p-2 text-sm rounded-md transition-colors ${
              isDateDisabled(day)
                ? 'text-gray-300 cursor-not-allowed'
                : isDateSelected(day)
                ? 'bg-primary-600 text-white'
                : 'text-gray-900 hover:bg-primary-50'
            }`}
          >
            {day}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TransferRequestForm;
