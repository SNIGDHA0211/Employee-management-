import { useEffect, useRef, useState, useCallback } from 'react';
import { getCallsWebSocketUrl } from '../services/api';

export type CallsWsMessage =
  | { type: 'incoming_call'; call_id: number; sender: string; receiver: string; call_type: 'audio' | 'video' }
  | { type: 'call_accepted'; from_user: string }
  | { type: 'call_declined'; from_user: string }
  | { type: 'call_ended'; from_user: string }
  | { type: 'end_call'; from_user?: string; sender?: string }
  | { type: 'webrtc_offer'; sdp: RTCSessionDescriptionInit; from_user: string; call_id?: number }
  | { type: 'webrtc_answer'; sdp: RTCSessionDescriptionInit; from_user: string; call_id?: number }
  | { type: 'ice_candidate'; candidate: RTCIceCandidateInit; from_user: string }
  | { type: 'webrtc_signal'; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit; from_user: string; call_id?: number }
  | { type: 'incoming_group_call'; call_id: number; creator: string; call_type: 'audio' | 'video'; participant_usernames: string[] }
  | { type: 'participant_joined'; call_id: number; username: string; participant_usernames: string[] }
  | { type: 'participant_left'; call_id: number; username: string }
  | { type: 'group_call_ended'; call_id: number; reason?: string }
  | { type: 'screen_share_started'; call_id: number; from_user: string }
  | { type: 'screen_share_stopped'; call_id: number; from_user: string };

export type CallsWsOutgoing =
  | { type: 'webrtc_offer'; target: string; call_id?: number; sdp: RTCSessionDescriptionInit }
  | { type: 'webrtc_answer'; target: string; call_id?: number; sdp: RTCSessionDescriptionInit }
  | { type: 'ice_candidate'; target: string; candidate: RTCIceCandidateInit }
  | { type: 'end_call'; target: string }
  | { type: 'join_group_call'; call_id: number }
  | { type: 'leave_group_call'; call_id: number }
  | { type: 'screen_share_started'; call_id: number }
  | { type: 'screen_share_stopped'; call_id: number };

interface UseCallsWebSocketOptions {
  enabled: boolean;
  currentUsername: string;
  onIncomingCall?: (data: { call_id: number; sender: string; receiver: string; call_type: 'audio' | 'video' }) => void;
  onCallAccepted?: (data: { from_user: string }) => void;
  onCallEnded?: (data: { from_user: string }) => void;
  onWebRtcOffer?: (data: { sdp: RTCSessionDescriptionInit; from_user: string; call_id?: number }) => void;
  onWebRtcAnswer?: (data: { sdp: RTCSessionDescriptionInit; from_user: string; call_id?: number }) => void;
  onIceCandidate?: (data: { candidate: RTCIceCandidateInit; from_user: string }) => void;
  onIncomingGroupCall?: (data: { call_id: number; creator: string; call_type: 'audio' | 'video'; participant_usernames: string[] }) => void;
  onParticipantJoined?: (data: { call_id: number; username: string; participant_usernames: string[] }) => void;
  onParticipantLeft?: (data: { call_id: number; username: string }) => void;
  onGroupCallEnded?: (data: { call_id: number; reason?: string }) => void;
  onScreenShareStarted?: (data: { call_id: number; from_user: string }) => void;
  onScreenShareStopped?: (data: { call_id: number; from_user: string }) => void;
}

export function useCallsWebSocket(options: UseCallsWebSocketOptions) {
  const {
    enabled,
    currentUsername,
    onIncomingCall,
    onCallAccepted,
    onCallEnded,
    onWebRtcOffer,
    onWebRtcAnswer,
    onIceCandidate,
    onIncomingGroupCall,
    onParticipantJoined,
    onParticipantLeft,
    onGroupCallEnded,
    onScreenShareStarted,
    onScreenShareStopped,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacksRef = useRef({
    onIncomingCall, onCallAccepted, onCallEnded, onWebRtcOffer, onWebRtcAnswer, onIceCandidate,
    onIncomingGroupCall, onParticipantJoined, onParticipantLeft, onGroupCallEnded,
    onScreenShareStarted, onScreenShareStopped,
  });
  callbacksRef.current = {
    onIncomingCall, onCallAccepted, onCallEnded, onWebRtcOffer, onWebRtcAnswer, onIceCandidate,
    onIncomingGroupCall, onParticipantJoined, onParticipantLeft, onGroupCallEnded,
    onScreenShareStarted, onScreenShareStopped,
  };

  const send = useCallback((msg: CallsWsOutgoing) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const connect = () => {
      const url = getCallsWebSocketUrl();
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[Calls WS] Connected');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as CallsWsMessage;
          console.log('[Calls WS] Message received:', data.type, data);
          const cbs = callbacksRef.current;

          switch (data.type) {
            case 'incoming_call':
              cbs.onIncomingCall?.({
                call_id: data.call_id,
                sender: data.sender,
                receiver: data.receiver,
                call_type: data.call_type,
              });
              break;
            case 'call_accepted':
              cbs.onCallAccepted?.({ from_user: data.from_user });
              break;
            case 'call_ended':
            case 'call_declined':
            case 'end_call':
              cbs.onCallEnded?.({ from_user: data.from_user ?? (data as any).sender });
              break;
            case 'webrtc_offer':
              cbs.onWebRtcOffer?.({ sdp: data.sdp, from_user: data.from_user ?? (data as any).sender, call_id: data.call_id });
              break;
            case 'webrtc_answer':
              cbs.onWebRtcAnswer?.({ sdp: data.sdp, from_user: data.from_user ?? (data as any).sender, call_id: data.call_id });
              break;
            case 'ice_candidate':
              cbs.onIceCandidate?.({ candidate: data.candidate, from_user: data.from_user ?? (data as any).sender });
              break;
            case 'incoming_group_call':
              cbs.onIncomingGroupCall?.({
                call_id: data.call_id,
                creator: data.creator,
                call_type: data.call_type,
                participant_usernames: data.participant_usernames ?? [],
              });
              break;
            case 'participant_joined':
              cbs.onParticipantJoined?.({
                call_id: data.call_id,
                username: data.username,
                participant_usernames: data.participant_usernames ?? [],
              });
              break;
            case 'participant_left':
              cbs.onParticipantLeft?.({ call_id: data.call_id, username: data.username });
              break;
            case 'group_call_ended':
              cbs.onGroupCallEnded?.({ call_id: data.call_id, reason: data.reason });
              break;
            case 'screen_share_started':
              cbs.onScreenShareStarted?.({ call_id: data.call_id, from_user: data.from_user });
              break;
            case 'screen_share_stopped':
              cbs.onScreenShareStopped?.({ call_id: data.call_id, from_user: data.from_user });
              break;
            case 'webrtc_signal':
              if (data.sdp && (data.sdp as RTCSessionDescriptionInit).type === 'offer') {
                cbs.onWebRtcOffer?.({ sdp: data.sdp as RTCSessionDescriptionInit, from_user: data.from_user, call_id: data.call_id });
              } else if (data.sdp && (data.sdp as RTCSessionDescriptionInit).type === 'answer') {
                cbs.onWebRtcAnswer?.({ sdp: data.sdp as RTCSessionDescriptionInit, from_user: data.from_user, call_id: data.call_id });
              } else if (data.candidate) {
                cbs.onIceCandidate?.({ candidate: data.candidate as RTCIceCandidateInit, from_user: data.from_user });
              }
              break;
            default:
              break;
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        console.warn('[Calls WS] Error');
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

  return { send, isConnected };
}
