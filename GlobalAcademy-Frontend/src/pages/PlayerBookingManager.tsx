import { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';
import { useAlert } from '../context/AlertContext';

interface ActiveBooking {
  id: string;
  courtName: string;
  branchName: string;
  slotTimeDisplay: string; 
  durationMinutes: number;
  isPaid: boolean;
  isExpired: boolean;
  bookedPlayerName: string | null;
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
  branchLocalTimeDisplay: string; 
  branchLocalDateDisplay: string; 
  isAvailable: boolean;
  bookedPlayerName: string | null;
}

interface DayMatrix {
  dateString: string; 
  slots: MatrixSlot[];
}

export function PlayerBookingManager() {
  const [myBookings, setMyBookings] = useState<ActiveBooking[]>([]);
  const [myStandby, setMyStandby] = useState<PendingStandby[]>([]);
  const [matrixData, setMatrixData] = useState<DayMatrix[]>([]);
  
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { showAlert } = useAlert();
  const fetchPlayerDashboardTelemetry = async () => {
    setLoading(true);
    try {
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
  }, [startDate, refreshTrigger]);

  useEffect(() => {
    (window as any).setDashboardGlobalDate = (newDateString: string) => {
      //console.log("📥 [PlayerBookingManager] Global hook caught payload:", newDateString);
      
      setTimeout(() => {
        //console.log("🔄 [PlayerBookingManager] Mutating state variable 'startDate' to:", newDateString);
        setStartDate(newDateString);
        setSelectedDayIndex(0); 
        setRefreshTrigger(prev => prev + 1);
      }, 0);
    };

    return () => {
      //console.log("🗑️ [PlayerBookingManager] Cleaning up global window handler hook.");
      (window as any).setDashboardGlobalDate = undefined;
    };
  }, []);
  const handleClaimDynamicSlotClick = (slot: MatrixSlot) => {
    showAlert({
      title: 'Lock In Court Booking?',
      message: `Would you like to reserve ${slot.courtName} for a standard 60-minute interval starting at ${slot.branchLocalTimeDisplay}?`,
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

    const handleReleaseSlotClick = (bookingId: string, courtName: string, slotTime: string) => {
    showAlert({
      title: 'Release Booking Slot?',
      message: `Are you absolutely certain you want to cancel your reservation for ${courtName} on ${slotTime}?`,
      type: 'warning',
      onConfirm: async () => {
        try {
          // 1. Dispatch the request to your newly compiled, reversal-hardened backend route
          const response = await apiClient.delete(`/PlayerBooking/release/${bookingId}`);
          
          // 2. Extract the detailed ledger audit statement text passed back by the server
          const serverSuccessMessage = response.data?.message || 'Your upcoming match window was cleared.';

          showAlert({ 
            title: 'Slot Released Cleanly', 
            message: serverSuccessMessage, // ◄--- Displays custom VOIDED or REFUNDED messages inline
            type: 'success' 
          });

          // 3. Refresh your primary user telemetry view grids
          await fetchPlayerDashboardTelemetry();

          // 4. Ambient window broadcast hook to update adjacent balance counters on the financial statement table
          if (typeof (window as any).refreshDashboardAllocationGrid === 'function') {
            (window as any).refreshDashboardAllocationGrid();
          }
          
        } catch (err: any) {
          // 5. Extract specific business rule failures (e.g., your 24-hour player lockout rule text string)
          const serverErrorMessage = err.response?.data 
            || err.response?.data?.message 
            || 'The server rejected this release command.';

          showAlert({ 
            title: 'Cancellation Intercepted', 
            message: serverErrorMessage, // ◄--- Renders "Cancellation Locked: Less than 24 hours..." accurately
            type: 'error' 
          });
        }
      }
    });
  };

  const activeDayMatrix = matrixData[selectedDayIndex];

  return (
    <div className="space-y-6 font-sans">
      <div className="border-b border-slate-800 pb-4 mb-6">
        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">⏱️ Player Booking Lifecycle Center</h2>
        <p className="text-xs text-slate-500 mt-1 font-mono">Manage your active court allocations, verify standby queue states, and explore live availability grids.</p>
      </div>

      <div className="p-6 bg-white dark:bg-slate-100 border border-slate-300 shadow-lg shadow-purple-900/10 font-sans text-xs text-slate-700">

        {loading && matrixData.length === 0 ? (
          <div className="p-12 text-center text-slate-600 animate-pulse">Syncing personal booking matrices...</div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-3 space-y-4">
                <h3 className="text-[10px] font-black tracking-widest uppercase text-slate-600">📅 Confirmed Court Allocations</h3>
                {myBookings.length === 0 ? (
                  <div className="p-6 bg-white border border-slate-300 text-center text-slate-600 italic">You have no upcoming confirmed matches.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {myBookings.map((b) => (
                      <div key={b.id} className="bg-white border border-slate-300 p-4 flex flex-col justify-between hover:border-purple-500 transition shadow-md">
                        <div>
                          <div className="text-xs font-black text-slate-800 uppercase tracking-wide">{b.courtName}</div>
                          <div className="text-slate-700 mt-1 text-[11px]">⏱️ Schedule: {b.slotTimeDisplay}</div>
                          {b.isPaid && !b.isExpired && (
                            <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-purple-600 bg-purple-100 border border-purple-300">
                              ✓ Paid Secured for {b.bookedPlayerName}
                            </span>
                          )}
                          {b.isExpired && (
                            <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-blue-600 bg-blue-100 border border-blue-300">
                              ✓ Expired
                            </span>
                          )}
                        </div>
                        {!b.isPaid && !b.isExpired && (
                        <button onClick={() => handleReleaseSlotClick(b.id, b.courtName, b.slotTimeDisplay)} 
                          disabled={b.isPaid || b.isExpired}
                          // className="mt-4 w-full bg-slate-200 border border-slate-300 hover:bg-rose-100 text-rose-600 font-bold py-1.5 uppercase text-[10px] transition focus:ring-2 focus:ring-rose-500/50"
                          className={`text-[10px] font-bold uppercase px-1.5 py-2 transition-all ${
                              (b.isPaid || b.isExpired)
                                ? 'bg-slate-100 dark:bg-slate-800/40 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-transparent shadow-none'
                                : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 hover:bg-rose-600 hover:text-white transition'
                            }`}
                          title={
                              b.isExpired ? "Historical past bookings cannot be altered." :
                              b.isPaid ? "Paid slots are locked. Please contact an Academy Director for a refund override." : "Cancel this active court reservation"
                            }
                          >❌ Cancel Slot</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {myStandby.length > 0 && (
              <div className="bg-slate-100 border border-slate-300 p-4 shadow-md">
                <h3 className="text-[10px] font-black tracking-widest uppercase text-amber-600 border-b border-slate-300 pb-2 mb-3">⏳ Standby Shadow Queue Monitors</h3>
                {myStandby.length === 0 ? (
                  <div className="text-slate-600 italic py-4 text-center">Your profile is completely clear of standby queues.</div>
                ) : (
                  <div className="space-y-3">
                    {myStandby.map((s) => (
                      <div key={s.id} className="bg-white border border-slate-300 p-3 flex items-center justify-between">
                        <div><div className="font-bold text-slate-800">Standby Request Token</div><div className="text-[10px] text-slate-600 mt-0.5">Window: {s.preferredWindow}</div></div>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-600 border border-amber-300 text-[9px] font-black uppercase animate-pulse">Awaiting AI Fix</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}

            </div>
            <div className="border-t border-slate-800 pt-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-4">
                <div>
                  <h3 className="text-[10px] font-black tracking-widest uppercase text-purple-600">⚡ 7-Day Live Court Availability Matrix Grid</h3>
                  <p className="text-slate-600 mt-0.5 text-[11px]">Select a day tab to view available intervals. Unavailable or booked slots appear greyed out.</p>
                </div>
                
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setSelectedDayIndex(0); 
                  }}
                  className="bg-white border border-slate-300 text-slate-800 font-bold p-2 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition self-start md:self-auto"
                />
              </div>

              {matrixData.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4 bg-slate-100 p-1.5 border border-slate-300 overflow-x-auto">
                  {matrixData.map((day, idx) => {
                    const weekday = new Date(day.dateString + 'T00:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
                    return (
                      <button
                        key={day.dateString}
                        onClick={() => setSelectedDayIndex(idx)}
                        className={`flex-1 min-w-[95px] text-center py-2 font-bold uppercase transition text-[10px] ${
                          selectedDayIndex === idx
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20'
                            : 'text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                        }`}
                      >
                        {weekday}
                      </button>
                    );
                  })}
                </div>
              )}

              {activeDayMatrix && activeDayMatrix.slots.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {activeDayMatrix.slots.map((slot, index) => (
                    <button
                      key={`${slot.courtId}_${index}`}
                      disabled={!slot.isAvailable}
                      onClick={() => handleClaimDynamicSlotClick(slot)}
                      className={`p-3 border text-left transition flex flex-col justify-between group h-24 ${
                        slot.isAvailable
                          ? 'bg-slate-100 border-slate-300 hover:border-purple-500 hover:bg-purple-50 cursor-pointer shadow-md'
                          : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed select-none opacity-40'
                      }`}
                    >
                      <div>
                        <div className={`font-black tracking-wide transition-colors ${slot.isAvailable ? 'text-slate-800 group-hover:text-purple-600' : 'text-slate-400'}`}>
                          {slot.courtName}
                        </div>
                        <div className="text-[11px] mt-1 text-slate-600 flex items-center gap-1">
                          <span>🕒</span>
                          <span className="font-bold text-slate-700">{slot.branchLocalDateDisplay}</span>
                          <span className="text-slate-500">@</span>
                          <span>{slot.branchLocalTimeDisplay}</span>
                        </div>
                      </div>

                      <div className={`mt-2 w-full text-center font-bold py-1 uppercase text-[9px] tracking-wider border transition ${
                        slot.isAvailable
                          ? 'bg-white border-slate-300 group-hover:border-purple-500 text-slate-600 group-hover:text-purple-600'
                          : 'bg-transparent border-transparent text-slate-400'
                      }`}>
                        {slot.isAvailable ? '⚡ Reserve Slot' : `🔒 Booked (${slot.bookedPlayerName?.split('@')[0]})`}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-8 bg-white border border-slate-300 text-center text-slate-600 italic">
                  Awaiting matrix stream data layout...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
