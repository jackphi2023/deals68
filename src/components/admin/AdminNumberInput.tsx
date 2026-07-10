import { useEffect, useState, type InputHTMLAttributes } from 'react';
import {
  formatInitialNumber,
  formatNumberTyping,
} from '../../lib/numberFormat';

type AdminNumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'defaultValue' | 'onChange' | 'type'
> & {
  value: unknown;
  allowDecimal?: boolean;
};

export function AdminNumberInput({
  value,
  allowDecimal = false,
  className = '',
  ...props
}: AdminNumberInputProps) {
  const [formatted, setFormatted] = useState(() =>
    formatInitialNumber(value, allowDecimal),
  );

  useEffect(() => {
    setFormatted(formatInitialNumber(value, allowDecimal));
  }, [value, allowDecimal]);

  return (
    <input
      {...props}
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      value={formatted}
      onChange={(event) =>
        setFormatted(
          formatNumberTyping(event.currentTarget.value, allowDecimal),
        )
      }
      className={`d68-admin-input ${className}`.trim()}
      data-admin-number="formatted"
      autoComplete="off"
    />
  );
}
