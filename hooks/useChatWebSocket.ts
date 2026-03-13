import { useEffect, useRef, useState, useCallback } from 'react';
import { getChatWebSocketUrl } from '../services/api';
import { getAuthToken } from '../services/utils/auth';

export type ChatWsIncoming =
  | { type: 'new_message'; chat_id: string | number; message: ChatMessagePayload }
  | { type: 'chat_updated'; chat_id: string | number; last_message_at?: string; last_message_preview?: string; unseen_count?: number }
  | { type: 'user_typing'; chat_id: string | number; user_id: string; user_name: string; is_typing: boolean }
  | { type: 'messages_seen'; chat_id: string | number; seen_by: string; seen_by_name?: string; message_ids?: number[]; last_seen_message_id?: number; seen_at?: string };

export interface ChatMessagePayload {
  id?: number;
  sender: string;
  sender_name?: string;
  message: string;
  date?: string;
  time?: string;
  attachment_id?: number;
  attachment?: { id: number; type: string; file_name: string; url: string };
  created_at?: string;
}

export type ChatWsOutgoing =
  | { type: 'subscribe'; chat_id: string | number }
  | { type: 'unsubscribe'; chat_id: string | number }
  | { type: 'typing_start'; chat_id: string | number }
  | { type: 'typing_stop'; chat_id: string | number }
  | { type: 'mark_seen'; chat_id: string | number; message_ids?: number[]; last_seen_message_id?: number };

export interface UseChatWebSocketOptions {
  enabled: boolean;
  onNewMessage?: (data: { chat_id: string | number; message: ChatMessagePayload }) => void;
  onChatUpdated?: (data: { chat_id: string | number; last_message_at?: string; last_message_preview?: string; unseen_count?: number }) => void;
  onUserTyping?: (data: { chat_id: string | number; user_id: string; user_name: string; is_typing: boolean }) => void;
  onMessagesSeen?: (data: { chat_id: string | number; seen_by: string; message_ids?: number[]; last_seen_message_id?: number }) => void;
}

export function useChatWebSocket(options: UseChatWebSocketOptions) {
  const {
    enabled,
    onNewMessage,
    onChatUpdated,
    onUserTyping,
    onMessagesSeen,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacksRef = useRef({
    onNewMessage,
    onChatUpdated,
    onUserTyping,
    onMessagesSeen,
  });
  callbacksRef.current = {
    onNewMessage,
    onChatUpdated,
    onUserTyping,
    onMessagesSeen,
  };

  const send = useCallback((msg: ChatWsOutgoing) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const subscribe = useCallback((chatId: string | number) => {
    send({ type: 'subscribe', chat_id: chatId });
  }, [send]);

  const unsubscribe = useCallback((chatId: string | number) => {
    send({ type: 'unsubscribe', chat_id: chatId });
  }, [send]);

  const sendTypingStart = useCallback((chatId: string | number) => {
    send({ type: 'typing_start', chat_id: chatId });
  }, [send]);

  const sendTypingStop = useCallback((chatId: string | number) => {
    send({ type: 'typing_stop', chat_id: chatId });
  }, [send]);

  const sendMarkSeen = useCallback((chatId: string | number, messageIds?: number[], lastSeenMessageId?: number) => {
    if (messageIds?.length) {
      send({ type: 'mark_seen', chat_id: chatId, message_ids: messageIds });
    } else if (lastSeenMessageId != null) {
      send({ type: 'mark_seen', chat_id: chatId, last_seen_message_id: lastSeenMessageId });
    } else {
      send({ type: 'mark_seen', chat_id: chatId });
    }
  }, [send]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const connect = () => {
      const baseUrl = getChatWebSocketUrl();
      const token = getAuthToken();
      const url = token ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : baseUrl;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[Chat WS] Connected');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as ChatWsIncoming;
          const cbs = callbacksRef.current;

          switch (data.type) {
            case 'new_message': {
              const msg = data.message ?? (data as any).payload ?? (data as any).data ?? data;
              cbs.onNewMessage?.({ chat_id: data.chat_id, message: msg, sender: (data as any).sender, text: (data as any).text });
              break;
            }
            case 'chat_updated':
              cbs.onChatUpdated?.({
                chat_id: data.chat_id,
                last_message_at: data.last_message_at,
                last_message_preview: data.last_message_preview,
                unseen_count: data.unseen_count,
              });
              break;
            case 'user_typing':
              cbs.onUserTyping?.({
                chat_id: data.chat_id,
                user_id: data.user_id,
                user_name: data.user_name,
                is_typing: data.is_typing,
              });
              break;
            case 'messages_seen':
              cbs.onMessagesSeen?.({
                chat_id: data.chat_id,
                seen_by: data.seen_by,
                message_ids: data.message_ids,
                last_seen_message_id: data.last_seen_message_id,
              });
              break;
            default:
              break;
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        console.warn('[Chat WS] Error');
      };

      ws.onclose = () => {
        wsRef.current = null;
        setIsConnected(false);
        if (enabled) {
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      };
    };

    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled]);

  return {
    send,
    subscribe,
    unsubscribe,
    sendTypingStart,
    sendTypingStop,
    sendMarkSeen,
    isConnected,
  };
}
