import React, { useRef, useEffect, useState } from 'react';
import { PhoneOff, PhoneIncoming, Users, Mic, MicOff } from 'lucide-react';

export type GroupCallStatus = 'incoming' | 'active';

export interface GroupCallParticipant {
  username: string;
  name?: string;
  avatar?: string;
  stream?: MediaStream | null;
  isLocal?: boolean;
}

interface GroupAudioCallProps {
  participants: GroupCallParticipant[];
  localStream?: MediaStream | null;
  status: GroupCallStatus;
  creatorName?: string;
  isCreator?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onLeave?: () => void;
  onEndCall?: () => void;
  isEndingCall?: boolean;
}

export const GroupAudioCall: React.FC<GroupAudioCallProps> = ({
  participants,
  localStream,
  status,
  creatorName,
  isCreator,
  onAccept,
  onDecline,
  onLeave,
  onEndCall,
  isEndingCall = false,
}) => {
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const remoteParticipants = participants.filter((p) => !p.isLocal);
  const [isMuted, setIsMuted] = useState(false);

  const toggleMute = () => {
    localStream?.getAudioTracks().forEach((t) => { t.enabled = isMuted; });
    setIsMuted((m) => !m);
  };

  useEffect(() => {
    remoteParticipants.forEach((p) => {
      const el = audioRefs.current.get(p.username);
      if (el && p.stream) el.srcObject = p.stream;
    });
  }, [participants]);

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {remoteParticipants.map((p) =>
        p.stream ? (
          <audio
            key={p.username}
            ref={(el) => {
              if (el) audioRefs.current.set(p.username, el);
            }}
            autoPlay
            playsInline
            className="hidden"
          />
        ) : null
      )}

      <div className="flex flex-col items-center gap-6 p-8">
        <div className="w-20 h-20 rounded-full bg-brand-500/30 flex items-center justify-center">
          <Users size={40} />
        </div>
        {status === 'incoming' ? (
          <>
            <h2 className="text-xl font-bold">Incoming group audio call</h2>
            <p className="text-slate-400">
              {creatorName ? `${creatorName} is inviting you` : 'You are invited to a group call'}
            </p>
            <div className="flex gap-4 mt-4">
              <button
                onClick={onDecline}
                className="flex flex-col items-center gap-2 p-4 rounded-full bg-red-600 hover:bg-red-500 transition-colors"
              >
                <PhoneOff size={28} />
                <span className="text-xs font-medium">Decline</span>
              </button>
              <button
                onClick={onAccept}
                className="flex flex-col items-center gap-2 p-4 rounded-full bg-green-600 hover:bg-green-500 transition-colors"
              >
                <PhoneIncoming size={28} />
                <span className="text-xs font-medium">Accept</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold">Group call</h2>
            <p className="text-slate-400">{remoteParticipants.length + 1} participants</p>
            <div className="flex flex-wrap justify-center gap-4 max-w-md">
              {remoteParticipants.map((p) => (
                <div key={p.username} className="flex flex-col items-center gap-1">
                  <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-brand-500/50 bg-slate-700 flex items-center justify-center">
                    {p.avatar ? (
                      <img src={p.avatar} alt={p.name || p.username} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-brand-300">
                        {(p.name || p.username).charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="text-xs truncate max-w-[70px]">{p.name || p.username}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-6">
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
              {isCreator && (
                <button
                  onClick={onEndCall}
                  disabled={isEndingCall}
                  className="flex flex-col items-center gap-2 p-4 rounded-full bg-red-600 hover:bg-red-500 transition-colors disabled:opacity-70"
                >
                  <PhoneOff size={28} />
                  <span className="text-xs font-medium">{isEndingCall ? 'Ending...' : 'End for everyone'}</span>
                </button>
              )}
              <button
                onClick={onLeave}
                disabled={isEndingCall}
                className="flex flex-col items-center gap-2 p-4 rounded-full bg-slate-600 hover:bg-slate-500 transition-colors disabled:opacity-70"
              >
                <PhoneOff size={28} />
                <span className="text-xs font-medium">{isEndingCall ? 'Leaving...' : 'Leave'}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
