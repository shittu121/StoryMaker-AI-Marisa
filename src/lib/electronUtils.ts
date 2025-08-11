// Utility functions for Electron API detection and debugging

export const isElectron = (): boolean => {
  return window?.electronAPI !== undefined;
};

export const isElectronAPIAvailable = (): boolean => {
  return isElectron() && window.electronAPI?.secureStorage !== undefined;
};

export const logElectronStatus = (): void => {
  console.log("🔍 Electron Environment Check:");
  console.log("  - window.electronAPI:", window.electronAPI);
  console.log("  - isElectron():", isElectron());
  console.log("  - isElectronAPIAvailable():", isElectronAPIAvailable());

  if (window.electronAPI) {
    console.log("  - Available APIs:", Object.keys(window.electronAPI));
    if (window.electronAPI.secureStorage) {
      console.log(
        "  - Secure Storage APIs:",
        Object.keys(window.electronAPI.secureStorage)
      );
    }
  }

  console.log("  - User Agent:", navigator.userAgent);
  console.log("  - Platform:", navigator.platform);
};

export const getStorageMode = (): "electron" | "localStorage" => {
  return isElectronAPIAvailable() ? "electron" : "localStorage";
};

// Debug function to test Electron API
export const testElectronAPI = async (): Promise<void> => {
  console.log("🧪 Testing Electron API...");

  if (!isElectron()) {
    console.log("❌ Electron API not available");
    return;
  }

  try {
    // Test platform info
    console.log("✅ Platform:", window.electronAPI.platform);
    console.log("✅ Versions:", window.electronAPI.versions);

    // Test secure storage if available
    if (window.electronAPI.secureStorage) {
      const testData = "test-encryption-data";
      console.log("🔐 Testing secure storage...");

      const encrypted = await window.electronAPI.secureStorage.encrypt(
        testData
      );
      console.log("✅ Encryption successful");

      const decrypted = await window.electronAPI.secureStorage.decrypt(
        encrypted
      );
      console.log("✅ Decryption successful:", decrypted === testData);
    } else {
      console.log("⚠️ Secure storage not available");
    }

    // Test app controls
    if (window.electronAPI.app) {
      console.log("✅ App controls available");
    }

    // Test network status
    if (window.electronAPI.network) {
      console.log(
        "✅ Network status available:",
        window.electronAPI.network.isOnline()
      );
    }
  } catch (error) {
    console.error("❌ Electron API test failed:", error);
  }
};
