import React, { useRef, useEffect, useState, useCallback } from 'react';
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
  /** Username of whoever is currently sharing their screen. null = no one. */
  screenSharingParticipant?: string | null;
  isEndingCall?: boolean;
}

// ─── Avatar placeholder ──────────────────────────────────────────────────────
const AvatarPlaceholder: React.FC<{ name: string; avatar?: string; label?: string; size?: 'sm' | 'md' }> = ({
  name, avatar, label, size = 'md',
}) => {
  const dim = size === 'sm' ? 'w-8 h-8 text-base' : 'w-14 h-14 text-2xl';
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-700 gap-1">
      {avatar ? (
        <img src={avatar} alt={name} className={`${dim} rounded-full object-cover`} />
      ) : (
        <span className={`${dim} rounded-full bg-brand-500/40 flex items-center justify-center font-bold text-brand-200`}>
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      {label && <span className="text-xs text-slate-400 mt-0.5">{label}</span>}
    </div>
  );
};

// ─── Single video tile ───────────────────────────────────────────────────────
interface TileProps {
  id: string;
  stream?: MediaStream | null;
  name: string;
  avatar?: string;
  muted?: boolean;
  isCameraOff?: boolean;
  className?: string;
  videoRefs: React.MutableRefObject<Map<string, HTMLVideoElement>>;
}
const VideoTile: React.FC<TileProps> = ({ id, stream, name, avatar, muted = false, isCameraOff = false, className = '', videoRefs }) => {
  return (
    <div className={`relative rounded-xl overflow-hidden bg-slate-800 border border-white/10 ${className}`}>
      {isCameraOff || !stream ? (
        <AvatarPlaceholder name={name} avatar={avatar} label={isCameraOff ? 'Camera off' : undefined} />
      ) : (
        <video
          ref={(el) => { if (el) videoRefs.current.set(id, el); }}
          autoPlay
          playsInline
          muted={muted}
          className="w-full h-full object-cover"
        />
      )}
      <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 rounded text-xs truncate max-w-[80%] leading-4">
        {name}
      </span>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
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
  screenSharingParticipant = null,
  isEndingCall = false,
}) => {
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
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

  // Attach streams to video elements whenever participants or streams change
  useEffect(() => {
    videoRefs.current.forEach((el, key) => {
      if (!el) return;
      const isLocal = key === 'local';
      if (isLocal) {
        if (!isCameraOff && localStream) el.srcObject = localStream;
        return;
      }
      const p = participants.find((x) => x.username === key);
      if (p?.stream) el.srcObject = p.stream;
    });
  }, [participants, localStream, isCameraOff]);

  const remoteParticipants = participants.filter((p) => !p.isLocal);

  // ── Determine presenter layout ──────────────────────────────────────────
  // Someone is sharing if: local user is sharing OR a remote participant is sharing
  const presenterUsername = isSharingScreen ? 'local' : screenSharingParticipant;
  const isPresenterMode = !!presenterUsername;

  // Tile order for strip: locals first, then remotes — excluding the presenter tile
  const allTiles: Array<{ id: string; name: string; avatar?: string; stream?: MediaStream | null; muted?: boolean }> = [
    { id: 'local', name: localUserName, avatar: localUserAvatar, stream: localStream, muted: true },
    ...remoteParticipants.map((p) => ({
      id: p.username,
      name: p.name || p.username,
      avatar: p.avatar,
      stream: p.stream,
    })),
  ];
  const stripTiles = allTiles.filter((t) => t.id !== presenterUsername);

  // The presenter tile data
  const presenterTile = allTiles.find((t) => t.id === presenterUsername);

  // Grid columns for equal layout (no screen share)
  const gridCount = Math.max(1, allTiles.length);
  const gridCols = gridCount <= 1 ? 1 : gridCount <= 4 ? 2 : 3;

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col bg-slate-900 text-white">

      {/* ── Incoming state ── */}
      {status === 'incoming' ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
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
      ) : isPresenterMode ? (
        /* ── Presenter / screen-share layout ── */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Screen share banner */}
          <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-600/90 text-sm font-medium">
            <Monitor size={15} />
            <span>
              {presenterUsername === 'local'
                ? 'You are sharing your screen'
                : `${presenterTile?.name ?? presenterUsername} is sharing their screen`}
            </span>
          </div>

          {/* Large presenter area */}
          <div className="flex-1 relative bg-black overflow-hidden">
            {presenterTile ? (
              presenterTile.id === 'local' && isCameraOff ? (
                <AvatarPlaceholder name={localUserName} avatar={localUserAvatar} label="Camera off" />
              ) : presenterTile.stream ? (
                <video
                  ref={(el) => { if (el) videoRefs.current.set(presenterTile.id, el); }}
                  autoPlay
                  playsInline
                  muted={presenterTile.muted}
                  className="w-full h-full object-contain"
                />
              ) : (
                <AvatarPlaceholder name={presenterTile.name} avatar={presenterTile.avatar} />
              )
            ) : null}
            <span className="absolute bottom-3 left-3 px-2 py-0.5 bg-black/60 rounded text-xs">
              {presenterTile?.name ?? presenterUsername}
              {presenterUsername === 'local' && ' (You)'}
            </span>
          </div>

          {/* Bottom strip of other participants */}
          {stripTiles.length > 0 && (
            <div className="h-28 flex gap-2 px-3 py-2 bg-slate-800/80 overflow-x-auto">
              {stripTiles.map((t) => (
                <div key={t.id} className="h-full aspect-video flex-shrink-0">
                  <VideoTile
                    id={t.id}
                    stream={t.stream}
                    name={t.name}
                    avatar={t.avatar}
                    muted={t.muted}
                    isCameraOff={t.id === 'local' && isCameraOff}
                    videoRefs={videoRefs}
                    className="h-full"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── Default equal grid layout ── */
        <div
          className="flex-1 p-3 grid gap-2 overflow-hidden"
          style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}
        >
          {allTiles.map((t) => (
            <VideoTile
              key={t.id}
              id={t.id}
              stream={t.stream}
              name={t.id === 'local' ? `${t.name} (You)` : t.name}
              avatar={t.avatar}
              muted={t.muted}
              isCameraOff={t.id === 'local' && isCameraOff}
              videoRefs={videoRefs}
              className="h-full"
            />
          ))}
        </div>
      )}

      {/* ── Controls bar ── */}
      {status === 'active' && (
        <div className="p-4 bg-slate-900/95 flex justify-center gap-3 flex-wrap">
          {localStream && (
            <>
              <button
                onClick={toggleMute}
                className={`flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-full transition-colors ${isMuted ? 'bg-slate-600 hover:bg-slate-500' : 'bg-slate-700 hover:bg-slate-600'}`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                <span className="text-[10px] font-medium">{isMuted ? 'Unmute' : 'Mute'}</span>
              </button>
              {!isSharingScreen && localStream.getVideoTracks().length > 0 && (
                <button
                  onClick={toggleCamera}
                  className={`flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-full transition-colors ${isCameraOff ? 'bg-slate-600 hover:bg-slate-500' : 'bg-slate-700 hover:bg-slate-600'}`}
                  title={isCameraOff ? 'Start camera' : 'Stop camera'}
                >
                  {isCameraOff ? <VideoOff size={22} /> : <Video size={22} />}
                  <span className="text-[10px] font-medium">{isCameraOff ? 'Start camera' : 'Stop camera'}</span>
                </button>
              )}
            </>
          )}
          {onShareScreen && onStopShareScreen && (
            <button
              onClick={isSharingScreen ? onStopShareScreen : () => onShareScreen()}
              className={`flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-full transition-colors ${isSharingScreen ? 'bg-amber-600 hover:bg-amber-500' : 'bg-slate-700 hover:bg-slate-600'}`}
              title={isSharingScreen ? 'Stop sharing' : 'Share screen'}
            >
              {isSharingScreen ? <MonitorOff size={22} /> : <Monitor size={22} />}
              <span className="text-[10px] font-medium">{isSharingScreen ? 'Stop share' : 'Share screen'}</span>
            </button>
          )}
          {isCreator && (
            <button
              onClick={onEndCall}
              disabled={isEndingCall}
              className="flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-full bg-red-600 hover:bg-red-500 transition-colors disabled:opacity-70"
            >
              <PhoneOff size={22} />
              <span className="text-[10px] font-medium">{isEndingCall ? 'Ending…' : 'End for everyone'}</span>
            </button>
          )}
          <button
            onClick={onLeave}
            disabled={isEndingCall}
            className="flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-full bg-slate-600 hover:bg-slate-500 transition-colors disabled:opacity-70"
          >
            <PhoneOff size={22} />
            <span className="text-[10px] font-medium">{isEndingCall ? 'Leaving…' : 'Leave'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
