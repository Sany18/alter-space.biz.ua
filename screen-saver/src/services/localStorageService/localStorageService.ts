// Define a generic type for the values stored in localStorage
type StorageValue = string | number | boolean | object | null;

// Define an interface for the service methods
interface LocalStorageService {
  getItem<T>(key: string): T | null;
  setItem<T extends StorageValue>(key: string, value: T): void;
  removeItem(key: string): void;
  clear(): void;
}

// Utility to handle serialization/deserialization
const serialize = (value: StorageValue): string => {
  return JSON.stringify(value);
};

const deserialize = <T>(value: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error(`Error parsing localStorage value: ${error}`);
    return null;
  }
};

// LocalStorage service implementation
const localStorageService: LocalStorageService = {
  // Get an item from localStorage with type inference
  getItem<T>(key: string): T | null {
    const value = window.localStorage.getItem(key);
    return deserialize<T>(value);
  },

  // Set an item in localStorage
  setItem<T extends StorageValue>(key: string, value: T): void {
    try {
      const serializedValue = serialize(value);
      window.localStorage.setItem(key, serializedValue);
    } catch (error) {
      console.error(`Error setting localStorage item: ${error}`);
    }
  },

  // Remove an item from localStorage
  removeItem(key: string): void {
    window.localStorage.removeItem(key);
  },

  // Clear all items from localStorage
  clear(): void {
    window.localStorage.clear();
  },
};

export default localStorageService;
