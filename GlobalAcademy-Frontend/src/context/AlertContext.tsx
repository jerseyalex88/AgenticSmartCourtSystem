import React, { createContext, useContext, useState, type ReactNode } from 'react';

type AlertType = 'info' | 'success' | 'warning' | 'error' | 'sms';

interface AlertOptions {
  title: string;
  message: string;
  type?: AlertType;
  onConfirm?: () => void;
}

interface AlertContextType {
  showAlert: (options: AlertOptions) => void;
  closeAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: ReactNode }) {
  const [activeAlert, setActiveAlert] = useState<AlertOptions | null>(null);

  const showAlert = (options: AlertOptions) => {
    setActiveAlert({ ...options, type: options.type || 'info' });
  };

  const closeAlert = () => {
    setActiveAlert(null);
  };

  return (
    <AlertContext.Provider value={{ showAlert, closeAlert }}>
      {children}
      
      {/* UNIVERSAL MODAL POPUP PORTAL OVERLAY CONTAINER */}
      {activeAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-250/80 font-mono text-xs animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-scale-up">
            
            {/* MODAL HEADER BLOCK MATRICES */}
            <div className="flex items-center gap-2 mb-3 border-b border-slate-800 pb-3">
              <span className="text-sm">
                {activeAlert.type === 'success' && '✅'}
                {activeAlert.type === 'error' && '🚨'}
                {activeAlert.type === 'warning' && '⚠️'}
                {activeAlert.type === 'sms' && '💬'}
                {activeAlert.type === 'info' && '⚙️'}
              </span>
              <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                {activeAlert.title}
              </h3>
            </div>

            {/* MODAL WORKSPACE BODY MATERIAL */}
            <div className="text-slate-300 leading-relaxed whitespace-pre-wrap mb-6 font-sans">
              {activeAlert.message}
            </div>

            {/* MODAL INTERACTIVE CONTROLS RECTIFIER CONTAINER */}
            <div className="flex gap-2 justify-end">
              {activeAlert.onConfirm && (
                <button
                  onClick={closeAlert}
                  className="px-3 py-1.5 rounded-lg font-bold text-slate-400 hover:bg-slate-800 transition uppercase text-[10px]"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => {
                  if (activeAlert.onConfirm) activeAlert.onConfirm();
                  closeAlert();
                }}
                className={`px-4 py-1.5 rounded-lg font-bold uppercase tracking-wider text-[10px] transition ${
                  activeAlert.type === 'error' ? 'bg-rose-600 hover:bg-rose-500 text-white' :
                  activeAlert.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' :
                  activeAlert.type === 'sms' ? 'bg-indigo-600 hover:bg-indigo-500 text-white' :
                  'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                {activeAlert.onConfirm ? 'Confirm Action' : 'Dismiss Output'}
              </button>
            </div>

          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) throw new Error('useAlert must be executed directly inside an AlertProvider wrapper block.');
  return context;
}
