import React, { useState, useEffect } from 'react';
import { format, addMonths, subMonths, addDays } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, CalendarDays, PartyPopper, MapPin } from 'lucide-react';
import { UserRole } from '../../types';
import { ViewMode, Meeting, Holiday, Tour, MeetingStatus, MeetingType } from './types';
import { getHolidays, deleteHoliday, getBookSlots, deleteBookSlot, updateBookSlot, getEvents, deleteEvent, getTours, deleteTour } from '../../services/api';
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
}

export const ScheduleHubPage: React.FC<ScheduleHubPageProps> = ({ currentUser }) => {
  const canAddHolidayOrEvent = currentUser && [UserRole.MD, UserRole.ADMIN].includes(currentUser.role);
  const canEditDeleteHoliday = currentUser && [UserRole.MD, UserRole.ADMIN].includes(currentUser.role);
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
  const [selectedHoliday, setSelectedHoliday] = useState<Holiday | null>(null);
  const [holidayModalDate, setHolidayModalDate] = useState<Date>(new Date());
  const [holidayToEdit, setHolidayToEdit] = useState<Holiday | null>(null);
  const [meetingToEdit, setMeetingToEdit] = useState<Meeting | null>(null);
  const [tourToEdit, setTourToEdit] = useState<Tour | null>(null);

  // Fetch holidays and events, merge for calendar
  useEffect(() => {
    if (!currentUser) {
      setHolidays([]);
      return;
    }
    Promise.all([getHolidays(), getEvents()])
      .then(([holidayList, eventList]) => {
        const holidays: Holiday[] = (holidayList || []).map((h: any) => {
          const rawDate = h.date?.includes?.('T') ? h.date.split('T')[0] : (h.date || '').substring(0, 10);
          return { id: String(h.id), name: h.name, date: rawDate, type: 'holiday' as const };
        });
        const events: Holiday[] = (eventList || []).map((e: any) => {
          const rawDate = e.date?.includes?.('T') ? e.date.split('T')[0] : (e.date || '').substring(0, 10);
          return {
            id: String(e.id),
            name: e.title,
            date: rawDate,
            type: 'event' as const,
            motive: e.motive,
            time: e.time,
          };
        });
        setHolidays([...holidays, ...events]);
      })
      .catch(() => setHolidays([]));
  }, [currentUser]);

  // Fetch book slots on initial load (GET eventsapi/bookslots/)
  const [meetingsLoading, setMeetingsLoading] = useState(true);
  useEffect(() => {
    if (!currentUser) {
      setMeetings([]);
      setMeetingsLoading(false);
      return;
    }
    setMeetingsLoading(true);
    getBookSlots()
      .then((list) => {
      const mapped: Meeting[] = list.map((item: any) => {
        const memberDetails = item.member_details || [];
        const attendees = memberDetails.map((m: any) => String(m.username ?? m.id ?? ''));
        const attendeeNames: Record<string, string> = {};
        memberDetails.forEach((m: any) => {
          attendeeNames[String(m.username ?? m.id ?? '')] = m.full_name ?? m.name ?? 'Unknown';
        });
        const statusStr = (item.status || '').toLowerCase();
        const status =
          statusStr === 'done' ? MeetingStatus.DONE :
          statusStr === 'cancelled' ? MeetingStatus.CANCELLED :
          statusStr === 'exceeded' ? MeetingStatus.EXCEEDED :
          MeetingStatus.PENDING;
        const startTime = item.start_time
          ? String(item.start_time).substring(0, 5)
          : '09:00';
        const endTime = item.end_time
          ? String(item.end_time).substring(0, 5)
          : '10:00';
        return {
          id: String(item.id),
          title: item.meeting_title || 'No title',
          description: item.description ?? undefined,
          hallName: item.room || 'N/A',
          startTime,
          endTime,
          date: item.date || '',
          type: item.meeting_type === 'group' ? MeetingType.GROUP : MeetingType.INDIVIDUAL,
          attendees,
          status,
          attendeeNames,
          createdByName: item.creater_details?.full_name,
        };
      });
      setMeetings(mapped);
      })
      .catch(() => setMeetings([]))
      .finally(() => setMeetingsLoading(false));
  }, [currentUser]);

  // Fetch tours on initial load (GET eventsapi/tours/)
  useEffect(() => {
    if (!currentUser) {
      setTours([]);
      return;
    }
    getTours()
      .then((list) => {
        const mapped: Tour[] = (list || []).map((item: any) => {
          const memberDetails = item.member_details || [];
          const attendees = (item.members || []).map((m: any) => String(m));
          const attendeeNames: Record<string, string> = {};
          memberDetails.forEach((m: any) => {
            const id = String(m.username ?? m.id ?? m.Employee_id ?? '');
            const fullName = m.full_name ?? m['full_name'] ?? m['Full Name'] ?? m.name ?? m.Name ?? 'Unknown';
            if (id) attendeeNames[id] = fullName;
          });
          const rawStart = item.starting_date;
          const fallbackDate = item.created_at?.split?.('T')[0] || format(new Date(), 'yyyy-MM-dd');
          const startDate = rawStart
            ? (rawStart.includes?.('T') ? rawStart.split('T')[0] : rawStart).substring(0, 10)
            : fallbackDate.substring(0, 10);
          const duration = item.duration_days ?? 1;
          const endDate = format(
            addDays(new Date(startDate), Math.max(0, duration - 1)),
            'yyyy-MM-dd'
          );
          return {
            id: String(item.id),
            name: item.tour_name || 'Tour',
            location: item.location || '',
            description: item.description ?? undefined,
            startDate,
            endDate,
            attendees,
            attendeeNames,
          };
        });
        setTours(mapped);
      })
      .catch(() => setTours([]));
  }, [currentUser]);

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
  };

  const handleCancelMeeting = async (id: string) => {
    try {
      await deleteBookSlot(id);
      setMeetings((prev) => prev.filter((m) => m.id !== id));
    } catch {
      setMeetings((prev) => prev.filter((m) => m.id !== id));
    }
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
      if (existing) return prev.map((m) => (m.id === meeting.id ? meeting : m));
      return [...prev, meeting];
    });
    setShowMeetingModal(false);
    setMeetingToEdit(null);
  };

  const handleSaveHoliday = (holiday: Holiday) => {
    setHolidays((prev) => {
      const existing = prev.find((h) => h.id === holiday.id);
      if (existing) return prev.map((h) => (h.id === holiday.id ? holiday : h));
      return [...prev, holiday];
    });
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
    setHolidays((prev) => prev.filter((h) => h.id !== id));
    setSelectedHoliday(null);
  };

  const handleEditHoliday = (holiday: Holiday) => {
    setSelectedHoliday(null);
    setHolidayToEdit(holiday);
    setHolidayModalDate(new Date(holiday.date));
    setShowHolidayModal(true);
  };

  const handleSaveTour = (tour: Tour) => {
    setTours((prev) => {
      const existing = prev.find((t) => t.id === tour.id);
      if (existing) return prev.map((t) => (t.id === tour.id ? tour : t));
      return [...prev, tour];
    });
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
      setTours((prev) => prev.filter((t) => t.id !== id));
      setSelectedTour(null);
    } catch {
      setTours((prev) => prev.filter((t) => t.id !== id));
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

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px] relative">
        {meetingsLoading && viewMode === ViewMode.MEETING && (
          <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center rounded-2xl">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium text-slate-600">Loading book slots…</span>
            </div>
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
        />
      )}

      {selectedTour && (
        <TourDetailModal
          tour={selectedTour}
          onClose={() => setSelectedTour(null)}
          onEdit={handleEditTour}
          onDelete={handleDeleteTour}
          canEdit={!!canEditDeleteHoliday}
        />
      )}
    </div>
  );
};
