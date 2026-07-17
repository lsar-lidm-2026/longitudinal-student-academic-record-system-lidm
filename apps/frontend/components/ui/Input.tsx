import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", ...props }: InputProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">{label}</label>
      )}
      <input
        className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors
          ${error ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-blue-500"}
          focus:outline-none focus:ring-2 focus:border-transparent
          disabled:bg-gray-50 disabled:text-gray-500
          ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
