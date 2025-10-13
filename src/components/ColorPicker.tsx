import React from 'react';
import { Check } from 'lucide-react';

interface ColorPickerProps {
  selectedColor: string;
  onColorSelect: (color: string) => void;
  onClose: () => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ selectedColor, onColorSelect, onClose }) => {
  const colors = [
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#10b981' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Yellow', value: '#f59e0b' },
    { name: 'Purple', value: '#8b5cf6' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Teal', value: '#14b8a6' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Gray', value: '#6b7280' },
    { name: 'Emerald', value: '#059669' },
    { name: 'Rose', value: '#f43f5e' },
  ];

  const handleColorSelect = (color: string) => {
    onColorSelect(color);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-sm w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Choose Icon Color
        </h3>
        
        <div className="grid grid-cols-4 gap-3 mb-6">
          {colors.map((color) => (
            <button
              key={color.value}
              onClick={() => handleColorSelect(color.value)}
              className="relative w-12 h-12 rounded-full border-2 border-gray-200 hover:border-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
              style={{ backgroundColor: color.value }}
              title={color.name}
            >
              {selectedColor === color.value && (
                <Check className="h-5 w-5 text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              )}
            </button>
          ))}
        </div>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ColorPicker;
