import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type RealtimeMessage } from '../lib/api';
import type { QueueItem } from '../types';

export function useRealtime() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [connected, setConnected] = useState(false);
  const [mockMode, setMockMode] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const applyMessage = useCallback((msg: RealtimeMessage) => {
    switch (msg.type) {
      case 'SYNC':
        setQueue(msg.data);
        break;
      case 'CAR_QUEUED':
        setQueue((prev) => {
          if (prev.some((q) => q.id === msg.data.id)) return prev;
          return [...prev, msg.data].sort((a, b) => a.created_at.localeCompare(b.created_at));
        });
        break;
      case 'QUEUE_UPDATED':
        setQueue((prev) =>
          prev.map((q) => (q.id === msg.data.id ? msg.data : q)).sort((a, b) => a.created_at.localeCompare(b.created_at))
        );
        break;
      case 'QUEUE_REMOVED':
        setQueue((prev) => prev.filter((q) => q.id !== msg.data.id));
        break;
      case 'ROSTER_SYNCED':
        break;
      case 'SESSION_RESET':
        refresh();
        break;
    }
  }, []);

  const refresh = useCallback(async () => {
    const data = await api.getQueue();
    setQueue(data);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      try {
        const neg = await api.negotiate();

        if ('mock' in neg && neg.mock) {
          setMockMode(true);
          const es = new EventSource('/api/events');
          eventSourceRef.current = es;

          es.onopen = () => !cancelled && setConnected(true);
          es.onmessage = (ev) => {
            if (cancelled) return;
            try {
              applyMessage(JSON.parse(ev.data) as RealtimeMessage);
            } catch {
              /* ignore parse errors */
            }
          };
          es.onerror = () => !cancelled && setConnected(false);
          return;
        }

        setMockMode(false);
        if (!('url' in neg)) return;
        const ws = new WebSocket(neg.url, 'json.webpubsub.azure.v1');
        wsRef.current = ws;

        ws.onopen = () => {
          if (cancelled) return;
          setConnected(true);
          ws.send(JSON.stringify({ type: 'joinGroup', group: 'carpool' }));
        };

        ws.onmessage = (ev) => {
          if (cancelled) return;
          try {
            const parsed = JSON.parse(ev.data);
            const msg = parsed.data ?? parsed;
            applyMessage(msg as RealtimeMessage);
          } catch {
            /* ignore */
          }
        };

        ws.onclose = () => !cancelled && setConnected(false);
        ws.onerror = () => !cancelled && setConnected(false);
      } catch {
        // Fallback: poll
        setMockMode(true);
        setConnected(true);
        await refresh();
        const interval = setInterval(refresh, 3000);
        return () => clearInterval(interval);
      }
    }

    connect();

    return () => {
      cancelled = true;
      eventSourceRef.current?.close();
      wsRef.current?.close();
    };
  }, [applyMessage, refresh]);

  return { queue, connected, mockMode, refresh, applyMessage };
}
