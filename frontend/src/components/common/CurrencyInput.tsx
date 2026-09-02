import React, { useState, useEffect } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  currencySuffix?: string;
  value?: number | string;
  onValueChange?: (val: number) => void;
  onChangeRaw?: (rawString: string) => void;
  onChange?: (rawString: string) => void;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      label,
      error,
      leftIcon,
      currencySuffix = "₫",
      value = "",
      onValueChange,
      onChangeRaw,
      onChange,
      className,
      placeholder = "0",
      ...props
    },
    ref
  ) => {
    const formatNumberWithCommas = (val: number | string): string => {
      if (val === "" || val === undefined || val === null) return "";
      const numStr = String(val).replace(/[^0-9.-]/g, "");
      if (!numStr || isNaN(Number(numStr))) return "";
      const parts = numStr.split(".");
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      return parts.join(".");
    };

    const [displayValue, setDisplayValue] = useState<string>(() =>
      formatNumberWithCommas(value)
    );

    useEffect(() => {
      setDisplayValue(formatNumberWithCommas(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawInput = e.target.value;
      // Remove commas and non-numeric characters except single dot and minus
      const cleaned = rawInput.replace(/[^0-9.-]/g, "");

      if (cleaned === "" || cleaned === "-") {
        setDisplayValue(cleaned);
        onValueChange?.(0);
        onChangeRaw?.(cleaned);
        onChange?.(cleaned);
        return;
      }

      const num = parseFloat(cleaned);
      if (!isNaN(num)) {
        setDisplayValue(formatNumberWithCommas(cleaned));
        onValueChange?.(num);
        onChangeRaw?.(cleaned);
        onChange?.(cleaned);
      }
    };

    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-slate-500 pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            type="text"
            inputMode="numeric"
            value={displayValue}
            onChange={handleChange}
            placeholder={placeholder}
            className={twMerge(
              clsx(
                "w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 font-mono transition-all",
                "focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500",
                leftIcon && "pl-9",
                currencySuffix && "pr-9",
                error && "border-rose-500 focus:border-rose-500 focus:ring-rose-500",
                className
              )
            )}
            {...props}
          />
          {currencySuffix && (
            <div className="absolute right-3 text-xs font-bold text-slate-500 pointer-events-none select-none">
              {currencySuffix}
            </div>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
      </div>
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";
