import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { User } from '../types';
import { useCallsWebSocket } from '../hooks/useCallsWebSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import { useGroupWebRTC } from '../hooks/useGroupWebRTC';
import { AudioCall } from '../components/calls/AudioCall';
import { VideoCall } from '../components/calls/VideoCall';
import { GroupAudioCall } from '../components/calls/GroupAudioCall';
import { GroupVideoCall } from '../components/calls/GroupVideoCall';
import {
  acceptCall as apiAcceptCall,
  declineCall as apiDeclineCall,
  endCall as apiEndCall,
  getPendingCalls as apiGetPendingCalls,
  joinGroupCall as apiJoinGroupCall,
  leaveGroupCall as apiLeaveGroupCall,
  endGroupCall as apiEndGroupCall,
} from '../services/api';
import { requestAndGetCallMediaStream } from '../utils/callMedia';

export type ActiveCall = {
  type: 'audio' | 'video';
  status: 'outgoing' | 'incoming' | 'active';
  role?: 'caller' | 'callee';
  target: { name: string; id: string; avatar?: string };
  callId?: string | number;
};

export type ActiveGroupCall = {
  type: 'audio' | 'video';
  status: 'incoming' | 'active';
  callId: number;
  creator: string;
  participants: string[];
  isCreator: boolean;
};

interface CallContextValue {
  activeCall: ActiveCall | null;
  setActiveCall: React.Dispatch<React.SetStateAction<ActiveCall | null>>;
  activeGroupCall: ActiveGroupCall | null;
  setActiveGroupCall: React.Dispatch<React.SetStateAction<ActiveGroupCall | null>>;
  wsSend: (msg: any) => void;
  wsConnected: boolean;
  startOutgoingCall: (target: { name: string; id: string; avatar?: string }, type: 'audio' | 'video', callId: string | number) => void;
  startOutgoingGroupCall: (type: 'audio' | 'video', callId: number, creator: string, participants: string[]) => void;
}

const CallContext = createContext<CallContextValue | null>(null);

export function useCallContext(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCallContext must be used within CallProvider');
  return ctx;
}

interface CallProviderProps {
  currentUser: User | null;
  users: User[];
  children: React.ReactNode;
}

export function CallProvider({ currentUser, users, children }: CallProviderProps) {
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [activeGroupCall, setActiveGroupCall] = useState<ActiveGroupCall | null>(null);
  const [screenSharedBy, setScreenSharedBy] = useState<string | null>(null); // who is sharing (username) - from WebSocket
  const [isEndingCall, setIsEndingCall] = useState(false);
  const [isEndingGroupCall, setIsEndingGroupCall] = useState(false);
  const activeCallRef = useRef(activeCall);
  const activeGroupCallRef = useRef(activeGroupCall);
  const calleeStreamRef = useRef<MediaStream | null>(null);
  const groupCalleeStreamRef = useRef<MediaStream | null>(null);

  activeCallRef.current = activeCall;
  activeGroupCallRef.current = activeGroupCall;

  const webrtcHandlersRef = useRef<{
    handleOffer: (d: any) => void;
    handleAnswer: (d: any) => void;
    handleIceCandidate: (d: any) => void;
  } | null>(null);
  const pendingOfferRef = useRef<any>(null);
  const groupWebRtcHandlersRef = useRef<{
    handleOffer: (d: any) => void;
    handleAnswer: (d: any) => void;
    handleIceCandidate: (d: any) => void;
    createOfferForPeer: (username: string) => Promise<void>;
    removePeer: (username: string) => void;
    cleanup: () => void;
  } | null>(null);

  const { send: wsSend, isConnected: wsConnected } = useCallsWebSocket({
    enabled: !!currentUser?.id,
    currentUsername: currentUser?.name || currentUser?.id || '',
    onIncomingCall: (data) => {
      if (activeGroupCallRef.current) return;
      const u = users.find((x: User) => x.name === data.sender || x.id === data.sender);
      setActiveCall({
        type: data.call_type,
        status: 'incoming',
        role: 'callee',
        target: { name: u?.name || data.sender, id: data.sender, avatar: u?.avatar },
        callId: data.call_id,
      });
    },
    onCallAccepted: () => {
      setActiveCall((prev) => (prev ? { ...prev, status: 'active' as const } : null));
    },
    onCallEnded: () => setActiveCall(null),
    onWebRtcOffer: (d) => {
      if (activeGroupCallRef.current) {
        groupWebRtcHandlersRef.current?.handleOffer(d);
      } else {
        const handler = webrtcHandlersRef.current?.handleOffer;
        if (handler) handler(d);
        else pendingOfferRef.current = d;
      }
    },
    onWebRtcAnswer: (d) => {
      if (activeGroupCallRef.current) groupWebRtcHandlersRef.current?.handleAnswer(d);
      else webrtcHandlersRef.current?.handleAnswer(d);
    },
    onIceCandidate: (d) => {
      if (activeGroupCallRef.current) groupWebRtcHandlersRef.current?.handleIceCandidate(d);
      else webrtcHandlersRef.current?.handleIceCandidate(d);
    },
    onIncomingGroupCall: (data) => {
      if (activeCallRef.current) return;
      setActiveGroupCall({
        type: data.call_type,
        status: 'incoming',
        callId: data.call_id,
        creator: data.creator,
        participants: data.participant_usernames ?? [],
        isCreator: false,
      });
    },
    onParticipantJoined: (data) => {
      if (activeGroupCallRef.current?.callId !== data.call_id) return;
      setActiveGroupCall((prev) => {
        if (!prev || prev.callId !== data.call_id) return prev;
        const next = new Set(prev.participants);
        if (!next.has(data.username)) next.add(data.username);
        return { ...prev, participants: Array.from(next) };
      });
      groupWebRtcHandlersRef.current?.createOfferForPeer?.(data.username);
    },
    onParticipantLeft: (data) => {
      if (activeGroupCallRef.current?.callId !== data.call_id) return;
      setActiveGroupCall((prev) => {
        if (!prev || prev.callId !== data.call_id) return prev;
        return { ...prev, participants: prev.participants.filter((p) => p !== data.username) };
      });
      groupWebRtcHandlersRef.current?.removePeer?.(data.username);
    },
    onGroupCallEnded: (data) => {
      if (activeGroupCallRef.current?.callId === data.call_id) {
        setActiveGroupCall(null);
        setScreenSharedBy(null);
        groupWebRtcHandlersRef.current?.cleanup?.();
        groupCalleeStreamRef.current?.getTracks().forEach((t) => t.stop());
        groupCalleeStreamRef.current = null;
      }
    },
    onScreenShared: (data) => {
      if (data.group_call_id != null && activeGroupCallRef.current?.callId === data.group_call_id) {
        setScreenSharedBy(data.is_screen_shared ? data.shared_by_name : null);
      }
    },
  });

  const webrtc = useWebRTC({
    enabled: !!activeCall && !!wsSend && !activeGroupCall,
    callType: activeCall?.type ?? 'audio',
    targetUserId: activeCall?.target?.id ?? '',
    callId: activeCall?.callId,
    isCaller: activeCall?.role === 'caller',
    isActive: activeCall?.status === 'active',
    send: wsSend,
    calleeStreamRef,
    onPeerDisconnected: () => setActiveCall(null),
  });

  const groupWebRtc = useGroupWebRTC({
    enabled: !!activeGroupCall && activeGroupCall.status === 'active' && !!wsSend,
    callId: activeGroupCall?.callId ?? 0,
    callType: activeGroupCall?.type ?? 'audio',
    currentUsername: currentUser?.name || currentUser?.id || '',
    participants: activeGroupCall?.participants ?? [],
    send: wsSend,
    calleeStreamRef: groupCalleeStreamRef,
  });

  useEffect(() => {
    groupWebRtcHandlersRef.current = {
      handleOffer: groupWebRtc.handleOffer,
      handleAnswer: groupWebRtc.handleAnswer,
      handleIceCandidate: groupWebRtc.handleIceCandidate,
      createOfferForPeer: groupWebRtc.createOfferForPeer,
      removePeer: groupWebRtc.removePeer,
      cleanup: groupWebRtc.cleanup,
    };
  }, [groupWebRtc.handleOffer, groupWebRtc.handleAnswer, groupWebRtc.handleIceCandidate, groupWebRtc.createOfferForPeer, groupWebRtc.removePeer, groupWebRtc.cleanup]);

  useEffect(() => {
    webrtcHandlersRef.current = {
      handleOffer: webrtc.handleOffer,
      handleAnswer: webrtc.handleAnswer,
      handleIceCandidate: webrtc.handleIceCandidate,
    };
    const pending = pendingOfferRef.current;
    if (pending && activeCall) {
      pendingOfferRef.current = null;
      webrtc.handleOffer(pending);
    }
  }, [webrtc.handleOffer, webrtc.handleAnswer, webrtc.handleIceCandidate, activeCall]);

  useEffect(() => {
    if (!activeCall) {
      webrtc.cleanup();
      calleeStreamRef.current?.getTracks().forEach((t) => t.stop());
      calleeStreamRef.current = null;
    }
  }, [activeCall, webrtc.cleanup]);

  useEffect(() => {
    if (!activeGroupCall) {
      setScreenSharedBy(null);
      groupWebRtc.cleanup();
      groupCalleeStreamRef.current?.getTracks().forEach((t) => t.stop());
      groupCalleeStreamRef.current = null;
    }
  }, [activeGroupCall, groupWebRtc.cleanup]);

  const startOutgoingCall = useCallback((target: { name: string; id: string; avatar?: string }, type: 'audio' | 'video', callId: string | number) => {
    setActiveCall({
      type,
      status: 'outgoing',
      role: 'caller',
      target,
      callId,
    });
  }, []);

  const startOutgoingGroupCall = useCallback((type: 'audio' | 'video', callId: number, creator: string, participants: string[]) => {
    setActiveGroupCall({
      type,
      status: 'active',
      callId,
      creator,
      participants,
      isCreator: true,
    });
  }, []);

  // Poll pending calls when WebSocket disconnected
  useEffect(() => {
    if (activeCall) return;
    const poll = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const pending = await apiGetPendingCalls();
        if (Array.isArray(pending) && pending.length > 0) {
          const incoming = pending.find((p: any) => p.direction === 'incoming' || p.status === 'incoming' || !p.initiated_by_me);
          if (incoming) {
            const callId = incoming.call_id ?? incoming.id ?? incoming.callId;
            const name = incoming.caller_name ?? incoming.from ?? incoming.name ?? 'Unknown';
            const type = (incoming.call_type ?? incoming.type ?? 'audio') === 'video' ? 'video' : 'audio';
            setActiveCall({ type, status: 'incoming', target: { name, id: incoming.user_id ?? name, avatar: incoming.avatar }, callId });
          }
        }
      } catch {
        /* ignore */
      }
    };
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        poll();
        if (!wsConnected && !intervalId) intervalId = setInterval(poll, 30000);
      } else {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }
    };
    if (document.visibilityState === 'visible') {
      poll();
      if (!wsConnected) intervalId = setInterval(poll, 30000);
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeCall, wsConnected]);

  const value: CallContextValue = {
    activeCall,
    setActiveCall,
    activeGroupCall,
    setActiveGroupCall,
    wsSend,
    wsConnected,
    startOutgoingCall,
    startOutgoingGroupCall,
  };

  const renderOverlays = () => {
    if (!currentUser || typeof document === 'undefined') return null;
    return (
      <>
        {activeCall?.type === 'audio' &&
          createPortal(
            <AudioCall
              targetName={activeCall.target.name}
              targetAvatar={activeCall.target.avatar}
              status={activeCall.status}
              localStream={webrtc.localStream}
              remoteStream={webrtc.remoteStream}
              isEndingCall={isEndingCall}
              onAccept={async () => {
                const callId = activeCall.callId;
                if (callId == null) {
                  setActiveCall(null);
                  return;
                }
                const stream = await requestAndGetCallMediaStream('audio');
                if (!stream) return;
                calleeStreamRef.current = stream;
                try {
                  await apiAcceptCall(callId);
                  setActiveCall((prev) => (prev ? { ...prev, status: 'active' as const } : null));
                } catch {
                  calleeStreamRef.current?.getTracks().forEach((t) => t.stop());
                  calleeStreamRef.current = null;
                  setActiveCall(null);
                }
              }}
              onDecline={async () => {
                if (activeCall.callId != null) await apiDeclineCall(activeCall.callId);
                setActiveCall(null);
              }}
              onEndCall={async () => {
                setIsEndingCall(true);
                try {
                  if (activeCall.callId != null) await apiEndCall(activeCall.callId);
                } finally {
                  setActiveCall(null);
                  setIsEndingCall(false);
                }
              }}
            />,
            document.body
          )}
        {activeCall?.type === 'video' &&
          createPortal(
            <VideoCall
              targetName={activeCall.target.name}
              targetAvatar={activeCall.target.avatar}
              localUserName={currentUser?.name || currentUser?.id || 'You'}
              localUserAvatar={currentUser?.avatar}
              status={activeCall.status}
              localStream={webrtc.localStream}
              remoteStream={webrtc.remoteStream}
              onShareScreen={webrtc.startScreenShare}
              onStopShareScreen={webrtc.stopScreenShare}
              isSharingScreen={webrtc.isSharingScreen}
              isConnecting={webrtc.connectionState === 'connecting'}
              isEndingCall={isEndingCall}
              onAccept={async () => {
                const callId = activeCall.callId;
                if (callId == null) {
                  setActiveCall(null);
                  return;
                }
                const stream = await requestAndGetCallMediaStream('video');
                if (!stream) return;
                calleeStreamRef.current = stream;
                try {
                  await apiAcceptCall(callId);
                  setActiveCall((prev) => (prev ? { ...prev, status: 'active' as const } : null));
                } catch {
                  calleeStreamRef.current?.getTracks().forEach((t) => t.stop());
                  calleeStreamRef.current = null;
                  setActiveCall(null);
                }
              }}
              onDecline={async () => {
                if (activeCall.callId != null) await apiDeclineCall(activeCall.callId);
                setActiveCall(null);
              }}
              onEndCall={async () => {
                setIsEndingCall(true);
                try {
                  if (activeCall.callId != null) await apiEndCall(activeCall.callId);
                } finally {
                  setActiveCall(null);
                  setIsEndingCall(false);
                }
              }}
            />,
            document.body
          )}
        {activeGroupCall?.type === 'audio' &&
          createPortal(
            <GroupAudioCall
              participants={[
                ...(activeGroupCall.participants
                  .filter((p) => p !== (currentUser?.name || currentUser?.id))
                  .map((username) => {
                    const u = users.find((x: User) => x.name === username || x.id === username);
                    return {
                      username,
                      name: u?.name || username,
                      avatar: u?.avatar,
                      stream: groupWebRtc.remoteStreams.get(username) ?? undefined,
                      isLocal: false,
                    };
                  })),
              ]}
              localStream={groupWebRtc.localStream}
              status={activeGroupCall.status}
              creatorName={users.find((x: User) => x.name === activeGroupCall.creator || x.id === activeGroupCall.creator)?.name || activeGroupCall.creator}
              isCreator={activeGroupCall.isCreator}
              onAccept={async () => {
                const stream = await requestAndGetCallMediaStream('audio');
                if (!stream) return;
                groupCalleeStreamRef.current = stream;
                try {
                  const res = await apiJoinGroupCall(activeGroupCall.callId);
                  const participantUsernames = res?.participant_usernames ?? activeGroupCall.participants;
                  wsSend({ type: 'join_group_call', call_id: activeGroupCall.callId });
                  setActiveGroupCall((prev) => (prev ? { ...prev, status: 'active', participants: participantUsernames } : null));
                } catch {
                  groupCalleeStreamRef.current?.getTracks().forEach((t) => t.stop());
                  groupCalleeStreamRef.current = null;
                  setActiveGroupCall(null);
                }
              }}
              onDecline={() => setActiveGroupCall(null)}
              onLeave={async () => {
                setIsEndingGroupCall(true);
                try {
                  await apiLeaveGroupCall(activeGroupCall.callId);
                  wsSend({ type: 'leave_group_call', call_id: activeGroupCall.callId });
                } finally {
                  setActiveGroupCall(null);
                  setIsEndingGroupCall(false);
                }
              }}
              onEndCall={async () => {
                setIsEndingGroupCall(true);
                try {
                  await apiEndGroupCall(activeGroupCall.callId);
                } finally {
                  setActiveGroupCall(null);
                  setIsEndingGroupCall(false);
                }
              }}
              isEndingCall={isEndingGroupCall}
            />,
            document.body
          )}
        {activeGroupCall?.type === 'video' &&
          createPortal(
            <GroupVideoCall
              screenSharedBy={screenSharedBy}
              isSharingScreen={groupWebRtc.isSharingScreen}
              onShareScreen={groupWebRtc.startScreenShare}
              onStopShareScreen={groupWebRtc.stopScreenShare}
              participants={[
                ...(activeGroupCall.participants
                  .filter((p) => p !== (currentUser?.name || currentUser?.id))
                  .map((username) => {
                    const u = users.find((x: User) => x.name === username || x.id === username);
                    return {
                      username,
                      name: u?.name || username,
                      avatar: u?.avatar,
                      stream: groupWebRtc.remoteStreams.get(username) ?? undefined,
                      isLocal: false,
                    };
                  })),
              ]}
              localStream={groupWebRtc.localStream}
              status={activeGroupCall.status}
              creatorName={users.find((x: User) => x.name === activeGroupCall.creator || x.id === activeGroupCall.creator)?.name || activeGroupCall.creator}
              isCreator={activeGroupCall.isCreator}
              onAccept={async () => {
                const stream = await requestAndGetCallMediaStream('video');
                if (!stream) return;
                groupCalleeStreamRef.current = stream;
                try {
                  const res = await apiJoinGroupCall(activeGroupCall.callId);
                  const participantUsernames = res?.participant_usernames ?? activeGroupCall.participants;
                  wsSend({ type: 'join_group_call', call_id: activeGroupCall.callId });
                  setActiveGroupCall((prev) => (prev ? { ...prev, status: 'active', participants: participantUsernames } : null));
                } catch {
                  groupCalleeStreamRef.current?.getTracks().forEach((t) => t.stop());
                  groupCalleeStreamRef.current = null;
                  setActiveGroupCall(null);
                }
              }}
              onDecline={() => setActiveGroupCall(null)}
              onLeave={async () => {
                setIsEndingGroupCall(true);
                try {
                  await apiLeaveGroupCall(activeGroupCall.callId);
                  wsSend({ type: 'leave_group_call', call_id: activeGroupCall.callId });
                } finally {
                  setActiveGroupCall(null);
                  setIsEndingGroupCall(false);
                }
              }}
              onEndCall={async () => {
                setIsEndingGroupCall(true);
                try {
                  await apiEndGroupCall(activeGroupCall.callId);
                } finally {
                  setActiveGroupCall(null);
                  setIsEndingGroupCall(false);
                }
              }}
              isEndingCall={isEndingGroupCall}
            />,
            document.body
          )}
      </>
    );
  };

  return (
    <CallContext.Provider value={value}>
      {children}
      {renderOverlays()}
    </CallContext.Provider>
  );
}
