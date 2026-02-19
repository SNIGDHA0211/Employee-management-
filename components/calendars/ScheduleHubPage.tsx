import React, { useState, useEffect } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, CalendarDays, PartyPopper, MapPin } from 'lucide-react';
import { UserRole } from '../../types';
import { ViewMode, Meeting, Holiday, Tour, MeetingStatus } from './types';
import { deleteHoliday, deleteBookSlot, updateBookSlot, deleteEvent, deleteTour } from '../../services/api';
import { useRequestLock } from '../../hooks/useRequestLock';
import { CalendarGrid } from './CalendarGrid';
import { DayViewModal } from './DayViewModal';
import { HolidayModal } from './HolidayModal';
import { HolidayDetailModal } from './HolidayDetailModal';
import { MeetingModal } from './MeetingModal';
import { TourDetailModal } from './TourDetailModal';
import { TourModal } from './TourModal';
import type { User } from '../../types';

interface ScheduleHubPageProps {
  currentUser?: User | null;
  holidays?: Holiday[];
  tours?: Tour[];
  meetings?: Meeting[];
  setMeetings?: React.Dispatch<React.SetStateAction<Meeting[]>>;
  fetchMeetingsForMonth?: (month: number, year: number) => Promise<void>;
  onScheduleDataUpdated?: () => void;
  meetingsCacheRef?: React.MutableRefObject<Record<string, Meeting[]>>;
  users?: User[];
}

export const ScheduleHubPage: React.FC<ScheduleHubPageProps> = ({
  currentUser,
  holidays: holidaysProp = [],
  tours: toursProp = [],
  meetings: meetingsProp = [],
  setMeetings: setMeetingsProp,
  fetchMeetingsForMonth,
  onScheduleDataUpdated,
  meetingsCacheRef,
  users = [],
}) => {
  const canAddHolidayOrEvent = currentUser && [UserRole.MD, UserRole.ADMIN, UserRole.HR].includes(currentUser.role);
  const canEditDeleteHoliday = currentUser && [UserRole.MD, UserRole.ADMIN, UserRole.HR].includes(currentUser.role);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.MEETING);
  const meetings = meetingsProp;
  const setMeetings = setMeetingsProp ?? (() => {});
  const holidays = holidaysProp;
  const tours = toursProp;
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDayView, setShowDayView] = useState(false);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showTourModal, setShowTourModal] = useState(false);
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null);
  const [selectedHoliday, setSelectedHoliday] = useState<Holiday | null>(null);
  const [holidayModalDate, setHolidayModalDate] = useState<Date>(new Date());
  const [holidayToEdit, setHolidayToEdit] = useState<Holiday | null>(null);
  const [meetingToEdit, setMeetingToEdit] = useState<Meeting | null>(null);
  const [tourToEdit, setTourToEdit] = useState<Tour | null>(null);
  const { withLock } = useRequestLock();

  const [meetingsLoading, setMeetingsLoading] = useState(false);

  // Request meetings for current month when date changes or on mount (data comes from App)
  useEffect(() => {
    if (!currentUser || !fetchMeetingsForMonth) return;
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();
    setMeetingsLoading(true);
    fetchMeetingsForMonth(month, year).finally(() => setMeetingsLoading(false));
  }, [currentUser?.id, currentDate.getMonth(), currentDate.getFullYear(), fetchMeetingsForMonth]);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    if (viewMode === ViewMode.MEETING) setShowDayView(true);
  };

  const handleNewBooking = () => {
    setShowDayView(false);
    setMeetingToEdit(null);
    if (selectedDate) setShowMeetingModal(true);
  };

  const handleMeetingStatusUpdate = async (id: string, status: MeetingStatus) => {
    await withLock(async () => {
      const statusStr =
        status === MeetingStatus.DONE ? 'Done' :
        status === MeetingStatus.EXCEEDED ? 'Exceeded' :
        status === MeetingStatus.CANCELLED ? 'Cancelled' : 'Pending';
      try {
        await updateBookSlot(id, { status: statusStr });
        setMeetings((prev) =>
          prev.map((m) => (m.id === id ? { ...m, status } : m))
        );
      } catch {
        setMeetings((prev) =>
          prev.map((m) => (m.id === id ? { ...m, status } : m))
        );
      }
    });
  };

  const handleCancelMeeting = async (id: string) => {
    await withLock(async () => {
      const meeting = meetings.find((m) => m.id === id);
      try {
        await deleteBookSlot(id);
        setMeetings((prev) => {
          const next = prev.filter((m) => m.id !== id);
          if (meeting?.date && meetingsCacheRef) {
            const [y, mo] = meeting.date.split('-');
            if (y && mo) meetingsCacheRef.current[`${y}-${mo}`] = next;
          }
          return next;
        });
      } catch {
        setMeetings((prev) => prev.filter((m) => m.id !== id));
      }
    });
  };

  const handleEditMeeting = (meeting: Meeting) => {
    setMeetingToEdit(meeting);
    setShowDayView(false);
    setShowMeetingModal(true);
  };

  const handleExceedMeeting = (id: string) => {
    setMeetings((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, status: MeetingStatus.EXCEEDED } : m
      )
    );
  };

  const handleSaveMeeting = (meeting: Meeting) => {
    setMeetings((prev) => {
      const existing = prev.find((m) => m.id === meeting.id);
      const next = existing ? prev.map((m) => (m.id === meeting.id ? meeting : m)) : [...prev, meeting];
      const [y, m] = (meeting.date || '').split('-');
      if (y && m && meetingsCacheRef) {
        meetingsCacheRef.current[`${y}-${m}`] = next;
      }
      return next;
    });
    setShowMeetingModal(false);
    setMeetingToEdit(null);
  };

  const handleSaveHoliday = (holiday: Holiday) => {
    onScheduleDataUpdated?.();
    setShowHolidayModal(false);
    setHolidayToEdit(null);
  };

  const handleDeleteHoliday = async (id: string) => {
    const item = selectedHoliday;
    if (item?.type === 'event') {
      await deleteEvent(id);
    } else {
      await deleteHoliday(id);
    }
    onScheduleDataUpdated?.();
    setSelectedHoliday(null);
  };

  const handleEditHoliday = (holiday: Holiday) => {
    setSelectedHoliday(null);
    setHolidayToEdit(holiday);
    setHolidayModalDate(new Date(holiday.date));
    setShowHolidayModal(true);
  };

  const handleSaveTour = (tour: Tour) => {
    onScheduleDataUpdated?.();
    setShowTourModal(false);
    setTourToEdit(null);
  };

  const handleTourClick = (tour: Tour) => {
    setSelectedTour(tour);
  };

  const handleEditTour = (tour: Tour) => {
    setSelectedTour(null);
    setTourToEdit(tour);
    setShowTourModal(true);
  };

  const handleDeleteTour = async (id: string) => {
    try {
      await deleteTour(id);
      onScheduleDataUpdated?.();
      setSelectedTour(null);
    } catch {
      onScheduleDataUpdated?.();
      setSelectedTour(null);
    }
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
                setTourToEdit(null);
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
        {meetingsLoading && viewMode === ViewMode.MEETING && (
          <div className="flex items-center justify-center gap-2 py-2 bg-indigo-50 border-b border-indigo-100">
            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium text-indigo-700">Loading meetings…</span>
          </div>
        )}
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
          onHolidayClick={(h) => setSelectedHoliday(h)}
        />
      </div>

      {showDayView && selectedDate && (
        <DayViewModal
          date={selectedDate}
          meetings={meetings.filter((m) => m.date === format(selectedDate, 'yyyy-MM-dd'))}
          currentUser={currentUser}
          onClose={() => setShowDayView(false)}
          onNewBooking={handleNewBooking}
          onMeetingStatusUpdate={handleMeetingStatusUpdate}
          onCancelMeeting={handleCancelMeeting}
          onExceedMeeting={handleExceedMeeting}
          onEditMeeting={handleEditMeeting}
        />
      )}

      {showMeetingModal && (selectedDate || meetingToEdit) && (
        <MeetingModal
          date={meetingToEdit ? new Date(meetingToEdit.date) : selectedDate!}
          onClose={() => {
            setShowMeetingModal(false);
            setMeetingToEdit(null);
          }}
          onSave={handleSaveMeeting}
          currentUser={currentUser}
          initialMeeting={meetingToEdit}
          employees={users.map((u) => ({
            id: u.id,
            name: u.name,
            employeeId: (u as any).Employee_id ?? u.id,
          }))}
        />
      )}

      {showHolidayModal && (
        <HolidayModal
          date={holidayModalDate}
          onClose={() => {
            setShowHolidayModal(false);
            setHolidayToEdit(null);
          }}
          onSave={handleSaveHoliday}
          initialHoliday={holidayToEdit}
          existingHolidays={holidays}
        />
      )}

      {selectedHoliday && (
        <HolidayDetailModal
          holiday={selectedHoliday}
          onClose={() => setSelectedHoliday(null)}
          onEdit={handleEditHoliday}
          onDelete={handleDeleteHoliday}
          canEdit={!!canEditDeleteHoliday}
        />
      )}

      {showTourModal && (
        <TourModal
          date={tourToEdit ? new Date(tourToEdit.startDate) : currentDate}
          onClose={() => {
            setShowTourModal(false);
            setTourToEdit(null);
          }}
          onSave={handleSaveTour}
          initialTour={tourToEdit}
          employees={users.map((u) => ({ id: u.id, name: u.name }))}
        />
      )}

      {selectedTour && (
        <TourDetailModal
          tour={selectedTour}
          onClose={() => setSelectedTour(null)}
          onEdit={handleEditTour}
          onDelete={handleDeleteTour}
          canEdit={!!canEditDeleteHoliday}
          employeeNames={Object.fromEntries(users.map((u) => [u.id, u.name]))}
        />
      )}
    </div>
  );
};
