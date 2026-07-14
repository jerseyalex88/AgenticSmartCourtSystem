import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';
import { useAlert } from '../context/AlertContext';

interface ActiveBooking {
  id: string;
  courtName: string;
  branchName: string;
  slotTime: string;
  durationMinutes: number;
}

interface PendingStandby {
  id: string;
  preferredWindow: string;
  isResolved: boolean;
}

interface MatrixSlot {
  courtId: string;
  courtName: string;
  startTimeUtc: string;
  endTimeUtc: string;
  isAvailable: boolean;
  bookedPlayerName: string | null;
}

interface DayMatrix {
  dateString: string; // Formatting standard: YYYY-MM-DD
  slots: MatrixSlot[];
}

export function PlayerBookingManager() {
  const [myBookings, setMyBookings] = useState<ActiveBooking[]>([]);
  const [myStandby, setMyStandby] = useState<PendingStandby[]>([]);
  const [matrixData, setMatrixData] = useState<DayMatrix[]>([]);
  
  // Set default starting calendar hook to today's date
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const { showAlert } = useAlert();

  // CORE DATA SYNC TIMELINE PIPELINE
  const fetchPlayerDashboardTelemetry = async () => {
    setLoading(true);
    try {
      // Queries the automated 7-day range matrix from your Model B C# engine
      const matrixRes = await apiClient.get<DayMatrix[]>(`/playerbooking/available-matrix?startDate=${startDate}`);
      setMatrixData(matrixRes.data);

      const bookingsRes = await apiClient.get<ActiveBooking[]>('/playerbooking/my-reservations');
      const standbyRes = await apiClient.get<PendingStandby[]>('/playerbooking/my-standby');
            
      setMyBookings(bookingsRes.data);
      setMyStandby(standbyRes.data);
    } catch (err) {
      console.error('Failed to sync player schedule frameworks.', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayerDashboardTelemetry();
  }, [startDate]);

  // ACTION 1: TRANSACTION COMMITTING FOR MODEL B INSERTIONS
  const handleClaimDynamicSlotClick = (slot: MatrixSlot) => {
    showAlert({
      title: 'Lock In Court Booking?',
      message: `Would you like to reserve ${slot.courtName} for a standard 60-minute interval starting at ${new Date(slot.startTimeUtc).toLocaleTimeString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}?`,
      type: 'success',
      onConfirm: async () => {
        try {
          await apiClient.post('/playerbooking/claim-dynamic', {
            courtId: slot.courtId,
            courtName: slot.courtName,
            startTimeUtc: slot.startTimeUtc
          });

          showAlert({
            title: 'Reservation Secured!',
            message: 'Your match row has been committed live to PostgreSQL transaction logs.',
            type: 'success'
          });
          await fetchPlayerDashboardTelemetry();
        } catch (err: any) {
          const errMsg = err.response?.data?.message || 'This slot was just claimed or is no longer available.';
          showAlert({ title: 'Booking Intercepted', message: errMsg, type: 'error' });
        }
      }
    });
  };

  // ACTION 2: CANCELLATION DELETION PIPELINE
  const handleReleaseSlotClick = (bookingId: string, courtName: string) => {
    showAlert({
      title: 'Release Booking Slot?',
      message: `Are you absolutely certain you want to cancel your reservation for ${courtName}?`,
      type: 'warning',
      onConfirm: async () => {
        try {
          await apiClient.delete(`/PlayerBooking/release/${bookingId}`);
          showAlert({ title: 'Slot Released Cleanly', message: 'Your upcoming match window was cleared.', type: 'success' });
          await fetchPlayerDashboardTelemetry();
        } catch (err) {
          showAlert({ title: 'Cancellation Intercepted', message: 'The server rejected this release command.', type: 'error' });
        }
      }
    });
  };

  const activeDayMatrix = matrixData[selectedDayIndex];
  return (
    <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl font-mono text-xs text-slate-300">
      
      {/* HEADER META DESCRIPTIONS */}
      <div className="border-b border-slate-800 pb-4 mb-6">
        <h2 className="text-sm font-black text-slate-100 uppercase tracking-wider">⏱️ Player Booking Lifecycle Center</h2>
        <p className="text-slate-400 mt-1">Manage your active court allocations, verify standby queue states, and explore live availability grids.</p>
      </div>

      {loading && matrixData.length === 0 ? (
        <div className="p-12 text-center text-slate-600 animate-pulse">Syncing personal booking matrices...</div>
      ) : (
        <div className="space-y-8">
          
          {/* CONFIRMED RESERVATIONS AND OVERFLOW STANDBY ROWS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-[10px] font-black tracking-widest uppercase text-slate-400">📅 Confirmed Court Allocations</h3>
              {myBookings.length === 0 ? (
                <div className="p-6 bg-slate-950 border border-slate-800 rounded-xl text-center text-slate-600 italic">You have no upcoming confirmed matches.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myBookings.map((b) => (
                    <div key={b.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col justify-between hover:border-slate-700 transition">
                      <div>
                        <div className="text-xs font-black text-slate-100 uppercase tracking-wide">{b.courtName}</div>
                        <div className="text-slate-500 mt-1 text-[11px]">⏱️ Schedule: {new Date(b.slotTime).toLocaleString()}</div>
                      </div>
                      <button onClick={() => handleReleaseSlotClick(b.id, b.courtName)} className="mt-4 w-full bg-slate-900 border border-slate-800 hover:bg-rose-950/30 text-rose-400 font-bold py-1.5 rounded-lg uppercase text-[10px] transition">❌ Cancel Slot</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <h3 className="text-[10px] font-black tracking-widest uppercase text-amber-400 border-b border-slate-800 pb-2 mb-3">⏳ Standby Shadow Queue Monitors</h3>
              {myStandby.length === 0 ? (
                <div className="text-slate-600 italic py-4 text-center">Your profile is completely clear of standby queues.</div>
              ) : (
                <div className="space-y-3">
                  {myStandby.map((s) => (
                    <div key={s.id} className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex items-center justify-between">
                      <div><div className="font-bold text-slate-200">Standby Request Token</div><div className="text-[10px] text-slate-500 mt-0.5">Window: {s.preferredWindow}</div></div>
                      <span className="px-2 py-0.5 bg-amber-950 text-amber-400 border border-amber-800 rounded text-[9px] font-black uppercase animate-pulse">Awaiting AI Fix</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* LOWER GRID: THE 7-DAY DYNAMIC GRID SCHEDULER */}
          <div className="border-t border-slate-800 pt-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-4">
              <div>
                <h3 className="text-[10px] font-black tracking-widest uppercase text-emerald-400">⚡ 7-Day Live Court Availability Matrix Grid</h3>
                <p className="text-slate-400 mt-0.5 text-[11px]">Select a day tab to view available intervals. Unavailable or booked slots appear greyed out.</p>
              </div>
              
              {/* PRIMARY CALENDAR PICKER LINK */}
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setSelectedDayIndex(0); // Reset tab back to Day 1 on change
                }}
                className="bg-slate-950 border border-slate-800 text-slate-200 font-bold p-2 rounded-xl focus:outline-none focus:border-slate-700 transition self-start md:self-auto"
              />
            </div>

            {/* HORIZONTAL 7-DAY TAB SELECTION STRIP */}
            {matrixData.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-4 bg-slate-950 p-1.5 rounded-xl border border-slate-800 overflow-x-auto">
                {matrixData.map((day, idx) => {
                  // Standardizing dates across locales using ISO standard fallback strings
                  const weekday = new Date(day.dateString + 'T00:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
                  return (
                    <button
                      key={day.dateString}
                      onClick={() => setSelectedDayIndex(idx)}
                      className={`flex-1 min-w-[95px] text-center py-2 rounded-lg font-bold uppercase transition text-[10px] ${
                        selectedDayIndex === idx
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                      }`}
                    >
                      {weekday}
                    </button>
                  );
                })}
              </div>
            )}

            {/* HOURLY TIME BLOCK TILES CANVASES */}
            {activeDayMatrix && activeDayMatrix.slots.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {activeDayMatrix.slots.map((slot, index) => (
                  <button
                    key={`${slot.courtId}_${index}`}
                    disabled={!slot.isAvailable}
                    onClick={() => handleClaimDynamicSlotClick(slot)}
                    className={`p-3 border rounded-xl text-left transition flex flex-col justify-between group h-24 ${
                      slot.isAvailable
                        ? 'bg-slate-950 border-slate-800 hover:border-emerald-600 hover:bg-emerald-950/10 cursor-pointer'
                        : 'bg-slate-950/40 border-slate-900 text-slate-600 cursor-not-allowed select-none opacity-40'
                    }`}
                  >
                    <div>
                      <div className={`font-black tracking-wide ${slot.isAvailable ? 'text-slate-200 group-hover:text-emerald-400' : 'text-slate-600'}`}>
                        {slot.courtName}
                      </div>
                      <div className="text-[11px] mt-1 text-slate-400 flex items-center gap-1">
                        <span>🕒</span>
                        <span className="font-bold text-slate-300">
                          {new Date(slot.startTimeUtc).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-slate-500">@</span>
                        <span>
                          {new Date(slot.startTimeUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* DYNAMIC FILL FOOTER ELEMENT MARKUPS */}
                    <div className={`mt-2 w-full text-center font-bold py-1 rounded-lg uppercase text-[9px] tracking-wider border transition ${
                      slot.isAvailable
                        ? 'bg-slate-900 border-slate-800 group-hover:border-emerald-600 text-slate-400 group-hover:text-emerald-400'
                        : 'bg-transparent border-transparent text-slate-700'
                    }`}>
                      {slot.isAvailable ? '⚡ Reserve Slot' : `🔒 Booked (${slot.bookedPlayerName?.split('@')[0]})`}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8 bg-slate-950 border border-slate-800 rounded-xl text-center text-slate-600 italic">
                Awaiting matrix stream data layout...
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
