import React, { useEffect, useRef, useState } from 'react';
import { MapPin, AlertCircle, CheckCircle } from 'lucide-react';
import { useGoogleMaps } from '../hooks/useGoogleMaps';

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChange,
  placeholder = 'Start typing address...',
  className = 'input',
  required = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteElementRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);
  const [selectedFromAutocomplete, setSelectedFromAutocomplete] = useState<boolean>(false);
  const [currentValue, setCurrentValue] = useState<string>(value);
  const { isLoaded, isLoading, error } = useGoogleMaps();

  // Initialize address input (simple and reliable approach)
  useEffect(() => {
    console.log('🔄 AddressAutocomplete useEffect triggered:', {
      isLoaded,
      hasContainer: !!containerRef.current,
      value,
      googleAvailable: typeof google !== 'undefined'
    });

    if (!containerRef.current) {
      console.log('❌ No container available');
      return;
    }

    // Clear container
    containerRef.current.innerHTML = '';
    console.log('🧹 Container cleared');

    // Always create a simple, working input
    const inputElement = document.createElement('input');
    inputElement.type = 'text';
    inputElement.placeholder = placeholder;
    inputElement.value = value || '';
    inputElement.required = required;
    inputElement.className = 'w-full h-10 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900';
    
    // Ensure input is always visible and functional
    inputElement.style.cssText = `
      background-color: white !important;
      color: #374151 !important;
      border: 1px solid #d1d5db !important;
      border-radius: 6px !important;
      padding: 8px 12px !important;
      font-size: 14px !important;
      width: 100% !important;
      height: 40px !important;
      box-sizing: border-box !important;
      font-family: inherit !important;
      outline: none !important;
      display: block !important;
    `;
    
    // Handle input changes
    inputElement.addEventListener('input', (event: any) => {
      const inputValue = event.target.value;
      setSelectedFromAutocomplete(false);
      setCurrentValue(inputValue);
      onChange(inputValue);
    });

    // Add focus/blur effects
    inputElement.addEventListener('focus', () => {
      inputElement.style.borderColor = '#3b82f6';
      inputElement.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
    });
    
    inputElement.addEventListener('blur', () => {
      inputElement.style.borderColor = '#d1d5db';
      inputElement.style.boxShadow = 'none';
    });

    containerRef.current.appendChild(inputElement);
    console.log('✅ Basic input created and added to DOM');

    // Try to add Google Places enhancement ONLY if API is fully loaded
    if (isLoaded && typeof google !== 'undefined' && google?.maps?.places?.Autocomplete) {
      console.log('🌍 Enhancing with Google Places Autocomplete...');
      
      try {
        const autocomplete = new google.maps.places.Autocomplete(inputElement, {
          componentRestrictions: { country: 'us' },
          fields: ['formatted_address', 'geometry', 'name'],
          types: ['address'],
        });

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          console.log('🏠 Place selected:', place);
          
          if (place?.formatted_address) {
            console.log('✅ Address selected from Google Places:', place.formatted_address);
            setSelectedFromAutocomplete(true);
            setCurrentValue(place.formatted_address);
            onChange(place.formatted_address);
            inputElement.value = place.formatted_address;
          }
        });
        
        console.log('✅ Google Places Autocomplete added successfully');
      } catch (err) {
        console.error('❌ Error adding Google Places:', err);
        console.log('📝 Input will work as plain text field');
      }
    } else {
      console.log('🌐 Google Places not available, using plain input');
    }

    // Cleanup on unmount
    return () => {
      if (containerRef.current) {
        // Clear all children from container
        containerRef.current.innerHTML = '';
      }
      autocompleteElementRef.current = null;
    };
  }, [isLoaded, placeholder, onChange]);

  // Update value when prop changes
  useEffect(() => {
    if (value !== currentValue) {
      setCurrentValue(value);
      
      // Update input if it exists
      const inputElement = containerRef.current?.querySelector('input');
      if (inputElement) {
        inputElement.value = value;
      }
    }
  }, [value, currentValue]);

  // Fallback input for when Google Maps API is not available
  const handleFallbackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentValue(e.target.value);
    onChange(e.target.value);
  };

  if (error) {
    return (
      <div className="space-y-2">
        <input
          type="text"
          value={currentValue}
          onChange={handleFallbackChange}
          placeholder={placeholder}
          className={className}
          required={required}
        />
        <div className="flex items-start">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
          <p className="text-xs text-red-600">
            Google Maps API unavailable. Please enter address manually.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="relative">
          <input
            type="text"
            value={currentValue}
            placeholder="Loading Google Maps..."
            className={`${className} pr-10 bg-gray-100`}
            disabled
            required={required}
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
          </div>
        </div>
        <div className="flex items-start">
          <MapPin className="h-4 w-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
          <p className="text-xs text-blue-600">Loading Google Places...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        {/* Container for address input */}
        <div ref={containerRef} className="relative">
          {/* Input will be created dynamically */}
        </div>
        <MapPin className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      </div>

      {/* Status messages */}
      <div className="flex items-start">
        {selectedFromAutocomplete ? (
          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
        ) : isLoaded ? (
          <MapPin className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
        ) : (
          <MapPin className="h-4 w-4 text-gray-500 mt-0.5 mr-2 flex-shrink-0" />
        )}
        <p className="text-xs text-gray-600">
          {selectedFromAutocomplete 
            ? 'Address selected from Google Places. Full address saved.'
            : isLoaded 
              ? autocompleteElementRef.current
                ? 'Google Places (New API) autocomplete active. Start typing for US address suggestions.'
                : 'Google Places (Legacy API) autocomplete active. Start typing for US address suggestions.'
              : isLoading
                ? 'Loading Google Places...'
                : error
                  ? 'Google Places unavailable. Manual input enabled.'
                  : 'Address input ready'
          }
        </p>
      </div>
    </div>
  );
};

export default AddressAutocomplete;