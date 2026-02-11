"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/* ─── Types ─── */
export interface WSMessage {
  type: string;
  data?: Record<string, unknown>;
  timestamp?: string;
}

type WSStatus = "connecting" | "connected" | "disconnected" | "error";
type EventHandler = (message: WSMessage) => void;

interface UseWebSocketOptions {
  url?: string;
  reconnectInterval?: number;
  maxReconnects?: number;
  heartbeatInterval?: number;
}

/* ─── Hook ─── */
export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = `ws://${typeof window !== "undefined" ? window.location.hostname : "localhost"}:8000/ws`,
    reconnectInterval = 3000,
    maxReconnects = 10,
    heartbeatInterval = 30000,
  } = options;

  const [status, setStatus] = useState<WSStatus>("disconnected");
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handlersRef = useRef<Map<string, Set<EventHandler>>>(new Map());

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      cleanup();
      setStatus("connecting");

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        reconnectCountRef.current = 0;

        // Start heartbeat
        heartbeatTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, heartbeatInterval);
      };

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          if (msg.type === "pong") return;

          setLastMessage(msg);

          // Dispatch to registered handlers
          const handlers = handlersRef.current.get(msg.type);
          if (handlers) {
            handlers.forEach((handler) => handler(msg));
          }

          // Wildcard handlers
          const wildcardHandlers = handlersRef.current.get("*");
          if (wildcardHandlers) {
            wildcardHandlers.forEach((handler) => handler(msg));
          }
        } catch {
          /* ignore parse errors */
        }
      };

      ws.onclose = () => {
        setStatus("disconnected");
        cleanup();

        if (reconnectCountRef.current < maxReconnects) {
          reconnectCountRef.current++;
          reconnectTimerRef.current = setTimeout(connect, reconnectInterval);
        }
      };

      ws.onerror = () => {
        setStatus("error");
      };
    } catch {
      setStatus("error");
    }
  }, [url, reconnectInterval, maxReconnects, heartbeatInterval, cleanup]);

  const disconnect = useCallback(() => {
    cleanup();
    reconnectCountRef.current = maxReconnects; // prevent auto-reconnect
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus("disconnected");
  }, [cleanup, maxReconnects]);

  const send = useCallback((message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const on = useCallback((eventType: string, handler: EventHandler) => {
    if (!handlersRef.current.has(eventType)) {
      handlersRef.current.set(eventType, new Set());
    }
    handlersRef.current.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      handlersRef.current.get(eventType)?.delete(handler);
    };
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { status, lastMessage, send, on, connect, disconnect };
}
