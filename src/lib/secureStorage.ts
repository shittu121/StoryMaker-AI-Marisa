// Secure storage using Electron's safeStorage
import { isElectronAPIAvailable } from "./electronUtils";

export interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    email: string;
    subscriptionStatus: "free" | "premium" | "pro";
  };
  expiresAt: number;
}

class SecureStorage {
  private readonly STORAGE_KEY = "storymaker_auth_encrypted";

  // Store authentication data securely using Electron's safeStorage
  async storeAuth(authData: StoredAuth): Promise<void> {
    try {
      const jsonData = JSON.stringify(authData);

      // Check if Electron API is available
      if (isElectronAPIAvailable()) {
        const encrypted = await window.electronAPI.secureStorage.encrypt(
          jsonData
        );
        localStorage.setItem(this.STORAGE_KEY, encrypted);
      } else {
        // Fallback to regular localStorage if Electron API is not available
        console.warn("Electron API not available, using regular localStorage");
        localStorage.setItem(this.STORAGE_KEY, jsonData);
      }
    } catch (error) {
      console.error("Failed to store auth data securely:", error);
      // Fallback to regular localStorage
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(authData));
      } catch (fallbackError) {
        throw new Error("Failed to store authentication data");
      }
    }
  }

  // Retrieve stored authentication data
  async getAuth(): Promise<StoredAuth | null> {
    try {
      const encrypted = localStorage.getItem(this.STORAGE_KEY);
      if (!encrypted) return null;

      // Check if Electron API is available
      if (isElectronAPIAvailable()) {
        const decrypted = await window.electronAPI.secureStorage.decrypt(
          encrypted
        );
        const authData: StoredAuth = JSON.parse(decrypted);

        // Check if token is expired
        if (Date.now() > authData.expiresAt) {
          await this.clearAuth();
          return null;
        }

        return authData;
      } else {
        // Fallback to regular localStorage if Electron API is not available
        console.warn("Electron API not available, using regular localStorage");
        const authData: StoredAuth = JSON.parse(encrypted);

        // Check if token is expired
        if (Date.now() > authData.expiresAt) {
          await this.clearAuth();
          return null;
        }

        return authData;
      }
    } catch (error) {
      console.error("Failed to retrieve auth data:", error);
      await this.clearAuth();
      return null;
    }
  }

  // Clear stored authentication data
  async clearAuth(): Promise<void> {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear auth data:", error);
    }
  }

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const auth = await this.getAuth();
    return auth !== null;
  }

  // Get access token
  async getAccessToken(): Promise<string | null> {
    const auth = await this.getAuth();
    return auth?.accessToken || null;
  }

  // Get refresh token
  async getRefreshToken(): Promise<string | null> {
    const auth = await this.getAuth();
    return auth?.refreshToken || null;
  }

  // Get user data
  async getUser(): Promise<StoredAuth["user"] | null> {
    const auth = await this.getAuth();
    return auth?.user || null;
  }

  // Update access token (for token refresh)
  async updateAccessToken(newToken: string, expiresIn: number): Promise<void> {
    try {
      const auth = await this.getAuth();
      if (!auth) throw new Error("No stored authentication data");

      const updatedAuth: StoredAuth = {
        ...auth,
        accessToken: newToken,
        expiresAt: Date.now() + expiresIn * 1000,
      };

      await this.storeAuth(updatedAuth);
    } catch (error) {
      console.error("Failed to update access token:", error);
      throw error;
    }
  }
}

export const secureStorage = new SecureStorage();
