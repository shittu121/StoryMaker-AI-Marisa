import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { apiService, User } from "../../lib/api";
import { StoredAuth } from "../../lib/secureStorage";
import { AuthErrorHandler } from "../../lib/errorHandler";
import { logElectronStatus, testElectronAPI } from "../../lib/electronUtils";
import { storageManager } from "../../lib/storageManager";
import { useToast } from "../ui/toast";

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  // Initialize authentication state on app startup
  useEffect(() => {
    // Debug Electron API availability
    logElectronStatus();
    testElectronAPI();

    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setLoading(true);

      // Check if user is already authenticated
      const isAuth = await storageManager.isAuthenticated();
      if (!isAuth) {
        setLoading(false);
        return;
      }

      // Get stored user data
      const storedUser = await storageManager.getUser();
      const accessToken = await storageManager.getAccessToken();

      if (!storedUser || !accessToken) {
        await storageManager.clearAuth();
        setLoading(false);
        return;
      }

      // Set API token
      apiService.setToken(accessToken);

      // Verify token with backend
      try {
        const response = await apiService.getProfile();
        setUser(response.data.user);
        setIsAuthenticated(true);
      } catch (error) {
        // Token might be expired, try to refresh
        await handleTokenRefresh();
      }
    } catch (error) {
      console.error("Auth initialization failed:", error);
      await storageManager.clearAuth();
    } finally {
      setLoading(false);
    }
  };

  const handleTokenRefresh = async () => {
    try {
      const refreshToken = await storageManager.getRefreshToken();
      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

      const response = await apiService.refreshToken(refreshToken);

      // Store new tokens
      const authData: StoredAuth = {
        accessToken: response.data.token,
        refreshToken: response.data.token, // Backend should return new refresh token
        user: response.data.user,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      };

      await storageManager.storeAuth(authData);
      apiService.setToken(response.data.token);

      setUser(response.data.user);
      setIsAuthenticated(true);
    } catch (error) {
      console.error("Token refresh failed:", error);
      await storageManager.clearAuth();
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.login(email, password);

      // Store authentication data securely
      const authData: StoredAuth = {
        accessToken: response.data.token,
        refreshToken: response.data.token, // Backend should return refresh token
        user: response.data.user,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      };

      await storageManager.storeAuth(authData);
      apiService.setToken(response.data.token);
      console.log("Login successful:", response.data.user);
      setUser(response.data.user);
      setIsAuthenticated(true);

      addToast({
        type: "success",
        title: "Welcome back!",
        message: `Successfully logged in as ${response.data.user.email}`,
      });
    } catch (error) {
      console.error("Login failed:", error);
      const errorMessage = AuthErrorHandler.parseBackendError(error);
      setError(errorMessage);

      addToast({
        type: "error",
        title: "Login Failed",
        message: errorMessage,
      });

      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.register(email, password);

      // Store authentication data securely
      const authData: StoredAuth = {
        accessToken: response.data.token,
        refreshToken: response.data.token, // Backend should return refresh token
        user: response.data.user,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      };

      await storageManager.storeAuth(authData);
      apiService.setToken(response.data.token);

      setUser(response.data.user);
      setIsAuthenticated(true);

      addToast({
        type: "success",
        title: "Account Created!",
        message: `Welcome to StoryMaker AI, ${response.data.user.email}!`,
      });
    } catch (error) {
      console.error("Registration failed:", error);
      const errorMessage = AuthErrorHandler.parseBackendError(error);
      setError(errorMessage);

      addToast({
        type: "error",
        title: "Registration Failed",
        message: errorMessage,
      });

      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Call backend logout endpoint
      await apiService.logout();
    } catch (error) {
      console.error("Backend logout failed:", error);
    } finally {
      // Clear local storage regardless of backend response
      await storageManager.clearAuth();
      apiService.setToken(null);
      setIsAuthenticated(false);
      setUser(null);

      addToast({
        type: "info",
        title: "Logged Out",
        message: "You have been successfully logged out",
      });
    }
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        loading,
        error,
        login,
        register,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
