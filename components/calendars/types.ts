export enum ViewMode {
  MEETING = 'meeting',
  HOLIDAY = 'holiday',
  TOUR = 'tour',
}

export enum MeetingStatus {
  PENDING = 'pending',
  DONE = 'done',
  EXCEEDED = 'exceeded',
  CANCELLED = 'cancelled',
}

export enum MeetingType {
  INDIVIDUAL = 'individual',
  GROUP = 'group',
}

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  hallName: string;
  startTime: string;
  endTime: string;
  date: string;
  type: MeetingType;
  attendees: string[];
  status: MeetingStatus;
  /** From API: id -> name map for attendee display */
  attendeeNames?: Record<string, string>;
  /** From API: creator name for "Booked by" display */
  createdByName?: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
  isUrgent?: boolean;
  type: 'holiday' | 'event';
  motive?: string;
  time?: string;
}

export interface Tour {
  id: string;
  name: string;
  location: string;
  description?: string;
  startDate: string;
  endDate: string;
  attendees?: string[];
  /** From API: member id -> full name for display */
  attendeeNames?: Record<string, string>;
}

export interface User {
  id: string;
  name: string;
}
