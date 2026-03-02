import { useEffect, useRef, useState, useCallback } from 'react';
import { getLocalAudioStream, getLocalVideoStream, getDisplayMediaStream, applyVideoSenderBitrate } from '../utils/callMedia';
import type { CallsWsOutgoing } from './useCallsWebSocket';

type CallsWsSend = (msg: CallsWsOutgoing) => void;

interface UseGroupWebRTCOptions {
  enabled: boolean;
  callId: number;
  callType: 'audio' | 'video';
  currentUsername: string;
  participants: string[];
  send: CallsWsSend;
  calleeStreamRef?: { current: MediaStream | null };
}

export function useGroupWebRTC(options: UseGroupWebRTCOptions) {
  const {
    enabled,
    callId,
    callType,
    currentUsername,
    participants,
    send,
    calleeStreamRef,
  } = options;

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localDisplayStream, setLocalDisplayStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isSharingScreen, setIsSharingScreen] = useState(false);

  const pcMapRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const hasCreatedOfferRef = useRef<Set<string>>(new Set());
  const hasCreatedAnswerRef = useRef<Set<string>>(new Set());

  const config: RTCConfiguration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };

  const cleanup = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    pcMapRef.current.forEach((pc) => pc.close());
    pcMapRef.current.clear();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLocalStream(null);
    setLocalDisplayStream(null);
    setRemoteStreams(new Map());
    setIsSharingScreen(false);
    pendingIceRef.current.clear();
    hasCreatedOfferRef.current.clear();
    hasCreatedAnswerRef.current.clear();
  }, []);

  const getOrCreateStream = useCallback(async (): Promise<MediaStream | null> => {
    if (streamRef.current) return streamRef.current;
    const stream = calleeStreamRef?.current ?? (callType === 'video' ? await getLocalVideoStream() : await getLocalAudioStream());
    if (stream) {
      streamRef.current = stream;
      setLocalStream(stream);
      setLocalDisplayStream(stream);
    }
    return stream;
  }, [callType, calleeStreamRef]);

  const addPeer = useCallback(
    async (username: string) => {
      if (username === currentUsername) return;
      if (pcMapRef.current.has(username)) return;

      const stream = await getOrCreateStream();
      if (!stream) {
        console.error('[GroupWebRTC] No local stream for peer', username);
        return;
      }

      const pc = new RTCPeerConnection(config);
      pcMapRef.current.set(username, pc);

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (e) => {
        if (e.streams[0]) {
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.set(username, e.streams[0]);
            return next;
          });
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          send({ type: 'ice_candidate', target: username, candidate: e.candidate.toJSON() });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'closed' || pc.connectionState === 'failed') {
          pcMapRef.current.delete(username);
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.delete(username);
            return next;
          });
        }
      };

      pendingIceRef.current.set(username, []);

      return pc;
    },
    [currentUsername, getOrCreateStream, send]
  );

  const createOfferForPeer = useCallback(
    async (username: string) => {
      let pc = pcMapRef.current.get(username);
      if (!pc) {
        pc = (await addPeer(username)) ?? undefined;
      }
      if (!pc || hasCreatedOfferRef.current.has(username)) return;
      try {
        hasCreatedOfferRef.current.add(username);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (callType === 'video') await applyVideoSenderBitrate(pc);
        send({ type: 'webrtc_offer', target: username, call_id: callId, sdp: offer });
      } catch (err) {
        console.error('[GroupWebRTC] Create offer failed for', username, err);
        hasCreatedOfferRef.current.delete(username);
      }
    },
    [addPeer, callId, send]
  );

  const handleOffer = useCallback(
    async (data: { sdp: RTCSessionDescriptionInit; from_user?: string; sender?: string }) => {
      const fromUser = data.from_user ?? data.sender;
      if (!fromUser || fromUser === currentUsername) return;
      if (hasCreatedAnswerRef.current.has(fromUser)) return;

      let pc = pcMapRef.current.get(fromUser);
      if (!pc) {
        pc = (await addPeer(fromUser)) ?? undefined;
      }
      if (!pc) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const pending = pendingIceRef.current.get(fromUser) ?? [];
        for (const c of pending) {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        }
        pendingIceRef.current.set(fromUser, []);
        hasCreatedAnswerRef.current.add(fromUser);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (callType === 'video') await applyVideoSenderBitrate(pc);
        send({ type: 'webrtc_answer', target: fromUser, call_id: callId, sdp: answer });
      } catch (err) {
        console.error('[GroupWebRTC] Handle offer failed from', fromUser, err);
      }
    },
    [addPeer, callId, currentUsername, send]
  );

  const handleAnswer = useCallback(
    async (data: { sdp: RTCSessionDescriptionInit; from_user?: string; sender?: string }) => {
      const fromUser = data.from_user ?? data.sender;
      if (!fromUser) return;
      const pc = pcMapRef.current.get(fromUser);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const pending = pendingIceRef.current.get(fromUser) ?? [];
        for (const c of pending) {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        }
        pendingIceRef.current.set(fromUser, []);
      } catch (err) {
        console.error('[GroupWebRTC] Handle answer failed from', fromUser, err);
      }
    },
    []
  );

  const handleIceCandidate = useCallback(
    async (data: { candidate: RTCIceCandidateInit; from_user?: string; sender?: string }) => {
      const fromUser = data.from_user ?? data.sender;
      if (!data.candidate || !fromUser) return;
      const pc = pcMapRef.current.get(fromUser);
      if (!pc) {
        const pending = pendingIceRef.current.get(fromUser) ?? [];
        pending.push(data.candidate);
        pendingIceRef.current.set(fromUser, pending);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error('[GroupWebRTC] Add ICE candidate failed from', fromUser, err);
      }
    },
    []
  );

  const removePeer = useCallback((username: string) => {
    const pc = pcMapRef.current.get(username);
    if (pc) {
      pc.close();
      pcMapRef.current.delete(username);
    }
    pendingIceRef.current.delete(username);
    hasCreatedOfferRef.current.delete(username);
    hasCreatedAnswerRef.current.delete(username);
    setRemoteStreams((prev) => {
      const next = new Map(prev);
      next.delete(username);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!enabled || !callId) return;
    getOrCreateStream();
  }, [enabled, callId, getOrCreateStream]);

  const startScreenShare = useCallback(async (): Promise<boolean> => {
    if (callType !== 'video') return false;
    const stream = streamRef.current;
    if (!stream) return false;
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
    for (const pc of pcMapRef.current.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(screenTrack);
        await applyVideoSenderBitrate(pc);
      }
    }
    const displayStream = new MediaStream([...stream.getAudioTracks(), screenTrack]);
    setLocalDisplayStream(displayStream);
    setIsSharingScreen(true);
    return true;
  }, [callType]);

  const stopScreenShare = useCallback(() => {
    const stream = streamRef.current;
    const cameraTrack = stream?.getVideoTracks()[0];
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    if (cameraTrack) {
      for (const pc of pcMapRef.current.values()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(cameraTrack);
          applyVideoSenderBitrate(pc);
        }
      }
    }
    setLocalDisplayStream(stream ?? null);
    setIsSharingScreen(false);
  }, []);

  return {
    localStream: localDisplayStream ?? localStream,
    remoteStreams,
    isSharingScreen,
    startScreenShare,
    stopScreenShare,
    addPeer,
    removePeer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    createOfferForPeer,
    cleanup,
  };
}
