// Error handling utilities for authentication

export interface ValidationError {
  field: string;
  message: string;
}

export interface BackendError {
  success: false;
  error: string;
  status?: number;
}

export interface ErrorState {
  general: string | null;
  fieldErrors: Record<string, string>;
  isLoading: boolean;
}

export class AuthErrorHandler {
  // Parse backend error response
  static parseBackendError(error: any): string {
    if (typeof error === "string") {
      return error;
    }

    if (error?.response?.data?.error) {
      return error.response.data.error;
    }

    if (error?.message) {
      return error.message;
    }

    return "An unexpected error occurred";
  }

  // Validate email format
  static validateEmail(email: string): string | null {
    if (!email) {
      return "Email is required";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return "Please enter a valid email address";
    }

    return null;
  }

  // Validate password strength
  static validatePassword(password: string): string | null {
    if (!password) {
      return "Password is required";
    }

    if (password.length < 6) {
      return "Password must be at least 6 characters long";
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return "Password must contain at least one uppercase letter, one lowercase letter, and one number";
    }

    return null;
  }

  // Validate password confirmation
  static validatePasswordConfirmation(
    password: string,
    confirmPassword: string
  ): string | null {
    if (!confirmPassword) {
      return "Please confirm your password";
    }

    if (password !== confirmPassword) {
      return "Passwords do not match";
    }

    return null;
  }

  // Get user-friendly error message
  static getErrorMessage(error: string): string {
    const errorMessages: Record<string, string> = {
      "User with this email already exists":
        "An account with this email already exists. Please try logging in instead.",
      "Invalid email or password":
        "Invalid email or password. Please check your credentials and try again.",
      "Account is deactivated":
        "Your account has been deactivated. Please contact support.",
      "Too many requests from this IP, please try again later.":
        "Too many login attempts. Please wait a few minutes before trying again.",
      "Network error":
        "Unable to connect to the server. Please check your internet connection.",
      "Valid email is required": "Please enter a valid email address.",
      "Password must be at least 6 characters":
        "Password must be at least 6 characters long.",
      "Password must contain at least one uppercase letter, one lowercase letter, and one number":
        "Password must contain at least one uppercase letter, one lowercase letter, and one number.",
    };

    return errorMessages[error] || error;
  }

  // Check if error is a network error
  static isNetworkError(error: string): boolean {
    return (
      error.includes("Network error") ||
      error.includes("fetch") ||
      error.includes("Failed to fetch") ||
      error.includes("ECONNREFUSED")
    );
  }

  // Check if error is a validation error
  static isValidationError(error: string): boolean {
    return (
      error.includes("Valid email") ||
      error.includes("Password must") ||
      error.includes("required")
    );
  }

  // Check if error is a rate limit error
  static isRateLimitError(error: string): boolean {
    return error.includes("Too many requests") || error.includes("rate limit");
  }
}
