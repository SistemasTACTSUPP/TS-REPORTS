import { defineStore } from 'pinia';
import { supabase } from '../supabaseClient';

export interface RegistroSyncPayload {
  id: string;
  createdAt: string;
  folio?: string;
}

interface SyncItem {
  id: string;
  payload: RegistroSyncPayload;
  status: 'pending' | 'processing' | 'done' | 'error';
  lastError?: string;
  updatedAt: string;
}

interface SyncState {
  queue: SyncItem[];
  syncing: boolean;
  history: SyncItem[];
}

const STORAGE_KEY = 'ts_ctpat_sync_queue_v1';
const HISTORY_KEY = 'ts_ctpat_sync_history_v1';

export const useSyncStore = defineStore('sync', {
  state: (): SyncState => ({
    queue: [],
    syncing: false,
    history: []
  }),
  actions: {
    loadFromStorage() {
      const raw = localStorage.getItem(STORAGE_KEY);
      const rawHistory = localStorage.getItem(HISTORY_KEY);
      if (raw) {
        this.queue = JSON.parse(raw);
      }
      if (rawHistory) {
        this.history = JSON.parse(rawHistory);
      }
    },
    persist() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
      localStorage.setItem(HISTORY_KEY, JSON.stringify(this.history));
    },
    enqueueRegistro(payload: RegistroSyncPayload) {
      const now = new Date().toISOString();
      const item: SyncItem = {
        id: payload.id,
        payload,
        status: 'pending',
        updatedAt: now
      };
      this.queue.push(item);
      this.persist();
    },
    async processQueue() {
      if (this.syncing || this.queue.length === 0) return;
      if (!navigator.onLine) return;

      this.syncing = true;
      const functionsBaseUrl =
        import.meta.env.VITE_SUPABASE_FUNCTIONS_URL ??
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

      try {
        const {
          data: { session }
        } = await supabase.auth.getSession();
        // @ts-expect-error provider_token está presente cuando el proveedor es OAuth (Google)
        const accessToken: string | undefined = (session as any)?.provider_token;

        if (!accessToken) {
          throw new Error(
            'No hay token de Google disponible (provider_token). Cierra sesión y vuelve a iniciar con Google.'
          );
        }

        for (const item of this.queue) {
          if (item.status !== 'pending') continue;
          item.status = 'processing';
          item.updatedAt = new Date().toISOString();
          this.persist();

          try {
            const res = await fetch(`${functionsBaseUrl}/generate-ctpat-pdf`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ registroId: item.payload.id, accessToken })
            });

            if (!res.ok) {
              const text = await res.text();
              throw new Error(text || 'Error en Edge Function');
            }

            item.status = 'done';
            item.updatedAt = new Date().toISOString();
            this.history.unshift({ ...item });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            item.status = 'error';
            item.lastError = message;
            item.updatedAt = new Date().toISOString();
            this.history.unshift({ ...item });
          }
        }

        this.queue = this.queue.filter((q) => q.status === 'pending' || q.status === 'error');
        this.persist();
      } finally {
        this.syncing = false;
      }
    },
    attachOnlineListener() {
      window.addEventListener('online', () => {
        void this.processQueue();
      });
    }
  }
});

