import React, { useState, useEffect } from 'react';
import { ActualRouteTrackingService } from '../services/actualRouteTrackingService';
import { Clock, Save, RotateCcw, AlertCircle, CheckCircle } from 'lucide-react';

const Settings: React.FC = () => {
  const [trackingStartHour, setTrackingStartHour] = useState(5);
  const [trackingEndHour, setTrackingEndHour] = useState(23);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load current settings on component mount
  useEffect(() => {
    try {
      const settings = ActualRouteTrackingService.getTrackingTimeSettings();
      setTrackingStartHour(settings.startHour);
      setTrackingEndHour(settings.endHour);
    } catch (error) {
      console.error('❌ Ошибка загрузки настроек времени:', error);
    }
  }, []);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      // Validate input
      if (trackingStartHour < 0 || trackingStartHour > 23) {
        throw new Error('Время начала должно быть от 0 до 23');
      }
      
      if (trackingEndHour < 0 || trackingEndHour > 23) {
        throw new Error('Время окончания должно быть от 0 до 23');
      }
      
      if (trackingStartHour >= trackingEndHour) {
        throw new Error('Время начала должно быть меньше времени окончания');
      }

      // Save settings
      ActualRouteTrackingService.setTrackingTimeSettings(trackingStartHour, trackingEndHour);
      
      setSaveMessage({
        type: 'success',
        text: `Настройки сохранены: ${trackingStartHour}:00-${trackingEndHour}:00`
      });

      // Clear message after 3 seconds
      setTimeout(() => {
        setSaveMessage(null);
      }, 3000);

    } catch (error: any) {
      setSaveMessage({
        type: 'error',
        text: error.message || 'Ошибка сохранения настроек'
      });

      // Clear error message after 5 seconds
      setTimeout(() => {
        setSaveMessage(null);
      }, 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    setTrackingStartHour(5);
    setTrackingEndHour(23);
    setSaveMessage(null);
  };

  const currentHour = new Date().getHours();
  const isCurrentlyInWorkingHours = currentHour >= trackingStartHour && currentHour <= trackingEndHour;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Настройки</h1>
        <p className="text-gray-600 mt-1">Конфигурация системы отслеживания маршрутов</p>
      </div>

      {/* Route Tracking Settings */}
      <div className="card p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Clock className="h-6 w-6 text-primary-600" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Время отслеживания маршрутов</h2>
            <p className="text-sm text-gray-600">Настройка рабочих часов для автоматического GPS отслеживания</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Start Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Время начала отслеживания
            </label>
            <select
              value={trackingStartHour}
              onChange={(e) => setTrackingStartHour(parseInt(e.target.value))}
              className="input"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {i.toString().padStart(2, '0')}:00
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Автоматическое отслеживание начинается в это время
            </p>
          </div>

          {/* End Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Время окончания отслеживания
            </label>
            <select
              value={trackingEndHour}
              onChange={(e) => setTrackingEndHour(parseInt(e.target.value))}
              className="input"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {i.toString().padStart(2, '0')}:00
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Автоматическое отслеживание останавливается в это время
            </p>
          </div>
        </div>

        {/* Current Status */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <span className={`inline-block w-3 h-3 rounded-full ${
              isCurrentlyInWorkingHours ? 'bg-green-500' : 'bg-red-500'
            }`}></span>
            <span className="text-sm font-medium text-gray-900">
              Текущий статус: {isCurrentlyInWorkingHours ? 'Рабочее время' : 'Вне рабочего времени'}
            </span>
          </div>
          <div className="text-xs text-gray-600">
            <p>Текущее время: {new Date().toLocaleTimeString()}</p>
            <p>Настроенное рабочее время: {trackingStartHour.toString().padStart(2, '0')}:00 - {trackingEndHour.toString().padStart(2, '0')}:00</p>
            <p className="mt-2 text-gray-500">
              💡 Ручной запуск кнопкой "Начать отслеживание" работает в любое время
            </p>
          </div>
        </div>

        {/* Save Message */}
        {saveMessage && (
          <div className={`mt-4 p-4 rounded-lg flex items-center space-x-2 ${
            saveMessage.type === 'success' 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            {saveMessage.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <span className={`text-sm ${
              saveMessage.type === 'success' ? 'text-green-800' : 'text-red-800'
            }`}>
              {saveMessage.text}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-4 mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="btn-primary flex items-center"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Сохранение...' : 'Сохранить настройки'}
          </button>
          
          <button
            onClick={handleResetToDefaults}
            className="btn-secondary flex items-center"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Сбросить по умолчанию
          </button>
        </div>

        {/* Additional Information */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Информация о системе отслеживания</h3>
          <div className="space-y-2 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Интервал GPS проверки:</span>
              <span className="font-medium">30 секунд</span>
            </div>
            <div className="flex justify-between">
              <span>Радиус геофенса:</span>
              <span className="font-medium">0.1 мили</span>
            </div>
            <div className="flex justify-between">
              <span>Отслеживание только:</span>
              <span className="font-medium">Сегодняшний день</span>
            </div>
            <div className="flex justify-between">
              <span>Логирование данных:</span>
              <span className="font-medium">JSON в localStorage</span>
            </div>
          </div>
        </div>

        {/* Warning */}
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">Важно:</p>
              <ul className="space-y-1 text-xs">
                <li>• Изменение времени перезапустит активное отслеживание</li>
                <li>• Автоматическое отслеживание работает только в установленные часы</li>
                <li>• Ручной запуск кнопкой работает в любое время</li>
                <li>• Настройки применяются немедленно</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
