"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useWebSocket, type WSMessage } from "./use-websocket";

/**
 * High-level hook for real-time updates from Jarvis Brain API.
 * Subscribes to typed WebSocket events and provides an event-based API.
 *
 * - Auto-connects on mount
 * - Dispatches events by type
 * - Tracks last event per type for snapshot reads
 * - Falls back gracefully when WS is unavailable (polling continues)
 */
export function useRealtimeUpdates() {
  const ws = useWebSocket();
  const [lastEvents, setLastEvents] = useState<Record<string, WSMessage>>({});
  const callbacksRef = useRef<Map<string, Set<(data: Record<string, unknown>) => void>>>(new Map());

  // Register a callback for a specific event type
  const subscribe = useCallback(
    (eventType: string, callback: (data: Record<string, unknown>) => void) => {
      if (!callbacksRef.current.has(eventType)) {
        callbacksRef.current.set(eventType, new Set());
      }
      callbacksRef.current.get(eventType)!.add(callback);

      // Return unsubscribe function
      return () => {
        callbacksRef.current.get(eventType)?.delete(callback);
      };
    },
    [],
  );

  // Listen to all incoming messages and dispatch
  useEffect(() => {
    const unsub = ws.on("*", (msg: WSMessage) => {
      // Track last event per type
      setLastEvents((prev) => ({
        ...prev,
        [msg.type]: msg,
      }));

      // Dispatch to subscribers
      const handlers = callbacksRef.current.get(msg.type);
      if (handlers) {
        handlers.forEach((cb) => cb(msg.data || {}));
      }
    });

    return unsub;
  }, [ws]);

  return {
    isConnected: ws.status === "connected",
    status: ws.status,
    lastEvents,
    subscribe,
    lastMessage: ws.lastMessage,
  };
}
