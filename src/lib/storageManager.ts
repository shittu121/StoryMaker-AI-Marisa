// Unified storage manager that automatically handles Electron API availability
import { secureStorage, StoredAuth } from "./secureStorage";
import { alternativeStorage } from "./alternativeStorage";
import { isElectronAPIAvailable } from "./electronUtils";

export interface StorageProvider {
  storeAuth(authData: StoredAuth): Promise<void>;
  getAuth(): Promise<StoredAuth | null>;
  clearAuth(): Promise<void>;
  isAuthenticated(): Promise<boolean>;
  getAccessToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  getUser(): Promise<StoredAuth["user"] | null>;
  updateAccessToken(newToken: string, expiresIn: number): Promise<void>;
}

class StorageManager implements StorageProvider {
  private provider: StorageProvider | null = null;
  private providerName: string | null = null;

  constructor() {
    this.initializeProvider();
  }

  private initializeProvider() {
    if (isElectronAPIAvailable()) {
      this.provider = secureStorage;
      this.providerName = "Electron Secure Storage";
      console.log("🔐 Using Electron Secure Storage");
    } else {
      this.provider = alternativeStorage;
      this.providerName = "Alternative Storage (Web Crypto)";
      console.log("🔐 Using Alternative Storage with Web Crypto API");
    }
  }

  // Re-initialize provider (useful for testing or when Electron API becomes available)
  public reinitialize() {
    this.initializeProvider();
  }

  public getProviderName(): string {
    return this.providerName || "Unknown";
  }

  public isUsingElectron(): boolean {
    return this.provider === secureStorage;
  }

  // Implement StorageProvider interface
  async storeAuth(authData: StoredAuth): Promise<void> {
    try {
      if (!this.provider) {
        throw new Error("No storage provider available");
      }
      await this.provider.storeAuth(authData);
      console.log(`✅ Auth data stored using ${this.providerName}`);
    } catch (error) {
      console.error(
        `❌ Failed to store auth data with ${this.providerName}:`,
        error
      );

      // If Electron storage fails, try alternative storage
      if (this.provider === secureStorage) {
        console.log("🔄 Falling back to alternative storage...");
        this.provider = alternativeStorage;
        this.providerName = "Alternative Storage (Fallback)";
        await this.provider.storeAuth(authData);
        console.log("✅ Auth data stored using fallback storage");
      } else {
        throw error;
      }
    }
  }

  async getAuth(): Promise<StoredAuth | null> {
    try {
      if (!this.provider) {
        throw new Error("No storage provider available");
      }
      return await this.provider.getAuth();
    } catch (error) {
      console.error(
        `❌ Failed to get auth data with ${this.providerName}:`,
        error
      );

      // If Electron storage fails, try alternative storage
      if (this.provider === secureStorage) {
        console.log("🔄 Falling back to alternative storage...");
        this.provider = alternativeStorage;
        this.providerName = "Alternative Storage (Fallback)";
        return await this.provider.getAuth();
      }
      return null;
    }
  }

  async clearAuth(): Promise<void> {
    try {
      if (!this.provider) {
        throw new Error("No storage provider available");
      }
      await this.provider.clearAuth();
    } catch (error) {
      console.error(
        `❌ Failed to clear auth data with ${this.providerName}:`,
        error
      );
    }
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      if (!this.provider) {
        throw new Error("No storage provider available");
      }
      return await this.provider.isAuthenticated();
    } catch (error) {
      console.error(
        `❌ Failed to check authentication with ${this.providerName}:`,
        error
      );
      return false;
    }
  }

  async getAccessToken(): Promise<string | null> {
    try {
      if (!this.provider) {
        throw new Error("No storage provider available");
      }
      return await this.provider.getAccessToken();
    } catch (error) {
      console.error(
        `❌ Failed to get access token with ${this.providerName}:`,
        error
      );
      return null;
    }
  }

  async getRefreshToken(): Promise<string | null> {
    try {
      if (!this.provider) {
        throw new Error("No storage provider available");
      }
      return await this.provider.getRefreshToken();
    } catch (error) {
      console.error(
        `❌ Failed to get refresh token with ${this.providerName}:`,
        error
      );
      return null;
    }
  }

  async getUser(): Promise<StoredAuth["user"] | null> {
    try {
      if (!this.provider) {
        throw new Error("No storage provider available");
      }
      return await this.provider.getUser();
    } catch (error) {
      console.error(
        `❌ Failed to get user data with ${this.providerName}:`,
        error
      );
      return null;
    }
  }

  async updateAccessToken(newToken: string, expiresIn: number): Promise<void> {
    try {
      if (!this.provider) {
        throw new Error("No storage provider available");
      }
      await this.provider.updateAccessToken(newToken, expiresIn);
    } catch (error) {
      console.error(
        `❌ Failed to update access token with ${this.providerName}:`,
        error
      );
      throw error;
    }
  }

  // Migration helper: migrate data from one storage to another
  async migrateToElectron(): Promise<boolean> {
    if (this.provider === secureStorage) {
      console.log("✅ Already using Electron storage");
      return true;
    }

    if (!isElectronAPIAvailable()) {
      console.log("❌ Electron API not available for migration");
      return false;
    }

    try {
      const authData = await alternativeStorage.getAuth();
      if (!authData) {
        console.log("ℹ️ No data to migrate");
        return true;
      }

      await secureStorage.storeAuth(authData);
      await alternativeStorage.clearAuth();

      this.provider = secureStorage;
      this.providerName = "Electron Secure Storage (Migrated)";

      console.log("✅ Successfully migrated to Electron storage");
      return true;
    } catch (error) {
      console.error("❌ Migration failed:", error);
      return false;
    }
  }

  // Health check
  async healthCheck(): Promise<{
    provider: string;
    isElectron: boolean;
    isWorking: boolean;
    error?: string;
  }> {
    try {
      const testData: StoredAuth = {
        accessToken: "test-token",
        refreshToken: "test-refresh",
        user: {
          id: 1,
          email: "test@example.com",
          subscriptionStatus: "free",
        },
        expiresAt: Date.now() + 3600000,
      };

      if (!this.provider) {
        throw new Error("No storage provider available");
      }

      await this.provider.storeAuth(testData);
      const retrieved = await this.provider.getAuth();
      await this.provider.clearAuth();

      return {
        provider: this.providerName || "Unknown",
        isElectron: this.isUsingElectron(),
        isWorking:
          retrieved !== null && retrieved.accessToken === testData.accessToken,
      };
    } catch (error) {
      return {
        provider: this.providerName || "Unknown",
        isElectron: this.isUsingElectron(),
        isWorking: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// Export singleton instance
export const storageManager = new StorageManager();
