import React, { useState } from "react";
import { Eye, EyeOff, Mail, Lock, User, AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";

interface FormInputProps {
  type?: "text" | "email" | "password";
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  icon?: "email" | "password" | "user" | "lock";
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

const FormInput: React.FC<FormInputProps> = ({
  type = "text",
  label,
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  icon,
  required = false,
  disabled = false,
  className,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const getIcon = () => {
    switch (icon) {
      case "email":
        return <Mail className="h-5 w-5 text-gray-400" />;
      case "password":
      case "lock":
        return <Lock className="h-5 w-5 text-gray-400" />;
      case "user":
        return <User className="h-5 w-5 text-gray-400" />;
      default:
        return null;
    }
  };

  const inputType = type === "password" && showPassword ? "text" : type;

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
            {getIcon()}
          </div>
        )}

        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            onBlur?.();
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "w-full px-4 py-3 border rounded-lg transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
            "disabled:bg-gray-50 disabled:cursor-not-allowed",
            icon && "pl-10",
            type === "password" && "pr-12",
            error
              ? "border-red-300 focus:ring-red-500"
              : isFocused
              ? "border-blue-300"
              : "border-gray-300",
            "placeholder:text-gray-400"
          )}
        />

        {type === "password" && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default FormInput;
