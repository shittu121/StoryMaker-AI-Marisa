import React from "react";
import { AlertCircle, WifiOff, Clock, AlertTriangle } from "lucide-react";
import { AuthErrorHandler } from "../../lib/errorHandler";

interface ErrorDisplayProps {
  error: string | null;
  className?: string;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  className = "",
}) => {
  if (!error) return null;

  const getErrorIcon = (errorMessage: string) => {
    if (AuthErrorHandler.isNetworkError(errorMessage)) {
      return <WifiOff className="h-4 w-4" />;
    }
    if (AuthErrorHandler.isRateLimitError(errorMessage)) {
      return <Clock className="h-4 w-4" />;
    }
    if (AuthErrorHandler.isValidationError(errorMessage)) {
      return <AlertCircle className="h-4 w-4" />;
    }
    return <AlertTriangle className="h-4 w-4" />;
  };

  const getErrorStyle = (errorMessage: string) => {
    if (AuthErrorHandler.isNetworkError(errorMessage)) {
      return "border-orange-200 bg-orange-50 text-orange-800";
    }
    if (AuthErrorHandler.isRateLimitError(errorMessage)) {
      return "border-yellow-200 bg-yellow-50 text-yellow-800";
    }
    if (AuthErrorHandler.isValidationError(errorMessage)) {
      return "border-blue-200 bg-blue-50 text-blue-800";
    }
    return "border-red-200 bg-red-50 text-red-800";
  };

  const userFriendlyMessage = AuthErrorHandler.getErrorMessage(error);

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border ${getErrorStyle(
        error
      )} ${className}`}
    >
      <div className="flex-shrink-0 mt-0.5">{getErrorIcon(error)}</div>
      <div className="flex-1">
        <p className="text-sm font-medium">{userFriendlyMessage}</p>
        {AuthErrorHandler.isNetworkError(error) && (
          <p className="text-xs mt-1 opacity-75">
            Please check your internet connection and try again.
          </p>
        )}
        {AuthErrorHandler.isRateLimitError(error) && (
          <p className="text-xs mt-1 opacity-75">
            Please wait a few minutes before trying again.
          </p>
        )}
      </div>
    </div>
  );
};

export default ErrorDisplay;
