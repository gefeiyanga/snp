import localforage from 'localforage';

// Configure localforage
localforage.config({
  name: 'vue3-ts-pwa-app',
  version: 1.0,
  storeName: 'keyvaluepairs',
  description: 'Persistent storage for Vue3 app'
});

// Define a generic type for our storage
export interface StorageItem {
  [key: string]: any;
}

/**
 * Composable function to interact with localforage
 */
export function useAppStorage() {
  /**
   * Get an item from storage
   * @param key The key to retrieve
   * @returns Promise that resolves to the stored value or null
   */
  const getItem = async <T>(key: string): Promise<T | null> => {
    try {
      const value = await localforage.getItem<T>(key);
      return value;
    } catch (error) {
      console.error(`Error getting item with key ${key}:`, error);
      return null;
    }
  };

  /**
   * Set an item in storage
   * @param key The key to store
   * @param value The value to store
   * @returns Promise that resolves when the item is stored
   */
  const setItem = async <T>(key: string, value: T): Promise<void> => {
    try {
      await localforage.setItem(key, value);
    } catch (error) {
      console.error(`Error setting item with key ${key}:`, error);
      throw error;
    }
  };

  /**
   * Remove an item from storage
   * @param key The key to remove
   * @returns Promise that resolves when the item is removed
   */
  const removeItem = async (key: string): Promise<void> => {
    try {
      await localforage.removeItem(key);
    } catch (error) {
      console.error(`Error removing item with key ${key}:`, error);
      throw error;
    }
  };

  /**
   * Clear all items from storage
   * @returns Promise that resolves when storage is cleared
   */
  const clear = async (): Promise<void> => {
    try {
      await localforage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  };

  /**
   * Get the number of items in storage
   * @returns Promise that resolves to the number of items
   */
  const length = async (): Promise<number> => {
    try {
      return await localforage.length();
    } catch (error) {
      console.error('Error getting storage length:', error);
      return 0;
    }
  };

  /**
   * Get the key at the given index
   * @param index The index to get the key for
   * @returns Promise that resolves to the key or null
   */
  const key = async (index: number): Promise<string | null> => {
    try {
      return await localforage.key(index);
    } catch (error) {
      console.error(`Error getting key at index ${index}:`, error);
      return null;
    }
  };

  /**
   * Get all keys in storage
   * @returns Promise that resolves to an array of keys
   */
  const keys = async (): Promise<string[]> => {
    try {
      const length = await localforage.length();
      const keysArray: string[] = [];

      for (let i = 0; i < length; i++) {
        const key = await localforage.key(i);
        if (key !== null) {
          keysArray.push(key);
        }
      }

      return keysArray;
    } catch (error) {
      console.error('Error getting storage keys:', error);
      return [];
    }
  };

  return {
    getItem,
    setItem,
    removeItem,
    clear,
    length,
    key,
    keys
  };
}
