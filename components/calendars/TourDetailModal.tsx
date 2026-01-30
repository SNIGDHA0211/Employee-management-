import React from 'react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { Tour } from './types';
import { ALL_USERS } from './constants';

interface TourDetailModalProps {
  tour: Tour;
  onClose: () => void;
}

export const TourDetailModal: React.FC<TourDetailModalProps> = ({
  tour,
  onClose,
}) => {
  const getAttendeeName = (id: string) => {
    return ALL_USERS.find((u) => u.id === id)?.name || 'Unknown Member';
  };

  const daysCount =
    differenceInDays(parseISO(tour.endDate), parseISO(tour.startDate)) + 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-8 text-white relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 opacity-20 transform rotate-12">
            <svg
              className="w-48 h-48"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>

          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <span className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-sm border border-white/30">
                Tour Details
              </span>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-xl transition-all"
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
                    strokeWidth="2.5"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <h2 className="text-3xl font-black tracking-tight mb-2 leading-tight">
              {tour.name}
            </h2>
            <div className="flex items-center gap-2 text-amber-50 font-bold text-sm opacity-90">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              {tour.location}
            </div>
          </div>
        </div>

        <div className="p-8 space-y-8 bg-slate-50/30">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Duration
              </div>
              <div className="text-xl font-black text-slate-800">
                {daysCount} Days
              </div>
              <div className="text-[10px] font-bold text-slate-500 mt-1 italic">
                {format(parseISO(tour.startDate), 'MMM d')} -{' '}
                {format(parseISO(tour.endDate), 'MMM d')}
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Participants
              </div>
              <div className="text-xl font-black text-slate-800">
                {tour.attendees?.length || 0} People
              </div>
              <div className="flex -space-x-2 mt-2">
                {tour.attendees?.slice(0, 3).map((id) => (
                  <div
                    key={id}
                    className="w-6 h-6 rounded-full border-2 border-white bg-amber-500 flex items-center justify-center text-[8px] font-black text-white shadow-sm"
                  >
                    {getAttendeeName(id).charAt(0)}
                  </div>
                ))}
                {(tour.attendees?.length || 0) > 3 && (
                  <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[8px] font-black text-slate-600 shadow-sm">
                    +{(tour.attendees?.length || 0) - 3}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              Tour Members
            </h3>
            <div className="flex flex-wrap gap-2">
              {tour.attendees?.map((id) => (
                <div
                  key={id}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-sm hover:border-amber-300 transition-colors"
                >
                  {getAttendeeName(id)}
                </div>
              ))}
              {(!tour.attendees || tour.attendees.length === 0) && (
                <span className="text-xs text-slate-400 italic">
                  No members assigned yet
                </span>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h7"
                />
              </svg>
              Description
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed font-medium bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              {tour.description || 'No description provided for this tour.'}
            </p>
          </div>
        </div>

        <div className="p-6 bg-white border-t text-center">
          <button
            onClick={onClose}
            className="px-10 py-3 bg-slate-900 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
