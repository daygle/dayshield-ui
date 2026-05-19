import type { ChangeEvent } from 'react';

interface AddressPrefixFieldProps {
  id: string;
  label: string;
  addressValue: string;
  prefixValue: string;
  onAddressChange: (value: string) => void;
  onPrefixChange: (value: string) => void;
  prefixOptions: Array<number | string>;
  addressPlaceholder?: string;
  prefixLabel?: string;
  required?: boolean;
  className?: string;
  hint?: string;
  disabled?: boolean;
  addressDisabled?: boolean;
  prefixDisabled?: boolean;
}

export default function AddressPrefixField({
  id,
  label,
  addressValue,
  prefixValue,
  onAddressChange,
  onPrefixChange,
  prefixOptions,
  addressPlaceholder,
  prefixLabel = 'Prefix',
  required = false,
  className = '',
  hint,
  disabled = false,
  addressDisabled = false,
  prefixDisabled = false,
}: AddressPrefixFieldProps) {
  const baseInputClass =
    'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm ' +
    'placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ' +
    'disabled:bg-gray-100 disabled:text-gray-500';

  const handleAddressChange = (event: ChangeEvent<HTMLInputElement>) => {
    onAddressChange(event.target.value);
  };

  const handlePrefixChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onPrefixChange(event.target.value);
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={`${id}-address`} className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
        <input
          id={`${id}-address`}
          className={baseInputClass}
          value={addressValue}
          placeholder={addressPlaceholder}
          onChange={handleAddressChange}
          disabled={disabled || addressDisabled}
        />
        <select
          id={`${id}-prefix`}
          aria-label={prefixLabel}
          className={baseInputClass}
          value={prefixValue}
          onChange={handlePrefixChange}
          disabled={disabled || prefixDisabled}
        >
          {prefixOptions.map((prefix) => (
            <option key={String(prefix)} value={String(prefix)}>{`/${prefix}`}</option>
          ))}
        </select>
      </div>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
