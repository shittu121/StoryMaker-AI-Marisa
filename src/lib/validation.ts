// Validation utilities for forms

export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

export interface PasswordStrength {
  score: number; // 0-4 (0 = very weak, 4 = very strong)
  feedback: string;
  suggestions: string[];
}

// Email validation
export const validateEmail = (email: string): ValidationResult => {
  if (!email) {
    return { isValid: false, message: "Email is required" };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, message: "Please enter a valid email address" };
  }

  return { isValid: true };
};

// Password strength validation
export const validatePasswordStrength = (
  password: string
): PasswordStrength => {
  const suggestions: string[] = [];
  let score = 0;

  if (password.length < 8) {
    suggestions.push("Password should be at least 8 characters long");
  } else {
    score += 1;
  }

  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    suggestions.push("Add lowercase letters");
  }

  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    suggestions.push("Add uppercase letters");
  }

  if (/[0-9]/.test(password)) {
    score += 1;
  } else {
    suggestions.push("Add numbers");
  }

  if (/[^A-Za-z0-9]/.test(password)) {
    score += 1;
  } else {
    suggestions.push("Add special characters");
  }

  let feedback = "";
  switch (score) {
    case 0:
    case 1:
      feedback = "Very weak";
      break;
    case 2:
      feedback = "Weak";
      break;
    case 3:
      feedback = "Fair";
      break;
    case 4:
      feedback = "Good";
      break;
    case 5:
      feedback = "Strong";
      break;
  }

  return { score, feedback, suggestions };
};

// Password validation
export const validatePassword = (password: string): ValidationResult => {
  if (!password) {
    return { isValid: false, message: "Password is required" };
  }

  if (password.length < 8) {
    return {
      isValid: false,
      message: "Password must be at least 8 characters long",
    };
  }

  const strength = validatePasswordStrength(password);
  if (strength.score < 3) {
    return {
      isValid: false,
      message: `Password is too weak. ${strength.suggestions[0]}`,
    };
  }

  return { isValid: true };
};

// Password confirmation validation
export const validatePasswordConfirm = (
  password: string,
  confirmPassword: string
): ValidationResult => {
  if (!confirmPassword) {
    return { isValid: false, message: "Please confirm your password" };
  }

  if (password !== confirmPassword) {
    return { isValid: false, message: "Passwords do not match" };
  }

  return { isValid: true };
};

// Form validation helper
export const validateForm = (
  fields: Record<string, ValidationResult>
): boolean => {
  return Object.values(fields).every((field) => field.isValid);
};

// Get password strength color
export const getPasswordStrengthColor = (score: number): string => {
  switch (score) {
    case 0:
    case 1:
      return "bg-red-500";
    case 2:
      return "bg-orange-500";
    case 3:
      return "bg-yellow-500";
    case 4:
      return "bg-blue-500";
    case 5:
      return "bg-green-500";
    default:
      return "bg-gray-300";
  }
};
