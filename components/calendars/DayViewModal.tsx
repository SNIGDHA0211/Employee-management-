import React from 'react';
import { format } from 'date-fns';
import { Meeting, MeetingStatus } from './types';
import { ALL_USERS, HALLS } from './constants';

interface DayViewModalProps {
  date: Date;
  meetings: Meeting[];
  onClose: () => void;
  onNewBooking: () => void;
  onMeetingStatusUpdate: (id: string, status: MeetingStatus) => void;
  onCancelMeeting: (id: string) => void;
  onExceedMeeting: (id: string) => void;
  onEditMeeting?: (meeting: Meeting) => void;
}

const START_HOUR = 9;
const END_HOUR = 18;
const hours = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, i) => i + START_HOUR
);

export const DayViewModal: React.FC<DayViewModalProps> = ({
  date,
  meetings,
  onClose,
  onNewBooking,
  onMeetingStatusUpdate,
  onCancelMeeting,
  onExceedMeeting,
  onEditMeeting,
}) => {
  const getAttendeeName = (m: Meeting, id: string) => {
    if (m.attendeeNames?.[id]) return m.attendeeNames[id];
    return ALL_USERS.find((u) => u.id === id)?.name || 'Unknown User';
  };

  const getMeetingsForHour = (hour: number) => {
    return meetings.filter((m) => {
      const startHour = parseInt(m.startTime.split(':')[0]);
      return startHour === hour;
    });
  };

  const getAvailableHallsForHour = (hour: number) => {
    const bookedHalls = meetings
      .filter((m) => {
        const startHour = parseInt(m.startTime.split(':')[0]);
        const endHour = parseInt(m.endTime.split(':')[0]);
        return hour >= startHour && hour < endHour;
      })
      .map((m) => m.hallName);

    return HALLS.filter((h) => !bookedHalls.includes(h));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="bg-gradient-to-br from-[#6366f1] to-[#a855f7] p-10 flex justify-between items-start shrink-0">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tight">
              {format(date, 'EEEE, MMMM do')}
            </h2>
            <div className="mt-2 inline-flex items-center px-3 py-1 bg-white/15 rounded-lg backdrop-blur-md border border-white/10">
              <span className="text-white/90 text-[11px] font-black uppercase tracking-[0.15em]">
                Office Hours: 09:00 - 18:00
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onNewBooking}
              className="bg-white/20 hover:bg-white/30 text-white w-12 h-12 flex items-center justify-center rounded-2xl transition-all shadow-lg active:scale-95"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="bg-white/10 hover:bg-white/20 text-white w-12 h-12 flex items-center justify-center rounded-2xl transition-all shadow-lg active:scale-95"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-white">
          <div className="relative border-l-2 border-slate-100 ml-16">
            {hours.map((hour) => {
              const hourMeetings = getMeetingsForHour(hour);
              const availableHalls = getAvailableHallsForHour(hour);
              const formattedHour = `${hour.toString().padStart(2, '0')}:00`;
              const isPartiallyOccupied = hourMeetings.length > 0;

              return (
                <div key={hour} className="relative pl-12 pb-12 group last:pb-4">
                  <div
                    className={`absolute -left-[5.5rem] top-0 text-xs font-black transition-colors ${isPartiallyOccupied ? 'text-indigo-600' : 'text-slate-400'}`}
                  >
                    {formattedHour}
                  </div>

                  <div
                    className={`absolute -left-[0.72rem] top-0.5 w-5.5 h-5.5 rounded-full border-[5px] border-white shadow-lg transition-all ring-2 ${isPartiallyOccupied ? 'ring-indigo-500 bg-indigo-500 scale-110' : 'ring-slate-100 bg-slate-50'}`}
                  ></div>

                  <div className="flex flex-col gap-4">
                    {hourMeetings.map((m) => {
                      const isDone = m.status === MeetingStatus.DONE;
                      return (
                        <div
                          key={m.id}
                          className={`relative p-8 rounded-[2rem] shadow-[0_15px_40px_-15px_rgba(0,0,0,0.1)] border-l-[8px] transition-all animate-in slide-in-from-bottom-4 duration-500 ${isDone ? 'bg-emerald-50/40 border-emerald-500' : 'bg-white border-indigo-600'}`}
                        >
                          <div className="flex justify-between items-start mb-4">
                            <span
                              className={`px-4 py-1.5 rounded-full text-[11px] font-black tracking-wider ${isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-50 text-indigo-600'}`}
                            >
                              {m.startTime} - {m.endTime}
                            </span>
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full ${isDone ? 'bg-emerald-500' : 'bg-indigo-400'}`}
                              ></span>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {m.hallName}
                              </span>
                            </div>
                          </div>

                          <h4
                            className={`text-xl font-black text-slate-800 leading-tight mb-6 ${isDone ? 'opacity-30' : ''}`}
                          >
                            {m.title}
                          </h4>

                          <div className="flex flex-wrap gap-2 mb-6">
                            {!isDone && (
                              <>
                                <button
                                  onClick={() =>
                                    onMeetingStatusUpdate(m.id, MeetingStatus.DONE)
                                  }
                                  className="px-6 py-2.5 bg-[#10b981] text-white rounded-xl text-[10px] font-black uppercase tracking-[0.1em] hover:brightness-110 transition-all shadow-md active:scale-95"
                                >
                                  Done
                                </button>
                                {/* <button
                                  onClick={() => onExceedMeeting(m.id)}
                                  className="px-6 py-2.5 bg-[#6366f1] text-white rounded-xl text-[10px] font-black uppercase tracking-[0.1em] hover:brightness-110 transition-all shadow-md active:scale-95"
                                >
                                  Exceed
                                </button> */}
                              </>
                            )}
                            {onEditMeeting && !isDone && (
                              <button
                                onClick={() => onEditMeeting(m)}
                                className="px-6 py-2.5 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.1em] hover:brightness-110 transition-all shadow-md active:scale-95"
                              >
                                Edit
                              </button>
                            )}
                            {!isDone && (
                              <button
                                onClick={() => onCancelMeeting(m.id)}
                                className="px-6 py-2.5 bg-[#ef4444] text-white rounded-xl text-[10px] font-black uppercase tracking-[0.1em] hover:brightness-110 transition-all shadow-md active:scale-95"
                              >
                                Cancel
                              </button>
                            )}
                          </div>

                          <div className="pt-5 border-t border-slate-50 space-y-4">
                            {m.attendees?.length > 0 && (
                              <div>
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                                  Participants
                                </span>
                                <div className="flex flex-wrap gap-2">
                                  {m.attendees.map((aid) => (
                                    <span
                                      key={aid}
                                      className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold"
                                    >
                                      {getAttendeeName(m, aid)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-indigo-600 border-2 border-white shadow-sm flex items-center justify-center text-[12px] font-black text-white shrink-0">
                                {(m.createdByName || (m.attendees[0] && getAttendeeName(m, m.attendees[0])) || '?').charAt(0)}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                  Booked by
                                </span>
                                <span className="text-[12px] font-black text-slate-700 uppercase">
                                  {m.createdByName || (m.attendees[0] ? getAttendeeName(m, m.attendees[0]) : 'Unknown')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {availableHalls.length > 0 && (
                      <div
                        onClick={onNewBooking}
                        className="w-full text-left p-6 rounded-[2rem] bg-slate-50/50 border-2 border-slate-200 border-dashed hover:bg-slate-50 hover:border-indigo-200 transition-all group cursor-pointer"
                      >
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3 group-hover:text-indigo-400 transition-colors">
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="4"
                              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                            />
                          </svg>
                          This slot of meeting is available
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-8 bg-white border-t flex justify-center gap-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-3.5 h-3.5 rounded-full bg-[#6366f1] shadow-[0_0_10px_rgba(99,102,241,0.4)]"></div>
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
              Booked
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3.5 h-3.5 rounded-full bg-slate-200"></div>
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
              Available
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3.5 h-3.5 rounded-full bg-[#10b981] shadow-[0_0_10px_rgba(16,185,129,0.4)]"></div>
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
              Completed
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
