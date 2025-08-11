import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuthContext } from "../auth/AuthProvider";
import { useToast } from "../ui/toast";
import FormInput from "../ui/form-input";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import PasswordStrengthIndicator from "../ui/password-strength";
import {
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
} from "../../lib/validation";
import { Sparkles, BookOpen, ArrowLeft } from "lucide-react";

const RegisterScreen: React.FC = () => {
  const navigate = useNavigate();
  const { register, loading, clearError } = useAuthContext();
  const { addToast } = useToast();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [validationErrors, setValidationErrors] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [touched, setTouched] = useState({
    email: false,
    password: false,
    confirmPassword: false,
  });

  // Clear auth error when component mounts
  useEffect(() => {
    clearError();
  }, [clearError]);

  // Handle field changes
  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear validation error when user starts typing
    if (validationErrors[field as keyof typeof validationErrors]) {
      setValidationErrors((prev) => ({ ...prev, [field]: "" }));
    }

    // Re-validate confirm password when password changes
    if (field === "password" && touched.confirmPassword) {
      validateField("confirmPassword", formData.confirmPassword);
    }
  };

  // Handle field blur
  const handleFieldBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field, formData[field as keyof typeof formData]);
  };

  // Validate individual field
  const validateField = (field: string, value: string) => {
    let error = "";

    switch (field) {
      case "email":
        const emailValidation = validateEmail(value);
        if (!emailValidation.isValid) {
          error = emailValidation.message || "";
        }
        break;
      case "password":
        const passwordValidation = validatePassword(value);
        if (!passwordValidation.isValid) {
          error = passwordValidation.message || "";
        }
        break;
      case "confirmPassword":
        const confirmValidation = validatePasswordConfirm(
          formData.password,
          value
        );
        if (!confirmValidation.isValid) {
          error = confirmValidation.message || "";
        }
        break;
    }

    setValidationErrors((prev) => ({ ...prev, [field]: error }));
    return !error;
  };

  // Validate entire form
  const validateForm = () => {
    const emailValid = validateField("email", formData.email);
    const passwordValid = validateField("password", formData.password);
    const confirmValid = validateField(
      "confirmPassword",
      formData.confirmPassword
    );
    return emailValid && passwordValid && confirmValid;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      addToast({
        type: "error",
        title: "Validation Error",
        message: "Please fix the errors in the form",
      });
      return;
    }

    try {
      await register(formData.email, formData.password);
      addToast({
        type: "success",
        title: "Account Created!",
        message:
          "Welcome to StoryMaker AI! Your account has been created successfully.",
      });
      navigate("/dashboard");
    } catch (error: any) {
      // Handle specific error cases
      if (
        error?.message?.includes("already exists") ||
        error?.message?.includes("duplicate")
      ) {
        addToast({
          type: "error",
          title: "Account Already Exists",
          message:
            "An account with this email already exists. Please try logging in instead.",
        });
      } else if (error?.message?.includes("Network")) {
        addToast({
          type: "error",
          title: "Connection Error",
          message:
            "Unable to connect to server. Please check your internet connection.",
        });
      } else if (error?.message?.includes("weak")) {
        addToast({
          type: "error",
          title: "Weak Password",
          message: "Please choose a stronger password for your account.",
        });
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md">
        {/* Back to Login */}
        <motion.div
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mb-6"
        >
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </Link>
        </motion.div>

        {/* Logo/Brand */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-center mb-8"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              delay: 0.4,
              duration: 0.5,
              type: "spring",
              stiffness: 200,
            }}
            className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mb-4"
          >
            <BookOpen className="w-8 h-8 text-white" />
          </motion.div>
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="text-3xl font-bold text-gray-900 mb-2"
          >
            StoryMaker AI
          </motion.h1>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="text-gray-600 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Create amazing stories with AI
          </motion.p>
        </motion.div>

        {/* Register Card */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl font-bold text-gray-900">
                Create Account
              </CardTitle>
              <CardDescription className="text-gray-600">
                Join StoryMaker AI and start creating amazing stories
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email Field */}
                <FormInput
                  type="email"
                  label="Email Address"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(value) => handleFieldChange("email", value)}
                  onBlur={() => handleFieldBlur("email")}
                  error={touched.email ? validationErrors.email : ""}
                  icon="email"
                  required
                />

                {/* Password Field */}
                <FormInput
                  type="password"
                  label="Password"
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChange={(value) => handleFieldChange("password", value)}
                  onBlur={() => handleFieldBlur("password")}
                  error={touched.password ? validationErrors.password : ""}
                  icon="password"
                  required
                />

                {/* Password Strength Indicator */}
                {formData.password && (
                  <PasswordStrengthIndicator
                    password={formData.password}
                    className="mt-2"
                  />
                )}

                {/* Confirm Password Field */}
                <FormInput
                  type="password"
                  label="Confirm Password"
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={(value) =>
                    handleFieldChange("confirmPassword", value)
                  }
                  onBlur={() => handleFieldBlur("confirmPassword")}
                  error={
                    touched.confirmPassword
                      ? validationErrors.confirmPassword
                      : ""
                  }
                  icon="password"
                  required
                />

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-[1.02] focus:scale-[0.98]"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating account...
                    </div>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </form>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">
                    Already have an account?
                  </span>
                </div>
              </div>

              {/* Login Link */}
              <div className="text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center w-full px-4 py-3 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-all duration-200"
                >
                  Sign In to Existing Account
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.5 }}
          className="text-center mt-8 text-sm text-gray-500"
        >
          <p>© 2024 StoryMaker AI. All rights reserved.</p>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default RegisterScreen;
