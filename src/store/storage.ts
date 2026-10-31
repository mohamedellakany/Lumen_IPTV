import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/** AsyncStorage is backed by localStorage on web, so persisted state survives page reloads. */
export const persistStorage = createJSONStorage(() => AsyncStorage);
