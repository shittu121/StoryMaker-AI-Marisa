// Alternative storage solution that doesn't rely on Electron's secureStorage
// Uses Web Crypto API for encryption when available

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

class AlternativeStorage {
  private readonly STORAGE_KEY = "storymaker_auth_encrypted_v2";
  private readonly ENCRYPTION_KEY = "storymaker-auth-key-2024"; // In production, use a more secure key

  // Simple encryption using Web Crypto API
  private async encrypt(text: string): Promise<string> {
    try {
      // Check if Web Crypto API is available
      if (window.crypto && window.crypto.subtle) {
        // Generate a key from the password
        const encoder = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
          "raw",
          encoder.encode(this.ENCRYPTION_KEY),
          { name: "PBKDF2" },
          false,
          ["deriveBits", "deriveKey"]
        );

        // Generate a key using PBKDF2
        const key = await window.crypto.subtle.deriveKey(
          {
            name: "PBKDF2",
            salt: encoder.encode("storymaker-salt"),
            iterations: 100000,
            hash: "SHA-256",
          },
          keyMaterial,
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt"]
        );

        // Generate IV
        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        // Encrypt the data
        const encrypted = await window.crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          key,
          encoder.encode(text)
        );

        // Combine IV and encrypted data
        const encryptedArray = new Uint8Array(encrypted);
        const combined = new Uint8Array(iv.length + encryptedArray.length);
        combined.set(iv);
        combined.set(encryptedArray, iv.length);

        return btoa(String.fromCharCode(...combined));
      } else {
        // Fallback to simple encoding if Web Crypto API is not available
        return btoa(unescape(encodeURIComponent(text)));
      }
    } catch (error) {
      console.error("Encryption failed:", error);
      // Fallback to simple encoding
      return btoa(unescape(encodeURIComponent(text)));
    }
  }

  // Simple decryption using Web Crypto API
  private async decrypt(encryptedText: string): Promise<string> {
    try {
      // Check if Web Crypto API is available
      if (window.crypto && window.crypto.subtle) {
        // Decode the base64 string
        const combined = new Uint8Array(
          atob(encryptedText)
            .split("")
            .map((char) => char.charCodeAt(0))
        );

        // Extract IV and encrypted data
        const iv = combined.slice(0, 12);
        const encrypted = combined.slice(12);

        // Generate the same key
        const encoder = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
          "raw",
          encoder.encode(this.ENCRYPTION_KEY),
          { name: "PBKDF2" },
          false,
          ["deriveBits", "deriveKey"]
        );

        const key = await window.crypto.subtle.deriveKey(
          {
            name: "PBKDF2",
            salt: encoder.encode("storymaker-salt"),
            iterations: 100000,
            hash: "SHA-256",
          },
          keyMaterial,
          { name: "AES-GCM", length: 256 },
          true,
          ["decrypt"]
        );

        // Decrypt the data
        const decrypted = await window.crypto.subtle.decrypt(
          { name: "AES-GCM", iv },
          key,
          encrypted
        );

        return new TextDecoder().decode(decrypted);
      } else {
        // Fallback to simple decoding
        return decodeURIComponent(escape(atob(encryptedText)));
      }
    } catch (error) {
      console.error("Decryption failed:", error);
      // Fallback to simple decoding
      return decodeURIComponent(escape(atob(encryptedText)));
    }
  }

  // Store authentication data
  async storeAuth(authData: StoredAuth): Promise<void> {
    try {
      const jsonData = JSON.stringify(authData);
      const encrypted = await this.encrypt(jsonData);
      localStorage.setItem(this.STORAGE_KEY, encrypted);
      console.log("✅ Auth data stored using alternative encryption");
    } catch (error) {
      console.error("Failed to store auth data:", error);
      throw new Error("Failed to store authentication data");
    }
  }

  // Retrieve stored authentication data
  async getAuth(): Promise<StoredAuth | null> {
    try {
      const encrypted = localStorage.getItem(this.STORAGE_KEY);
      if (!encrypted) return null;

      const decrypted = await this.decrypt(encrypted);
      const authData: StoredAuth = JSON.parse(decrypted);

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

export const alternativeStorage = new AlternativeStorage();
