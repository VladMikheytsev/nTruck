import React from 'react';

interface WarehouseIconProps {
  name: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
}

const WarehouseIcon: React.FC<WarehouseIconProps> = ({ 
  name, 
  color, 
  size = 'md', 
  onClick,
  className = '' 
}) => {
  // Get first 3 letters of warehouse name
  const getAbbreviation = (warehouseName: string) => {
    return warehouseName
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .substring(0, 3)
      .toUpperCase();
  };

  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center text-white font-bold shadow-md ${
        onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''
      } ${className}`}
      style={{ backgroundColor: color }}
      onClick={onClick}
      title={`${name} - Click to change color`}
    >
      {getAbbreviation(name)}
    </div>
  );
};

export default WarehouseIcon;
