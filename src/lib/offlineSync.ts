// Simple wrapper around IndexedDB for offline queueing
const DB_NAME = 'syority_offline_db';
const STORE_NAME = 'sync_queue';

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject('No window');
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

export async function queueRequest(url: string, method: string, body: any) {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.add({ url, method, body, timestamp: Date.now() });
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Failed to queue offline request:', error);
  }
}

export async function getQueue() {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    
    return new Promise<any[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    return [];
  }
}

export async function clearQueueItem(id: number) {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
  } catch (error) {
    console.error('Failed to clear queue item:', error);
  }
}

export async function processOfflineQueue() {
  if (typeof window === 'undefined' || !navigator.onLine) return;
  
  const queue = await getQueue();
  if (!queue || queue.length === 0) return;

  console.log(`Processing ${queue.length} offline queued requests...`);

  for (const item of queue) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        body: item.body ? JSON.stringify(item.body) : undefined,
      });

      if (res.ok) {
        await clearQueueItem(item.id);
      } else {
        console.error(`Offline sync failed for ${item.url} with status ${res.status}`);
        // Depending on business logic, we might keep it in queue or drop it
        if (res.status >= 400 && res.status < 500) {
          // Client error (e.g. validation failed), drop it to avoid infinite loops
          await clearQueueItem(item.id);
        }
      }
    } catch (err) {
      console.error('Network error during offline queue processing', err);
      // Stop processing if network drops again
      break;
    }
  }
}
