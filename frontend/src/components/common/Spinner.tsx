import React from "react";

export const Spinner: React.FC<{ size?: "sm" | "md" | "lg"; className?: string }> = ({
  size = "md",
  className = "",
}) => {
  const sizeStyles = {
    sm: "w-4 h-4",
    md: "w-7 h-7",
    lg: "w-10 h-10",
  };

  return (
    <div className={`flex items-center justify-center p-4 ${className}`}>
      <div
        className={`${sizeStyles[size]} border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin`}
      />
    </div>
  );
};
