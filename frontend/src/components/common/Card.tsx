import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  hover = false,
  className,
  ...props
}) => {
  return (
    <div
      className={twMerge(
        clsx(
          "bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm shadow-xl",
          hover && "transition-all duration-300 hover:border-slate-700/80 hover:bg-slate-900/90 hover:shadow-2xl",
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
};
