import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { generateDeviceKeyPair } from '../crypto/webCrypto';
import { saveDeviceKey, getDeviceKey, getAllDevices } from '../db/indexedDB';
import { apiService } from '../api/client';

const DeviceContext = createContext();

export function DeviceProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDevice() {
      if (!isAuthenticated || !user) {
        setDevice(null);
        setLoading(false);
        return;
      }

      try {
        const allDevices = await getAllDevices();
        // Find device associated with this user
        const userDevice = allDevices.find((d) => d.user_id === user.id);
        if (userDevice) {
          setDevice(userDevice);
        } else {
          setDevice(null);
        }
      } catch (err) {
        console.error('Error loading device from IndexedDB:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDevice();
  }, [user, isAuthenticated]);

  const registerDevice = async (deviceName = 'Browser Device') => {
    if (!user) throw new Error('User must be logged in to register device');

    // 1. Generate ECDSA P-256 key pair via Web Crypto API
    const { keyPair, public_key_spki } = await generateDeviceKeyPair();
    const deviceId = 'dev_' + crypto.randomUUID().slice(0, 12);

    const deviceRecord = {
      device_id: deviceId,
      user_id: user.id,
      keyPair,
      public_key_spki,
      device_name: deviceName,
      counter: 0,
      registered_at: new Date().toISOString(),
    };

    // 2. Save in IndexedDB (Private key NEVER leaves device!)
    await saveDeviceKey(deviceRecord);

    // 3. Register public key with backend server
    try {
      await apiService.registerDevice({
        device_id: deviceId,
        public_key_spki,
        device_name: deviceName,
      });
    } catch (err) {
      console.warn('Backend device registration note:', err);
      // Even if offline, local key is saved
    }

    setDevice(deviceRecord);
    return deviceRecord;
  };

  const getNextCounter = async (deviceId) => {
    const dev = await getDeviceKey(deviceId);
    if (!dev) throw new Error('Device not found locally');
    const nextCount = (dev.counter || 0) + 1;
    dev.counter = nextCount;
    await saveDeviceKey(dev);
    setDevice({ ...dev });
    return nextCount;
  };

  return (
    <DeviceContext.Provider
      value={{
        device,
        loading,
        isRegistered: !!device,
        registerDevice,
        getNextCounter,
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice() {
  return useContext(DeviceContext);
}
