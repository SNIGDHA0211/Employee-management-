import React, { useRef, useEffect, useState } from 'react';
import { PhoneOff, PhoneIncoming, Mic, MicOff, Monitor, MonitorOff, Video, VideoOff } from 'lucide-react';

export type CallStatus = 'outgoing' | 'incoming' | 'active';

interface VideoCallProps {
  targetName: string;
  targetAvatar?: string;
  localUserName?: string;
  localUserAvatar?: string;
  status: CallStatus;
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  onAccept?: () => void;
  onDecline?: () => void;
  onEndCall?: () => void;
  onShareScreen?: () => Promise<boolean>;
  onStopShareScreen?: () => void;
  isSharingScreen?: boolean;
  isConnecting?: boolean;
  isEndingCall?: boolean;
}

export const VideoCall: React.FC<VideoCallProps> = ({
  targetName,
  targetAvatar,
  localUserName = 'You',
  localUserAvatar,
  status,
  localStream,
  remoteStream,
  onAccept,
  onDecline,
  onEndCall,
  onShareScreen,
  onStopShareScreen,
  isSharingScreen = false,
  isConnecting = false,
  isEndingCall = false,
}) => {
  const localRef = useRef<HTMLVideoElement | null>(null);
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const toggleMute = () => {
    localStream?.getAudioTracks().forEach((t) => { t.enabled = isMuted; });
    setIsMuted((m) => !m);
  };

  const toggleCamera = () => {
    localStream?.getVideoTracks().forEach((t) => { t.enabled = isCameraOff; });
    setIsCameraOff((c) => !c);
  };

  useEffect(() => {
    if (localRef.current && localStream && !isCameraOff) localRef.current.srcObject = localStream;
  }, [localStream, isCameraOff]);
  useEffect(() => {
    if (remoteRef.current && remoteStream) remoteRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col bg-slate-900 text-white">
      {/* Remote video (full screen) */}
      <div className="flex-1 relative bg-slate-800">
        {status === 'active' ? (
          <video
            ref={remoteRef}
            autoPlay
            playsInline
            muted={false}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-brand-500/50 bg-slate-700 flex items-center justify-center">
              {targetAvatar ? (
                <img src={targetAvatar} alt={targetName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-5xl font-bold text-brand-300">
                  {targetName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold mt-4">{targetName}</h2>
            <p className="text-slate-400 mt-2 text-sm">
              {status === 'outgoing' && (isConnecting ? 'Calling...' : 'Ringing...')}
              {status === 'incoming' && 'Incoming video call'}
              {status === 'active' && 'Connected'}
            </p>
          </div>
        )}

        {/* Local video (picture-in-picture) - show when outgoing or active */}
        {(status === 'outgoing' || status === 'active') && (
          <div className="absolute bottom-24 right-4 w-40 h-28 rounded-lg overflow-hidden border-2 border-white/30 shadow-xl bg-slate-800">
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
                ref={localRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            )}
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="p-4 bg-slate-900/95 flex justify-center gap-4">
        {status === 'incoming' && (
          <>
            <button
              onClick={onDecline}
              className="flex flex-col items-center gap-2 px-6 py-3 rounded-full bg-red-600 hover:bg-red-500 transition-colors"
              title="Decline"
            >
              <PhoneOff size={24} />
              <span className="text-xs font-medium">Decline</span>
            </button>
            <button
              onClick={onAccept}
              className="flex flex-col items-center gap-2 px-6 py-3 rounded-full bg-green-600 hover:bg-green-500 transition-colors"
              title="Accept"
            >
              <PhoneIncoming size={24} />
              <span className="text-xs font-medium">Accept</span>
            </button>
          </>
        )}
        {(status === 'outgoing' || status === 'active') && (
          <>
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
            <button
              onClick={onEndCall}
              disabled={isEndingCall}
              className="flex flex-col items-center gap-2 px-6 py-3 rounded-full bg-red-600 hover:bg-red-500 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              title="End call"
              aria-label="End call"
            >
              <PhoneOff size={24} />
              <span className="text-xs font-medium">{isEndingCall ? 'Ending...' : 'End call'}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
