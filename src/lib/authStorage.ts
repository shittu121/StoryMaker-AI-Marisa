// Secure token storage for Electron app
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

class AuthStorage {
  private readonly STORAGE_KEY = "storymaker_auth";

  // Store authentication data securely
  async storeAuth(authData: StoredAuth): Promise<void> {
    try {
      // In Electron, we can use localStorage for now
      // In production, you might want to use Electron's safeStorage
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(authData));
    } catch (error) {
      console.error("Failed to store auth data:", error);
      throw new Error("Failed to store authentication data");
    }
  }

  // Retrieve stored authentication data
  async getAuth(): Promise<StoredAuth | null> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;

      const authData: StoredAuth = JSON.parse(stored);

      // Check if token is expired
      if (Date.now() > authData.expiresAt) {
        await this.clearAuth();
        return null;
      }

      return authData;
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
}

export const authStorage = new AuthStorage();
