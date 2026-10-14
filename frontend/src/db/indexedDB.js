const DB_NAME = 'OfflinePaymentDB';
const DB_VERSION = 1;

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Device keys & identity
      if (!db.objectStoreNames.contains('device_keys')) {
        db.createObjectStore('device_keys', { keyPath: 'device_id' });
      }

      // Allowance Certificates
      if (!db.objectStoreNames.contains('certificates')) {
        db.createObjectStore('certificates', { keyPath: 'certificate_id' });
      }

      // Offline Synchronization Queue
      if (!db.objectStoreNames.contains('sync_queue')) {
        const queueStore = db.createObjectStore('sync_queue', { keyPath: 'transaction_id' });
        queueStore.createIndex('created_at', 'created_at', { unique: false });
        queueStore.createIndex('status', 'local_status', { unique: false });
      }

      // Merchant state: received tokens & receipts
      if (!db.objectStoreNames.contains('merchant_receipts')) {
        db.createObjectStore('merchant_receipts', { keyPath: 'transaction_id' });
      }

      // Merchant nonce protection
      if (!db.objectStoreNames.contains('seen_nonces')) {
        db.createObjectStore('seen_nonces', { keyPath: 'nonce' });
      }

      // Merchant device counters tracking
      if (!db.objectStoreNames.contains('device_counters')) {
        db.createObjectStore('device_counters', { keyPath: 'payer_device_id' });
      }

      // Bank public key cache
      if (!db.objectStoreNames.contains('bank_cache')) {
        db.createObjectStore('bank_cache', { keyPath: 'key_id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

// Generic Helpers
export async function dbPut(storeName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbGet(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbGetAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbDelete(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Device Key Management
export async function saveDeviceKey(deviceData) {
  return await dbPut('device_keys', deviceData);
}

export async function getDeviceKey(deviceId) {
  return await dbGet('device_keys', deviceId);
}

export async function getAllDevices() {
  return await dbGetAll('device_keys');
}

// Certificate Storage
export async function saveCertificate(cert) {
  return await dbPut('certificates', cert);
}

export async function getCertificate(certId) {
  return await dbGet('certificates', certId);
}

export async function getAllCertificates() {
  return await dbGetAll('certificates');
}

// Sync Queue
export async function addToSyncQueue(item) {
  return await dbPut('sync_queue', item);
}

export async function getSyncQueue() {
  return await dbGetAll('sync_queue');
}

export async function updateSyncQueueItem(item) {
  return await dbPut('sync_queue', item);
}

export async function removeFromSyncQueue(txId) {
  return await dbDelete('sync_queue', txId);
}

// Merchant State Checks
export async function checkAndRecordMerchantNonce(nonce, transactionId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('seen_nonces', 'readwrite');
    const store = tx.objectStore('seen_nonces');
    const getReq = store.get(nonce);

    getReq.onsuccess = () => {
      if (getReq.result) {
        // Nonce was already seen!
        resolve({ valid: false, message: 'Nonce has already been accepted locally.' });
      } else {
        store.put({ nonce, transaction_id: transactionId, timestamp: new Date().toISOString() });
        resolve({ valid: true });
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function checkAndRecordMerchantCounter(payerDeviceId, counter) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('device_counters', 'readwrite');
    const store = tx.objectStore('device_counters');
    const getReq = store.get(payerDeviceId);

    getReq.onsuccess = () => {
      const record = getReq.result;
      const highest = record ? record.highest_counter : 0;
      if (counter <= highest) {
        resolve({
          valid: false,
          message: `Counter ${counter} is not higher than previously observed counter (${highest}) for this device.`,
          highest
        });
      } else {
        store.put({ payer_device_id: payerDeviceId, highest_counter: counter, updated_at: new Date().toISOString() });
        resolve({ valid: true, previous_counter: highest });
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// Bank Public Key Cache
export async function cacheBankPublicKey(spkiB64) {
  return await dbPut('bank_cache', { key_id: 'BANK_PUBLIC_KEY', spki_b64: spkiB64, updated_at: new Date().toISOString() });
}

export async function getCachedBankPublicKey() {
  const rec = await dbGet('bank_cache', 'BANK_PUBLIC_KEY');
  return rec ? rec.spki_b64 : null;
}
