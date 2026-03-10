import React, { useRef, useEffect, useState } from 'react';
import { PhoneOff, PhoneIncoming, Users, Mic, MicOff, Monitor, MonitorOff, Video, VideoOff } from 'lucide-react';
import { useCallRingtone } from '../../hooks/useCallRingtone';

export type GroupCallStatus = 'incoming' | 'active';

export interface GroupCallParticipant {
  username: string;
  name?: string;
  avatar?: string;
  stream?: MediaStream | null;
  isLocal?: boolean;
}

interface GroupVideoCallProps {
  participants: GroupCallParticipant[];
  localStream?: MediaStream | null;
  localUserName?: string;
  localUserAvatar?: string;
  status: GroupCallStatus;
  creatorName?: string;
  isCreator?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onLeave?: () => void;
  onEndCall?: () => void;
  onShareScreen?: () => Promise<boolean>;
  onStopShareScreen?: () => void;
  isSharingScreen?: boolean;
  /** Who is sharing screen (from WebSocket screen_shared.shared_by_name). When set, shared screen gets 80% layout. */
  screenSharedBy?: string | null;
  isEndingCall?: boolean;
}

export const GroupVideoCall: React.FC<GroupVideoCallProps> = ({
  participants,
  localStream,
  localUserName = 'You',
  localUserAvatar,
  status,
  creatorName,
  isCreator,
  onAccept,
  onDecline,
  onLeave,
  onEndCall,
  onShareScreen,
  onStopShareScreen,
  isSharingScreen = false,
  screenSharedBy = null,
  isEndingCall = false,
}) => {
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const sharedVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  useCallRingtone(
    status === 'incoming' ? 'incoming' : 'none',
    'Incoming Group Video Call',
    creatorName ? `${creatorName} is inviting you to a group video call` : 'You have an incoming group video call',
  );

  const toggleMute = () => {
    localStream?.getAudioTracks().forEach((t) => { t.enabled = isMuted; });
    setIsMuted((m) => !m);
  };

  const toggleCamera = () => {
    localStream?.getVideoTracks().forEach((t) => { t.enabled = isCameraOff; });
    setIsCameraOff((c) => !c);
  };

  const remoteParticipants = participants.filter((p) => !p.isLocal);
  const gridCount = Math.max(1, remoteParticipants.length + 1);
  const gridCols = Math.ceil(Math.sqrt(gridCount));
  const gridRows = Math.ceil(gridCount / gridCols);

  // When someone shares: show shared screen at 80%, others in 20% row
  const whoIsSharing = screenSharedBy ?? (isSharingScreen ? localUserName : null);
  const sharedStream = whoIsSharing
    ? (whoIsSharing === localUserName ? localStream : remoteParticipants.find((p) => (p.name || p.username) === whoIsSharing)?.stream)
    : null;

  useEffect(() => {
    if (sharedVideoRef.current && sharedStream) {
      sharedVideoRef.current.srcObject = sharedStream;
    }
  }, [sharedStream]);

  useEffect(() => {
    if (isCameraOff) return;
    videoRefs.current.forEach((el, key) => {
      if (!el) return;
      const p = participants.find((x) => (x.isLocal ? 'local' : x.username) === key);
      const stream = key === 'local' ? localStream : p?.stream;
      if (stream) el.srcObject = stream;
    });
  }, [participants, localStream, isCameraOff]);

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col bg-slate-900 text-white min-h-0">
      <div className="flex-1 min-h-0 p-4 overflow-auto flex flex-col">
        {status === 'incoming' ? (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="w-24 h-24 rounded-full bg-brand-500/30 flex items-center justify-center">
              <Users size={48} />
            </div>
            <h2 className="text-2xl font-bold">Incoming group video call</h2>
            <p className="text-slate-400">
              {creatorName ? `${creatorName} is inviting you` : 'You are invited to a group call'}
            </p>
            <div className="flex gap-4 mt-4">
              <button
                onClick={onDecline}
                className="flex flex-col items-center gap-2 px-6 py-3 rounded-full bg-red-600 hover:bg-red-500 transition-colors"
              >
                <PhoneOff size={24} />
                <span className="text-xs font-medium">Decline</span>
              </button>
              <button
                onClick={onAccept}
                className="flex flex-col items-center gap-2 px-6 py-3 rounded-full bg-green-600 hover:bg-green-500 transition-colors"
              >
                <PhoneIncoming size={24} />
                <span className="text-xs font-medium">Accept</span>
              </button>
            </div>
          </div>
        ) : whoIsSharing && sharedStream ? (
          /* Screen share layout: 80% shared, 20% thumbnails */
          <div className="flex flex-col h-full w-full gap-2 min-h-0 bg-slate-900">
            <div className="w-full flex-1 min-h-0">
              <div className="w-full h-full relative rounded-lg overflow-hidden bg-slate-800 border-2 border-amber-500/50">
                <video
                  ref={(el) => { sharedVideoRef.current = el; if (el && sharedStream) el.srcObject = sharedStream; }}
                  autoPlay
                  playsInline
                  muted={whoIsSharing === localUserName}
                  className="w-full h-full object-contain bg-slate-800"
                />
                <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 rounded text-xs">
                  {whoIsSharing} (sharing)
                </span>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0 overflow-x-auto py-2 min-h-[80px]">
              {localStream && (
                <div className="relative rounded overflow-hidden bg-slate-800 border border-white/20 flex-shrink-0 w-32 min-w-[8rem] h-full min-h-[60px]">
                  {isCameraOff ? (
                    <div className="w-full h-full flex items-center justify-center bg-slate-700">
                      <span className="text-lg font-bold text-brand-300">{localUserName.charAt(0).toUpperCase()}</span>
                    </div>
                  ) : (
                    <video ref={(el) => { if (el) videoRefs.current.set('local', el); el && (el.srcObject = localStream); }} autoPlay playsInline muted className="w-full h-full object-cover bg-slate-800" />
                  )}
                  <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px]">You</span>
                </div>
              )}
              {remoteParticipants.map((p) => (
                <div key={p.username} className="relative rounded overflow-hidden bg-slate-800 border border-white/20 flex-shrink-0 w-32 min-w-[8rem] h-full min-h-[60px]">
                  {p.stream ? (
                    <video ref={(el) => { if (el) videoRefs.current.set(p.username, el); el && (el.srcObject = p.stream!); }} autoPlay playsInline muted={false} className="w-full h-full object-cover bg-slate-800" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-700">
                      <span className="text-lg font-bold text-brand-300">{(p.name || p.username).charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] truncate max-w-[85%]">{p.name || p.username}</span>
                </div>
              ))}
            </div>
          </div>
        ) : !localStream && remoteParticipants.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 flex-1 min-h-[200px] bg-slate-900">
            <div className="w-16 h-16 rounded-full border-2 border-brand-500/50 border-t-brand-500 animate-spin" />
            <p className="text-slate-400 text-sm">Connecting...</p>
          </div>
        ) : (
          <div
            className="grid gap-2 min-h-[200px] w-full flex-1 min-w-0 bg-slate-900 items-start"
            style={{
              gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${gridRows}, minmax(0, auto))`,
            }}
          >
            {localStream && (
              <div className="relative rounded-lg overflow-hidden bg-slate-800 border border-white/20 aspect-video min-w-0">
                {isCameraOff ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-700">
                    {localUserAvatar ? (
                      <img src={localUserAvatar} alt={localUserName} className="w-16 h-16 rounded-full object-cover" />
                    ) : (
                      <span className="text-3xl font-bold text-brand-300">
                        {localUserName.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="text-xs mt-1 text-slate-400">Camera off</span>
                  </div>
                ) : (
                  <video
                    ref={(el) => {
                      if (el) videoRefs.current.set('local', el);
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover bg-slate-800"
                  />
                )}
                <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 rounded text-xs">You</span>
              </div>
            )}
            {remoteParticipants.map((p) => (
              <div key={p.username} className="relative rounded-lg overflow-hidden bg-slate-800 border border-white/20 aspect-video min-w-0">
                {p.stream ? (
                  <video
                    ref={(el) => {
                      if (el) videoRefs.current.set(p.username, el);
                    }}
                    autoPlay
                    playsInline
                    muted={false}
                    className="w-full h-full object-cover bg-slate-800"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-700">
                    {p.avatar ? (
                      <img src={p.avatar} alt={p.name || p.username} className="w-16 h-16 rounded-full object-cover" />
                    ) : (
                      <span className="text-3xl font-bold text-brand-300">
                        {(p.name || p.username).charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                )}
                <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 rounded text-xs truncate max-w-[80%]">
                  {p.name || p.username}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {status === 'active' && (
        <div className="p-4 bg-slate-900/95 flex justify-center gap-4">
          {localStream && (
            <>
              <button
                onClick={toggleMute}
                className={`flex flex-col items-center gap-2 px-6 py-3 rounded-full transition-colors ${isMuted ? 'bg-slate-600 hover:bg-slate-500' : 'bg-slate-700 hover:bg-slate-600'}`}
                title={isMuted ? 'Unmute' : 'Mute'}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                <span className="text-xs font-medium">{isMuted ? 'Unmute' : 'Mute'}</span>
              </button>
              {!isSharingScreen && localStream.getVideoTracks().length > 0 && (
                <button
                  onClick={toggleCamera}
                  className={`flex flex-col items-center gap-2 px-6 py-3 rounded-full transition-colors ${isCameraOff ? 'bg-slate-600 hover:bg-slate-500' : 'bg-slate-700 hover:bg-slate-600'}`}
                  title={isCameraOff ? 'Start camera' : 'Stop camera'}
                  aria-label={isCameraOff ? 'Start camera' : 'Stop camera'}
                >
                  {isCameraOff ? <VideoOff size={24} /> : <Video size={24} />}
                  <span className="text-xs font-medium">{isCameraOff ? 'Start camera' : 'Stop camera'}</span>
                </button>
              )}
            </>
          )}
          {onShareScreen && onStopShareScreen && (
            <button
              onClick={isSharingScreen ? onStopShareScreen : () => onShareScreen()}
              className={`flex flex-col items-center gap-2 px-6 py-3 rounded-full transition-colors ${isSharingScreen ? 'bg-amber-600 hover:bg-amber-500' : 'bg-slate-700 hover:bg-slate-600'}`}
              title={isSharingScreen ? 'Stop sharing' : 'Share screen'}
              aria-label={isSharingScreen ? 'Stop sharing' : 'Share screen'}
            >
              {isSharingScreen ? <MonitorOff size={24} /> : <Monitor size={24} />}
              <span className="text-xs font-medium">{isSharingScreen ? 'Stop share' : 'Share screen'}</span>
            </button>
          )}
          {isCreator ? (
            <button
              onClick={onEndCall}
              disabled={isEndingCall}
              className="flex flex-col items-center gap-2 px-6 py-3 rounded-full bg-red-600 hover:bg-red-500 transition-colors disabled:opacity-70"
            >
              <PhoneOff size={24} />
              <span className="text-xs font-medium">{isEndingCall ? 'Ending...' : 'End call for everyone'}</span>
            </button>
          ) : null}
          <button
            onClick={onLeave}
            disabled={isEndingCall}
            className="flex flex-col items-center gap-2 px-6 py-3 rounded-full bg-slate-600 hover:bg-slate-500 transition-colors disabled:opacity-70"
          >
            <PhoneOff size={24} />
            <span className="text-xs font-medium">{isEndingCall ? 'Leaving...' : 'Leave'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
