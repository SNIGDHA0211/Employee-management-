import React from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
} from 'date-fns';
import { ViewMode, Meeting, Holiday, Tour, MeetingStatus } from './types';

interface CalendarGridProps {
  currentDate: Date;
  viewMode: ViewMode;
  meetings: Meeting[];
  holidays: Holiday[];
  tours: Tour[];
  onDateClick: (date: Date) => void;
  onMeetingStatusUpdate: (id: string, status: MeetingStatus) => void;
  onCancelMeeting: (id: string) => void;
  onExceedMeeting: (id: string) => void;
  onTourClick?: (tour: Tour) => void;
  onHolidayClick?: (holiday: Holiday) => void;
}

const START_HOUR = 9;
const END_HOUR = 18;
const TOTAL_DAILY_SLOTS = END_HOUR - START_HOUR;

// Tour color palette - highly distinct, easy to differentiate
const TOUR_COLORS = [
  'bg-amber-500 hover:bg-amber-600 shadow-amber-500/25',
  'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25',
  'bg-blue-600 hover:bg-blue-700 shadow-blue-600/25',
  'bg-rose-500 hover:bg-rose-600 shadow-rose-500/25',
  'bg-violet-600 hover:bg-violet-700 shadow-violet-600/25',
  'bg-cyan-500 hover:bg-cyan-600 shadow-cyan-500/25',
  'bg-orange-500 hover:bg-orange-600 shadow-orange-500/25',
  'bg-fuchsia-500 hover:bg-fuchsia-600 shadow-fuchsia-500/25',
  'bg-teal-600 hover:bg-teal-700 shadow-teal-600/25',
  'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/25',
  'bg-pink-500 hover:bg-pink-600 shadow-pink-500/25',
  'bg-lime-600 hover:bg-lime-700 shadow-lime-600/25',
];

const getTourColorClass = (tourId: string): string => {
  const num = parseInt(tourId, 10) || tourId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const idx = Math.abs(num) % TOUR_COLORS.length;
  return TOUR_COLORS[idx];
};

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  currentDate,
  viewMode,
  meetings,
  holidays,
  tours,
  onDateClick,
  onMeetingStatusUpdate,
  onCancelMeeting,
  onExceedMeeting,
  onTourClick,
  onHolidayClick,
}) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const getDayEvents = (day: Date) => {
    const formattedDay = format(day, 'yyyy-MM-dd');

    switch (viewMode) {
      case ViewMode.MEETING:
        return meetings.filter((m) => {
          if (m.date !== formattedDay) return false;
          const startHour = parseInt((m as Meeting).startTime?.split(':')[0] ?? '9', 10);
          return !isNaN(startHour) && startHour >= 9 && startHour <= 18;
        });
      case ViewMode.HOLIDAY:
        return holidays.filter((h) => h.date === formattedDay);
      case ViewMode.TOUR:
        return tours.filter(
          (t) => formattedDay >= t.startDate && formattedDay <= t.endDate
        );
      default:
        return [];
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border h-full flex flex-col overflow-hidden">
      <div className="grid grid-cols-7 border-b bg-slate-50/50">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="p-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 flex-1 overflow-y-auto">
        {days.map((day, i) => {
          const events = getDayEvents(day);
          const isCurrentMonth = isSameMonth(day, monthStart);
          const hasHoliday =
            viewMode === ViewMode.HOLIDAY &&
            events.some((e) => (e as Holiday).type === 'holiday');
          const hasEvent =
            viewMode === ViewMode.HOLIDAY &&
            events.some((e) => (e as Holiday).type === 'event');

          let cellBgClass = '';
          if (hasHoliday) {
            cellBgClass = 'bg-red-600';
          } else if (hasEvent) {
            cellBgClass = 'bg-indigo-600';
          } else if (!isCurrentMonth) {
            cellBgClass = 'bg-slate-50/10 opacity-40';
          } else {
            cellBgClass = 'hover:bg-slate-50/50';
          }

          return (
            <div
              key={i}
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (!target.closest('button') && viewMode === ViewMode.MEETING) {
                  onDateClick(day);
                }
              }}
              className={`min-h-[140px] p-2 border-r border-b last:border-r-0 transition-all flex flex-col gap-1 ${cellBgClass} ${viewMode === ViewMode.MEETING ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div className="flex justify-between items-start mb-1">
                <span
                  className={`text-sm font-semibold flex items-center justify-center w-8 h-8 rounded-full ${
                    hasHoliday || hasEvent
                      ? 'bg-white/20 text-white'
                      : isToday(day)
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                        : !isCurrentMonth
                          ? 'text-slate-300'
                          : 'text-slate-600'
                  }`}
                >
                  {format(day, 'd')}
                </span>
                {hasHoliday &&
                  events.find((e) => (e as Holiday).isUrgent) && (
                    <span className="flex h-2 w-2 rounded-full bg-white animate-ping"></span>
                  )}
              </div>

              <div className="flex-1 overflow-hidden flex flex-col gap-1.5">
                {viewMode === ViewMode.MEETING ? (
                  <div className="flex flex-col h-full">
                    {events.length > 0 ? (
                      <div className="space-y-2 mt-1">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between bg-indigo-50 px-2 py-1.5 rounded-lg border border-indigo-100">
                            <span className="text-[10px] font-black text-indigo-700 uppercase tracking-tighter">
                              Booked
                            </span>
                            <span className="text-xs font-black text-indigo-700">
                              {events.length}
                            </span>
                          </div>
                          <div className="flex items-center justify-between bg-slate-100 px-2 py-1.5 rounded-lg border border-slate-200">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                              Available
                            </span>
                            <span className="text-xs font-black text-slate-500">
                              {Math.max(0, TOTAL_DAILY_SLOTS - events.length)}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-0.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-auto">
                          {Array.from({ length: TOTAL_DAILY_SLOTS }).map(
                            (_, idx) => {
                              const hour = idx + START_HOUR;
                              const isBooked = events.some(
                                (m) =>
                                  parseInt((m as Meeting).startTime.split(':')[0]) ===
                                  hour
                              );
                              return (
                                <div
                                  key={idx}
                                  className={`flex-1 ${isBooked ? 'bg-indigo-500' : 'bg-slate-200'}`}
                                />
                              );
                            }
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  events.map((ev, idx) => {
                    if (viewMode === ViewMode.HOLIDAY) {
                      const h = ev as Holiday;
                      const isHolidayType = h.type === 'holiday';
                      // Holidays and events are clickable — opens detail modal (Edit PATCH / Delete)
                      const isClickable = !!onHolidayClick;
                      const content = (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="font-black uppercase tracking-tighter truncate leading-tight">
                              {h.name}
                            </span>
                          </div>
                          {!isHolidayType && (
                            <div className="bg-white/10 rounded-lg p-1.5 mt-1 border border-white/20">
                              {h.motive && (
                                <div className="text-[9px] font-medium leading-tight italic truncate text-indigo-100">
                                  &quot;{h.motive}&quot;
                                </div>
                              )}
                              {h.time && (
                                <div className="flex items-center gap-1 mt-1 text-[8px] font-bold text-white">
                                  <svg
                                    className="w-2.5 h-2.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                  {String(h.time).substring(0, 5)}
                                </div>
                              )}
                            </div>
                          )}
                          {isHolidayType && h.isUrgent && (
                            <div className="mt-1 px-1.5 py-0.5 bg-white text-red-600 rounded text-[8px] font-black uppercase w-fit">
                              Urgent
                            </div>
                          )}
                        </>
                      );
                      if (isClickable) {
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => onHolidayClick(h)}
                            className="text-left w-full text-[10px] p-2 rounded-xl flex flex-col gap-0.5 text-white hover:opacity-90 cursor-pointer transition-opacity"
                          >
                            {content}
                          </button>
                        );
                      }
                      return (
                        <div
                          key={idx}
                          className="text-[10px] p-2 rounded-xl flex flex-col gap-0.5 text-white"
                        >
                          {content}
                        </div>
                      );
                    }
                    if (viewMode === ViewMode.TOUR) {
                      const t = ev as Tour;
                      const memberCount = t.attendees?.length || 0;
                      const colorClass = getTourColorClass(t.id);
                      return (
                        <button
                          key={`${t.id}-${idx}`}
                          onClick={() => onTourClick && onTourClick(t)}
                          className="flex items-center justify-center w-full mt-1 group"
                        >
                          <div className={`flex items-center gap-2 text-white px-3 py-1.5 rounded-full shadow-lg transition-all transform hover:scale-105 active:scale-95 ${colorClass}`}>
                            <svg
                              className="w-3 h-3"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                            </svg>
                            <span className="text-[11px] font-black uppercase tracking-tighter">
                              {memberCount}{' '}
                              {memberCount === 1 ? 'Member' : 'Members'}
                            </span>
                          </div>
                        </button>
                      );
                    }
                    return null;
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
