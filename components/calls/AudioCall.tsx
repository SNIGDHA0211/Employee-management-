import React, { useRef, useEffect, useState } from 'react';
import { PhoneOff, PhoneIncoming, Mic, MicOff } from 'lucide-react';

export type CallStatus = 'outgoing' | 'incoming' | 'active';

interface AudioCallProps {
  targetName: string;
  targetAvatar?: string;
  status: CallStatus;
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  onAccept?: () => void;
  onDecline?: () => void;
  onEndCall?: () => void;
  isConnecting?: boolean;
  isEndingCall?: boolean;
}

export const AudioCall: React.FC<AudioCallProps> = ({
  targetName,
  targetAvatar,
  status,
  localStream,
  remoteStream,
  onAccept,
  onDecline,
  onEndCall,
  isConnecting = false,
  isEndingCall = false,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isMuted, setIsMuted] = useState(false);

  const toggleMute = () => {
    localStream?.getAudioTracks().forEach((t) => { t.enabled = isMuted; });
    setIsMuted((m) => !m);
  };
  useEffect(() => {
    if (audioRef.current && remoteStream) {
      audioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);
  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {status === 'active' && remoteStream && (
        <audio ref={audioRef} autoPlay playsInline className="hidden" />
      )}
      <div className="flex flex-col items-center gap-6 p-8">
        {/* Avatar */}
        <div className="relative">
          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-brand-500/50 bg-slate-700 flex items-center justify-center">
            {targetAvatar ? (
              <img src={targetAvatar} alt={targetName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl font-bold text-brand-300">
                {targetName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          {status === 'active' && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 border-2 border-slate-900 animate-pulse" />
          )}
        </div>

        {/* Name & status */}
        <div className="text-center">
          <h2 className="text-xl font-bold">{targetName}</h2>
          <p className="text-slate-400 mt-1 text-sm">
            {status === 'outgoing' && (isConnecting ? 'Calling...' : 'Ringing...')}
            {status === 'incoming' && 'Incoming audio call'}
            {status === 'active' && 'Connected'}
          </p>
        </div>

        {/* Call controls */}
        <div className="flex items-center gap-4 mt-4">
          {status === 'incoming' && (
            <>
              <button
                onClick={onDecline}
                className="flex flex-col items-center gap-2 p-4 rounded-full bg-red-600 hover:bg-red-500 transition-colors"
                title="Decline"
              >
                <PhoneOff size={28} />
                <span className="text-xs font-medium">Decline</span>
              </button>
              <button
                onClick={onAccept}
                className="flex flex-col items-center gap-2 p-4 rounded-full bg-green-600 hover:bg-green-500 transition-colors"
                title="Accept"
              >
                <PhoneIncoming size={28} />
                <span className="text-xs font-medium">Accept</span>
              </button>
            </>
          )}
          {(status === 'outgoing' || status === 'active') && (
            <>
              {localStream && (
                <button
                  onClick={toggleMute}
                  className={`flex flex-col items-center gap-2 p-4 rounded-full transition-colors ${isMuted ? 'bg-slate-600 hover:bg-slate-500' : 'bg-slate-700 hover:bg-slate-600'}`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <MicOff size={28} /> : <Mic size={28} />}
                  <span className="text-xs font-medium">{isMuted ? 'Unmute' : 'Mute'}</span>
                </button>
              )}
              <button
                onClick={onEndCall}
                disabled={isEndingCall}
                className="flex flex-col items-center gap-2 p-4 rounded-full bg-red-600 hover:bg-red-500 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                title="End call"
                aria-label="End call"
              >
                <PhoneOff size={28} />
                <span className="text-xs font-medium">{isEndingCall ? 'Ending...' : 'End call'}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
