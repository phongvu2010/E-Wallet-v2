import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectGroup {
  label: string;
  options: SelectOption[];
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: SelectOption[];
  groups?: SelectGroup[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, groups, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={twMerge(
              clsx(
                "w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2 text-sm text-slate-100 placeholder-slate-500 transition-all appearance-none",
                "focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500",
                error && "border-rose-500 focus:border-rose-500 focus:ring-rose-500",
                className
              )
            )}
            {...props}
          >
            {options &&
              options.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled}
                  className="bg-slate-900 text-slate-100"
                >
                  {opt.label}
                </option>
              ))}

            {groups &&
              groups.map((group) => (
                <optgroup
                  key={group.label}
                  label={group.label}
                  className="bg-slate-950 font-bold text-emerald-400"
                >
                  {group.options.map((opt) => (
                    <option
                      key={opt.value}
                      value={opt.value}
                      disabled={opt.disabled}
                      className="bg-slate-900 font-normal text-slate-100"
                    >
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
              ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-slate-400">
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
        {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
      </div>
    );
  }
);


Select.displayName = "Select";
