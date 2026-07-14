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

export function PlayerBookingManager() {
  const [myBookings, setMyBookings] = useState<ActiveBooking[]>([]);
  const [myStandby, setMyStandby] = useState<PendingStandby[]>([]);
  const [loading, setLoading] = useState(false);
  const { showAlert } = useAlert();

  // SYNC UTILITY: Pull player-specific reservations within active academy boundary limits
  const fetchMyBookingDataStream = async () => {
    setLoading(true);
    try {
      // Backend routes look up identity context implicitly using encrypted JWT claims tokens
      const bookingsRes = await apiClient.get<ActiveBooking[]>('/PlayerBooking/my-reservations');
      const standbyRes = await apiClient.get<PendingStandby[]>('/PlayerBooking/my-standby');
      
      setMyBookings(bookingsRes.data);
      setMyStandby(standbyRes.data);
    } catch (err) {
      console.error('Failed to sync player booking ledger records.', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyBookingDataStream();
  }, []);

  // DESTRUCTIVE LIFECYCLE ACTION: Cancel a reservation and fire multi-tenant release routines
  const handleReleaseSlotClick = (bookingId: string, courtName: string) => {
    showAlert({
      title: 'Release Booking Matrix Slot?',
      message: `Are you absolutely certain you want to cancel your reservation for ${courtName}? This slot will instantly re-enter the public marketplace pool or be snapped up by the autonomous AI Match-Saver standby queue.`,
      type: 'warning',
      onConfirm: async () => {
        try {
          await apiClient.delete(`/player/bookings/release/${bookingId}`);
          showAlert({
            title: 'Slot Released Cleanly',
            message: 'Your upcoming match window was cleared out of database registries. Balance updated.',
            type: 'success'
          });
          await fetchMyBookingDataStream(); // Instantly refresh telemetry layout rows
        } catch (err) {
          showAlert({
            title: 'Cancellation Intercepted',
            message: 'The server rejected this release command. Verify lock-out threshold limits (e.g. 24h rules).',
            type: 'error'
          });
        }
      }
    });
  };

  return (
    <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl font-mono text-xs text-slate-300">
      
      {/* SECTION HEADER TEMPLATE MAP */}
      <div className="border-b border-slate-800 pb-4 mb-6">
        <h2 className="text-sm font-black text-slate-100 uppercase tracking-wider">⏱️ Player Booking Lifecycle Center</h2>
        <p className="text-slate-400 mt-1">Manage your active court allocations, verify standby queue states, and release upcoming windows.</p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-600 animate-pulse">Syncing personal booking matrices...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* COLUMN PANEL 1 & 2: ACTIVE RELEASABLE RESERVATIONS LEDGER */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-[10px] font-black tracking-widest uppercase text-slate-400 mb-2">📅 Confirmed Court Allocations</h3>
            
            {myBookings.length === 0 ? (
              <div className="p-8 bg-slate-950 border border-slate-800 rounded-xl text-center text-slate-600 italic">
                You have no upcoming confirmed matches locked down at this academy branch partition.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myBookings.map((b) => (
                  <div key={b.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col justify-between hover:border-slate-700 transition">
                    <div>
                      <div className="text-xs font-black text-slate-100 uppercase tracking-wide">{b.courtName}</div>
                      <div className="text-slate-400 mt-1 text-[11px]">🏢 Location: {b.branchName}</div>
                      <div className="text-slate-500 mt-1 text-[11px]">⏱️ Schedule: {new Date(b.slotTime).toLocaleString()} ({b.durationMinutes} mins)</div>
                    </div>
                    
                    <button
                      onClick={() => handleReleaseSlotClick(b.id, b.courtName)}
                      className="mt-4 w-full bg-slate-900 border border-slate-800 hover:bg-rose-950/30 hover:border-rose-900 text-rose-400 font-bold py-1.5 px-3 rounded-lg uppercase tracking-wider text-[10px] transition"
                    >
                      ❌ Cancel & Release Slot
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* COLUMN PANEL 3: STANDBY LOG AND REAL-TIME TELEMETRY STATUS */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <h3 className="text-[10px] font-black tracking-widest uppercase text-amber-400 mb-3 border-b border-slate-800 pb-2">
              ⏳ Standby Shadow Queue Monitors
            </h3>

            {myStandby.length === 0 ? (
              <div className="text-slate-600 italic py-4 text-center">
                Your account is currently completely clear. You are not sitting in any weather or overflow standby queues.
              </div>
            ) : (
              <div className="space-y-3">
                {myStandby.map((s) => (
                  <div key={s.id} className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-200">Standby Request Token</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Window: {s.preferredWindow}</div>
                    </div>
                    <span className="px-2 py-0.5 bg-amber-950 text-amber-400 border border-amber-800 rounded text-[9px] font-black uppercase tracking-wider animate-pulse">
                      Awaiting AI Fix
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
