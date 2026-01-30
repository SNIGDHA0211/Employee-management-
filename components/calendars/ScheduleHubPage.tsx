import React, { useState } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, CalendarDays, PartyPopper, MapPin } from 'lucide-react';
import { UserRole } from '../../types';
import { ViewMode, Meeting, Holiday, Tour, MeetingStatus } from './types';
import { CalendarGrid } from './CalendarGrid';
import { DayViewModal } from './DayViewModal';
import { HolidayModal } from './HolidayModal';
import { MeetingModal } from './MeetingModal';
import { TourDetailModal } from './TourDetailModal';
import { TourModal } from './TourModal';
import type { User } from '../../types';

interface ScheduleHubPageProps {
  currentUser?: User | null;
}

export const ScheduleHubPage: React.FC<ScheduleHubPageProps> = ({ currentUser }) => {
  const canAddHolidayOrEvent = currentUser && [UserRole.MD, UserRole.ADMIN].includes(currentUser.role);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.MEETING);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDayView, setShowDayView] = useState(false);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showTourModal, setShowTourModal] = useState(false);
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null);
  const [holidayModalDate, setHolidayModalDate] = useState<Date>(new Date());

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    if (viewMode === ViewMode.MEETING) setShowDayView(true);
  };

  const handleNewBooking = () => {
    setShowDayView(false);
    if (selectedDate) setShowMeetingModal(true);
  };

  const handleMeetingStatusUpdate = (id: string, status: MeetingStatus) => {
    setMeetings((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status } : m))
    );
  };

  const handleCancelMeeting = (id: string) => {
    setMeetings((prev) => prev.filter((m) => m.id !== id));
  };

  const handleExceedMeeting = (id: string) => {
    setMeetings((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, status: MeetingStatus.EXCEEDED } : m
      )
    );
  };

  const handleSaveMeeting = (meeting: Meeting) => {
    setMeetings((prev) => [...prev, meeting]);
    setShowMeetingModal(false);
  };

  const handleSaveHoliday = (holiday: Holiday) => {
    setHolidays((prev) => [...prev, holiday]);
    setShowHolidayModal(false);
  };

  const handleSaveTour = (tour: Tour) => {
    setTours((prev) => [...prev, tour]);
    setShowTourModal(false);
  };

  const handleTourClick = (tour: Tour) => {
    setSelectedTour(tour);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Schedule Hub</h1>
            <p className="text-sm text-gray-500">
              Meetings, holidays & tours
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              onClick={() => setViewMode(ViewMode.MEETING)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === ViewMode.MEETING ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <CalendarDays className="w-4 h-4" />
              Meetings
            </button>
            <button
              onClick={() => setViewMode(ViewMode.HOLIDAY)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === ViewMode.HOLIDAY ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <PartyPopper className="w-4 h-4" />
              Holidays
            </button>
            <button
              onClick={() => setViewMode(ViewMode.TOUR)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === ViewMode.TOUR ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <MapPin className="w-4 h-4" />
              Tours
            </button>
          </div>

          <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
            <button
              onClick={() => setCurrentDate((d) => subMonths(d, 1))}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="px-4 py-2 text-sm font-bold text-slate-800 min-w-[140px] text-center">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <button
              onClick={() => setCurrentDate((d) => addMonths(d, 1))}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {viewMode === ViewMode.HOLIDAY && canAddHolidayOrEvent && (
            <button
              onClick={() => {
                setHolidayModalDate(currentDate);
                setShowHolidayModal(true);
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 shadow-md transition-all"
            >
              + Add Holiday / Event
            </button>
          )}
          {viewMode === ViewMode.TOUR && (
            <button
              onClick={() => {
                setShowTourModal(true);
              }}
              className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 shadow-md transition-all"
            >
              + Plan Tour
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
        <CalendarGrid
          currentDate={currentDate}
          viewMode={viewMode}
          meetings={meetings}
          holidays={holidays}
          tours={tours}
          onDateClick={handleDateClick}
          onMeetingStatusUpdate={handleMeetingStatusUpdate}
          onCancelMeeting={handleCancelMeeting}
          onExceedMeeting={handleExceedMeeting}
          onTourClick={handleTourClick}
        />
      </div>

      {showDayView && selectedDate && (
        <DayViewModal
          date={selectedDate}
          meetings={meetings.filter((m) => m.date === format(selectedDate, 'yyyy-MM-dd'))}
          onClose={() => setShowDayView(false)}
          onNewBooking={handleNewBooking}
          onMeetingStatusUpdate={handleMeetingStatusUpdate}
          onCancelMeeting={handleCancelMeeting}
          onExceedMeeting={handleExceedMeeting}
        />
      )}

      {showMeetingModal && selectedDate && (
        <MeetingModal
          date={selectedDate}
          onClose={() => setShowMeetingModal(false)}
          onSave={handleSaveMeeting}
        />
      )}

      {showHolidayModal && (
        <HolidayModal
          date={holidayModalDate}
          onClose={() => setShowHolidayModal(false)}
          onSave={handleSaveHoliday}
        />
      )}

      {showTourModal && (
        <TourModal
          date={currentDate}
          onClose={() => setShowTourModal(false)}
          onSave={handleSaveTour}
        />
      )}

      {selectedTour && (
        <TourDetailModal
          tour={selectedTour}
          onClose={() => setSelectedTour(null)}
        />
      )}
    </div>
  );
};
