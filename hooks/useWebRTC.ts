import { useEffect, useRef, useState, useCallback } from 'react';
import { getLocalAudioStream, getLocalVideoStream, getDisplayMediaStream, applyVideoSenderBitrate } from '../utils/callMedia';
import { updateScreenShare } from '../services/api';
import type { CallsWsOutgoing } from './useCallsWebSocket';

interface UseWebRTCOptions {
  enabled: boolean;
  callType: 'audio' | 'video';
  targetUserId: string;
  callId?: string | number;
  isCaller: boolean;
  isActive: boolean; // status === 'active' - caller creates offer when this becomes true
  isOutgoing?: boolean; // caller ringing - get local stream for preview
  send: (msg: CallsWsOutgoing) => void;
  /** Ref with pre-acquired stream from receiver's Accept click - avoids second getUserMedia */
  calleeStreamRef?: { current: MediaStream | null };
  /** Called when peer disconnects (connection closed/failed) - other side ended the call */
  onPeerDisconnected?: () => void;
}

export function useWebRTC(options: UseWebRTCOptions) {
  const {
    enabled,
    callType,
    targetUserId,
    callId,
    isCaller,
    isActive,
    isOutgoing = false,
    send,
    calleeStreamRef,
    onPeerDisconnected,
  } = options;

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localDisplayStream, setLocalDisplayStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [isSharingScreen, setIsSharingScreen] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const hasCreatedOfferRef = useRef(false);
  const hasCreatedAnswerRef = useRef(false);

  const cleanup = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLocalStream(null);
    setLocalDisplayStream(null);
    setRemoteStream(null);
    setConnectionState('closed');
    setIsSharingScreen(false);
    pendingIceRef.current = [];
    hasCreatedOfferRef.current = false;
    hasCreatedAnswerRef.current = false;
  }, []);

  // Create peer connection and local stream - caller gets it immediately; callee gets it when offer arrives (handleOffer)
  useEffect(() => {
    if (!enabled || !targetUserId || !callId) return;
    if (!isCaller) return; // Callee: no setup here; handleOffer will get stream and create PC when offer arrives

    let pc: RTCPeerConnection | null = null;
    let stream: MediaStream | null = null;

    const setup = async () => {
      const getStream = callType === 'video' ? getLocalVideoStream : getLocalAudioStream;
      stream = await getStream();
      if (!stream) {
        console.error('[WebRTC] Failed to get local stream');
        return;
      }
      streamRef.current = stream;
      setLocalStream(stream);
      setLocalDisplayStream(stream);

      const config: RTCConfiguration = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      };
      pc = new RTCPeerConnection(config);
      pcRef.current = pc;

      stream.getTracks().forEach((track) => {
        pc!.addTrack(track, stream!);
      });

      pc.ontrack = (e) => {
        if (e.streams[0]) {
          setRemoteStream(e.streams[0]);
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          send({
            type: 'ice_candidate',
            target: targetUserId,
            candidate: e.candidate.toJSON(),
          });
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc?.connectionState ?? 'closed';
        setConnectionState(state);
        if (state === 'closed' || state === 'failed') {
          onPeerDisconnected?.();
          cleanup();
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc?.iceConnectionState === 'failed') {
          console.warn('[WebRTC] ICE connection failed');
        }
      };

      // Caller: create offer when active
      if (isCaller && isActive && !hasCreatedOfferRef.current) {
        hasCreatedOfferRef.current = true;
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (callType === 'video') await applyVideoSenderBitrate(pc);
          send({
            type: 'webrtc_offer',
            target: targetUserId,
            call_id: Number(callId),
            sdp: offer,
          });
        } catch (err) {
          console.error('[WebRTC] Create offer failed:', err);
        }
      }
    };

    setup();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      pc?.close();
      pcRef.current = null;
    };
  }, [enabled, targetUserId, callId, isCaller, isActive, isOutgoing, callType]);

  const createPeerConnection = useCallback(
    (stream: MediaStream) => {
      const config: RTCConfiguration = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      };
      const pc = new RTCPeerConnection(config);
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      pc.ontrack = (e) => {
        if (e.streams[0]) setRemoteStream(e.streams[0]);
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          send({ type: 'ice_candidate', target: targetUserId, candidate: e.candidate.toJSON() });
        }
      };
      pc.onconnectionstatechange = () => {
        const state = pc?.connectionState ?? 'closed';
        setConnectionState(state);
        if (state === 'closed' || state === 'failed') {
          onPeerDisconnected?.();
          cleanup();
        }
      };
      return pc;
    },
    [targetUserId, send, onPeerDisconnected, cleanup]
  );

  const handleOffer = useCallback(
    async (data: { sdp: RTCSessionDescriptionInit; from_user?: string; sender?: string; call_id?: number }) => {
      const fromUser = data.from_user ?? data.sender;
      console.log('[WebRTC] handleOffer called', { fromUser, targetUserId, enabled, hasAnswer: hasCreatedAnswerRef.current });
      if (!enabled) {
        console.warn('[WebRTC] handleOffer skipped: not enabled');
        return;
      }
      if (!fromUser || (fromUser !== targetUserId && String(fromUser) !== String(targetUserId))) {
        console.warn('[WebRTC] handleOffer skipped: fromUser mismatch', { fromUser, targetUserId });
        return;
      }
      if (hasCreatedAnswerRef.current) return;
      try {
        let pc = pcRef.current;
        let stream = localStream;
        if (!stream && calleeStreamRef?.current) {
          stream = calleeStreamRef.current;
          calleeStreamRef.current = null;
          streamRef.current = stream;
          setLocalStream(stream);
        }
        if (!stream) {
          const getStream = callType === 'video' ? getLocalVideoStream : getLocalAudioStream;
          stream = await getStream();
          if (!stream) {
            console.error('[WebRTC] Failed to get local stream for answer');
            return;
          }
          streamRef.current = stream;
          setLocalStream(stream);
          setLocalDisplayStream(stream);
        }
        if (!pc) {
          pc = createPeerConnection(stream);
        }
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        for (const c of pendingIceRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        }
        pendingIceRef.current = [];
        hasCreatedAnswerRef.current = true;
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (callType === 'video') await applyVideoSenderBitrate(pc);
        send({
          type: 'webrtc_answer',
          target: fromUser,
          call_id: data.call_id ?? Number(callId),
          sdp: answer,
        });
        console.log('[WebRTC] Answer sent successfully');
      } catch (err) {
        console.error('[WebRTC] Handle offer failed:', err);
      }
    },
    [enabled, send, callType, localStream, createPeerConnection, targetUserId, calleeStreamRef, callId]
  );

  const handleAnswer = useCallback(
    async (data: { sdp: RTCSessionDescriptionInit; from_user?: string; sender?: string; call_id: number }) => {
      const fromUser = data.from_user ?? data.sender;
      if (!fromUser || (fromUser !== targetUserId && String(fromUser) !== String(targetUserId))) return;
      if (!pcRef.current) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
        for (const c of pendingIceRef.current) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(c));
        }
        pendingIceRef.current = [];
      } catch (err) {
        console.error('[WebRTC] Handle answer failed:', err);
      }
    },
    [targetUserId]
  );

  const handleIceCandidate = useCallback(
    async (data: { candidate: RTCIceCandidateInit; from_user?: string; sender?: string }) => {
      if (!data.candidate) return;
      const fromUser = data.from_user ?? data.sender;
      if (!fromUser || (fromUser !== targetUserId && String(fromUser) !== String(targetUserId))) return;
      if (!pcRef.current) {
        pendingIceRef.current.push(data.candidate);
        return;
      }
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error('[WebRTC] Add ICE candidate failed:', err);
      }
    },
    [targetUserId]
  );

  const startScreenShare = useCallback(async (): Promise<boolean> => {
    if (callType !== 'video') return false;
    const stream = streamRef.current;
    const pc = pcRef.current;
    if (!stream || !pc) return false;
    const cameraTrack = stream.getVideoTracks()[0];
    if (!cameraTrack) return false;
    const screenStream = await getDisplayMediaStream();
    if (!screenStream) return false;
    const screenTrack = screenStream.getVideoTracks()[0];
    if (!screenTrack) {
      screenStream.getTracks().forEach((t) => t.stop());
      return false;
    }
    screenStreamRef.current = screenStream;
    screenTrack.onended = () => stopScreenShare();
    const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
    if (sender) {
      await sender.replaceTrack(screenTrack);
      await applyVideoSenderBitrate(pc);
    }
    const displayStream = new MediaStream([...stream.getAudioTracks(), screenTrack]);
    setLocalDisplayStream(displayStream);
    setIsSharingScreen(true);
    if (callId != null) {
      updateScreenShare({ callId: Number(callId), isScreenShared: true }).catch(() => {});
    }
    return true;
  }, [callType, callId]);

  const stopScreenShare = useCallback(() => {
    const stream = streamRef.current;
    const pc = pcRef.current;
    const cameraTrack = stream?.getVideoTracks()[0];
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    if (pc && cameraTrack) {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) {
        sender.replaceTrack(cameraTrack);
        applyVideoSenderBitrate(pc);
      }
    }
    setLocalDisplayStream(stream ?? null);
    setIsSharingScreen(false);
    if (callId != null) {
      updateScreenShare({ callId: Number(callId), isScreenShared: false }).catch(() => {});
    }
  }, [callId]);

  return {
    localStream: localDisplayStream ?? localStream,
    remoteStream,
    connectionState,
    isSharingScreen,
    startScreenShare,
    stopScreenShare,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    cleanup,
  };
}
