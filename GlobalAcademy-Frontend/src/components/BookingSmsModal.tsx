import React, { useState } from 'react';

interface BookingSmsModalProps {
  isOpen: boolean;
  targetPhone: string;
  isSubmitting: boolean;
  onConfirm: (pinCode: string) => void;
  onCancel: () => void;
}

export default function BookingSmsModal({ isOpen, targetPhone, isSubmitting, onConfirm, onCancel }: BookingSmsModalProps) {
  const [pinCode, setPinCode] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinCode.length === 4) {
      onConfirm(pinCode);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white border border-gray-200 p-6 max-w-sm w-full shadow-2xl text-slate-900 font-sans text-xs space-y-5">
        
        {/* Header Icon & Branding */}
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 bg-purple-100 border border-purple-300 text-purple-600 text-sm font-black">
            📱
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">Anti-Scalper Verification</h3>
            <p className="text-slate-500 mt-0.5">A security check parameter has been triggered.</p>
          </div>
        </div>

        {/* Narrative Context */}
        <p className="text-slate-600 leading-normal">
          We have dispatched a short-lived 4-digit validation PIN code to your verified profile mobile phone number string: 
          <strong className="text-slate-900 ml-1 font-mono">{targetPhone}</strong>
        </p>

        {/* PIN Form Input Area */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">
              Enter 4-Digit Booking PIN
            </label>
            <input
              type="text"
              required
              maxLength={4}
              disabled={isSubmitting}
              value={pinCode}
              onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))} // Restricts inputs to numeric digits
              placeholder="0000"
              className="w-full bg-gray-50 border border-gray-300 tracking-[0.75em] text-center text-xl p-2.5 text-purple-950 font-black focus:outline-none focus:border-purple-500 transition placeholder:tracking-normal placeholder:font-medium placeholder:text-sm"
            />
          </div>

          {/* Action Trigger Buttons Container */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="w-1/2 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-40 text-slate-700 font-bold py-2 px-4 uppercase tracking-wider transition text-center"
            >
              Abort
            </button>
            <button
              type="submit"
              disabled={isSubmitting || pinCode.length !== 4}
              className="w-1/2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-100 disabled:text-gray-400 font-bold py-2 px-4 text-white uppercase tracking-wider transition text-center flex items-center justify-center space-x-1"
            >
              {isSubmitting ? (
                <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>Confirm</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
