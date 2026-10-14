import React, { createContext, useContext, useState, useEffect } from 'react';

const NetworkContext = createContext();

export function NetworkProvider({ children }) {
  const [realOnline, setRealOnline] = useState(navigator.onLine);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => setRealOnline(true);
    const handleOffline = () => setRealOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Effective status
  const isOnline = realOnline && !isSimulatedOffline;

  const toggleSimulatedOffline = () => {
    setIsSimulatedOffline((prev) => !prev);
  };

  return (
    <NetworkContext.Provider
      value={{
        isOnline,
        realOnline,
        isSimulatedOffline,
        toggleSimulatedOffline,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
