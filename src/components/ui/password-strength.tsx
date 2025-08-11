import React from "react";
import {
  validatePasswordStrength,
  getPasswordStrengthColor,
  type PasswordStrength,
} from "../../lib/validation";

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  className = "",
}) => {
  if (!password) return null;

  const strength: PasswordStrength = validatePasswordStrength(password);
  const colorClass = getPasswordStrengthColor(strength.score);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">Password strength:</span>
        <span
          className={`text-sm font-medium ${
            strength.score <= 1
              ? "text-red-600"
              : strength.score === 2
              ? "text-orange-600"
              : strength.score === 3
              ? "text-yellow-600"
              : strength.score === 4
              ? "text-blue-600"
              : "text-green-600"
          }`}
        >
          {strength.feedback}
        </span>
      </div>

      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className={`h-2 flex-1 rounded-full transition-all duration-300 ${
              level <= strength.score ? colorClass : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      {strength.suggestions.length > 0 && (
        <div className="text-xs text-gray-500 space-y-1">
          <p className="font-medium">Suggestions:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {strength.suggestions.slice(0, 3).map((suggestion, index) => (
              <li key={index}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PasswordStrengthIndicator;
