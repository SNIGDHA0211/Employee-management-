
import React, { useState } from 'react';
import { User, AttendanceRecord, Tour, UserRole } from '../types';
import { Calendar, Clock, Plane, MapPin, Plus, Download, ChevronLeft, ChevronRight, User as UserIcon } from 'lucide-react';

interface AttendanceToursProps {
  currentUser: User;
  users: User[];
  attendance: AttendanceRecord[];
  tours: Tour[];
  onAddTour: (tour: Tour) => void;
}

export const AttendanceTours: React.FC<AttendanceToursProps> = ({ currentUser, users, attendance, tours, onAddTour }) => {
  // --- Attendance State ---
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewUserId, setViewUserId] = useState<string>(currentUser.id); // Admin can change this

  // --- Tour State ---
  const [showTourModal, setShowTourModal] = useState(false);
  const [tourForm, setTourForm] = useState({
    startDate: '',
    endDate: '',
    purpose: '',
    location: ''
  });

  // Admin/MD View Check
  const canViewOthers = [UserRole.ADMIN, UserRole.MD].includes(currentUser.role);

  // --- Helpers ---
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const changeMonth = (offset: number) => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + offset, 1));
  };

  const handleDownloadReport = () => {
    // CSV Generation Logic
    const headers = ['User Name', 'Date', 'In Time', 'Out Time', 'Total Hours', 'Status'];
    const rows = attendance.map(record => {
      const u = users.find(user => user.id === record.userId);
      return [
        u?.name || 'Unknown',
        record.date,
        record.inTime || '-',
        record.outTime || '-',
        record.totalHours || '-',
        record.status
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "attendance_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleTourSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newTour: Tour = {
      id: `tour_${Date.now()}`,
      userId: currentUser.id,
      startDate: tourForm.startDate,
      endDate: tourForm.endDate,
      purpose: tourForm.purpose,
      location: tourForm.location
    };
    onAddTour(newTour);
    setShowTourModal(false);
    setTourForm({ startDate: '', endDate: '', purpose: '', location: '' });
  };

  // --- Render Calendar ---
  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(selectedDate);
    const firstDay = getFirstDayOfMonth(selectedDate); // 0 = Sunday
    const days = [];
    const todayStr = new Date().toISOString().split('T')[0];

    // Empty slots for previous month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 bg-gray-50/30 border border-gray-100 rounded-lg"></div>);
    }

    // Days
    for (let i = 1; i <= daysInMonth; i++) {
      const currentDateStr = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), i).toISOString().split('T')[0]; // Format YYYY-MM-DD (local approximation)
      
      // Fix timezone offset issue for comparison
      const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

      const record = attendance.find(r => r.userId === viewUserId && r.date === dateKey);
      const isToday = dateKey === todayStr;
      const isFuture = dateKey > todayStr;

      let statusColor = 'bg-gray-200'; // Default / Future
      let statusText = '';
      
      if (isToday) {
         if (record) {
             statusColor = 'bg-green-100 border-green-200';
             statusText = 'Working';
         } else {
             statusColor = 'bg-white border-brand-200 ring-2 ring-brand-100';
             statusText = 'Today';
         }
      } else if (!isFuture) {
         if (record?.status === 'PRESENT') {
             statusColor = 'bg-green-50 border-green-200';
         } else if (record?.status === 'ABSENT') {
             statusColor = 'bg-red-50 border-red-200';
         } else {
             statusColor = 'bg-gray-50 border-gray-200'; // Weekend or no data
         }
      }

      days.push(
        <div key={i} className={`h-24 p-2 border rounded-lg transition-all hover:shadow-md flex flex-col justify-between ${statusColor} group relative`}>
          <div className="flex justify-between items-start">
            <span className={`text-sm font-bold ${isToday ? 'text-brand-600' : 'text-gray-700'}`}>{i}</span>
            {!isFuture && (
               <div className={`w-2.5 h-2.5 rounded-full ${record?.status === 'PRESENT' || (isToday && record) ? 'bg-green-500' : record?.status === 'ABSENT' ? 'bg-red-500' : 'bg-gray-300'}`}></div>
            )}
          </div>

          {/* Details */}
          {!isFuture && (
            <div className="text-[10px] space-y-0.5 mt-1">
               {record ? (
                 <>
                    <p className="font-semibold text-gray-700 flex justify-between">
                       <span>IN:</span> <span>{record.inTime}</span>
                    </p>
                    {record.outTime && (
                       <p className="text-gray-500 flex justify-between">
                          <span>OUT:</span> <span>{record.outTime}</span>
                       </p>
                    )}
                    {record.totalHours && (
                        <p className="font-bold text-brand-600 mt-1 pt-1 border-t border-gray-200/50 text-center">
                            {record.totalHours} Hrs
                        </p>
                    )}
                 </>
               ) : (
                  !isFuture && <p className="text-red-400 text-center mt-2 font-medium">Absent</p>
               )}
            </div>
          )}
        </div>
      );
    }

    return days;
  };

  return (
    <div className="space-y-6">
      
      {/* --- BUSINESS TOURS SECTION --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-6">
           <h2 className="text-xl font-bold text-gray-800 flex items-center">
             <Plane className="mr-2 text-brand-500" /> 
             Business Tours
           </h2>
           <button 
             onClick={() => setShowTourModal(true)}
             className="bg-brand-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-brand-700 flex items-center space-x-2 text-sm"
           >
             <Plus size={16} /> <span>Request Tour</span>
           </button>
        </div>

        {/* Active Tours List */}
        <div className="space-y-4">
           {tours.length === 0 ? (
               <p className="text-gray-400 text-sm italic text-center py-4">No active business tours.</p>
           ) : (
               tours.map(tour => {
                   const tourUser = users.find(u => u.id === tour.userId);
                   const isOngoing = new Date() >= new Date(tour.startDate) && new Date() <= new Date(tour.endDate);
                   
                   return (
                       <div key={tour.id} className={`flex items-center justify-between p-4 rounded-xl border ${isOngoing ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                          <div className="flex items-center space-x-4">
                              <img src={tourUser?.avatar} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" alt={tourUser?.name} />
                              <div>
                                  <h4 className="font-bold text-gray-800">{tourUser?.name}</h4>
                                  <p className="text-xs text-gray-500 flex items-center">
                                     <MapPin size={12} className="mr-1"/> {tour.location}
                                  </p>
                              </div>
                          </div>
                          <div className="text-right">
                              <div className="text-sm font-semibold text-gray-700 bg-white px-3 py-1 rounded-full shadow-sm inline-block mb-1">
                                 {tour.startDate} <span className="text-gray-400 mx-1">to</span> {tour.endDate}
                              </div>
                              <p className="text-xs text-gray-500">{tour.purpose}</p>
                          </div>
                       </div>
                   );
               })
           )}
        </div>
      </div>

      {/* --- ATTENDANCE CALENDAR SECTION --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
         <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center">
              <Calendar className="mr-2 text-green-600" />
              Attendance Log
            </h2>

            <div className="flex items-center space-x-4">
               {/* Admin User Selector */}
               {canViewOthers && (
                   <div className="relative">
                       <UserIcon className="absolute left-2 top-2.5 text-gray-400" size={16} />
                       <select 
                         value={viewUserId}
                         onChange={(e) => setViewUserId(e.target.value)}
                         className="pl-8 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none bg-gray-50"
                       >
                         {users.map(u => (
                             <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                         ))}
                       </select>
                   </div>
               )}

               {/* Month Navigator */}
               <div className="flex items-center bg-gray-100 rounded-lg p-1">
                  <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-white rounded shadow-sm transition"><ChevronLeft size={18} /></button>
                  <span className="px-4 font-bold text-sm w-32 text-center">
                      {selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </span>
                  <button onClick={() => changeMonth(1)} className="p-1 hover:bg-white rounded shadow-sm transition"><ChevronRight size={18} /></button>
               </div>

               {/* Download Report (Admin) */}
               {canViewOthers && (
                  <button 
                    onClick={handleDownloadReport}
                    className="flex items-center space-x-2 text-gray-600 hover:text-brand-600 text-sm font-medium border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50"
                  >
                    <Download size={16} />
                    <span className="hidden md:inline">Export CSV</span>
                  </button>
               )}
            </div>
         </div>

         {/* Calendar Grid */}
         <div className="grid grid-cols-7 gap-4 mb-2">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <div key={i} className="text-center text-xs font-bold text-gray-400 uppercase">{d}</div>
            ))}
         </div>
         <div className="grid grid-cols-7 gap-2 md:gap-4">
            {renderCalendar()}
         </div>
         
         <div className="mt-6 flex items-center justify-end space-x-6 text-xs text-gray-500">
             <div className="flex items-center"><div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div> Present (Work)</div>
             <div className="flex items-center"><div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div> Absent (Off)</div>
         </div>
      </div>

      {/* Tour Request Modal */}
      {showTourModal && (
         <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
             <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-float">
                 <h3 className="text-xl font-bold mb-4">Request Business Tour</h3>
                 <form onSubmit={handleTourSubmit} className="space-y-4">
                     <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                         <input required type="text" className="w-full border rounded-lg px-3 py-2" value={tourForm.location} onChange={e => setTourForm({...tourForm, location: e.target.value})} placeholder="City, Country" />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                            <input required type="date" className="w-full border rounded-lg px-3 py-2" value={tourForm.startDate} onChange={e => setTourForm({...tourForm, startDate: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                            <input required type="date" className="w-full border rounded-lg px-3 py-2" value={tourForm.endDate} onChange={e => setTourForm({...tourForm, endDate: e.target.value})} />
                        </div>
                     </div>
                     <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Purpose / Description</label>
                         <textarea required className="w-full border rounded-lg px-3 py-2 h-24" value={tourForm.purpose} onChange={e => setTourForm({...tourForm, purpose: e.target.value})} placeholder="Client meeting, Conference, etc." />
                     </div>
                     <div className="flex justify-end space-x-3 pt-2">
                         <button type="button" onClick={() => setShowTourModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                         <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700">Submit Request</button>
                     </div>
                 </form>
             </div>
         </div>
      )}

    </div>
  );
};
