import { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';
import { Loader } from '@googlemaps/js-api-loader';

interface Branch {
  id: string;
  name: string;
  description: string;
  timeZoneId: string;
  latitude?: number;   // 🚀 SYNCED OVERRIDE
  longitude?: number; // 🚀 SYNCED OVERRIDE
}

interface Court {
  id: string;
  branchId: string;
  name: string;
  description: string;
  surfaceType: string;
  isIndoor: boolean;
  status: string;                           // 🚀 SYNCED OVERRIDE
  dryCoefficient: number;
  estimatedReopenTimeUtc: string | null;     // 🚀 SYNCED OVERRIDE
  aggregateMinutesPlayed: number;           // 🚀 SYNCED OVERRIDE
  maintenanceThresholdMinutes: number;      // 🚀 SYNCED OVERRIDE
  floodlightState: string;                  // 🚀 SYNCED OVERRIDE
  isDecommissioned: boolean;                // 🚀 SYNCED OVERRIDE
}

export default function CourtsDashboard() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [courts, setCourts] = useState<Court[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const [showBranchModal, setShowBranchModal] = useState<boolean>(false);
  const [showCourtModal, setShowCourtModal] = useState<boolean>(false);

  const [showMapModal, setShowMapModal] = useState<boolean>(false);
  const [mapLoading, setMapLoading] = useState<boolean>(false);
  
  const [isEditingBranch, setIsEditingBranch] = useState<boolean>(false);
  const [editingCourtId, setEditingCourtId] = useState<string | null>(null);

  const [newBranch, setNewBranch] = useState({ name: '', description: '', timeZoneId: 'Europe/London' });
  const [editBranchData, setEditBranchData] = useState({ 
    name: '', 
    description: '', 
    timeZoneId: 'Europe/London',
    latitude: 51.5074,  // 🚀 ADDED WITH DEFAULT FALLBACKS
    longitude: -0.1278  // 🚀 ADDED WITH DEFAULT FALLBACKS
  });
  
  const [newCourt, setNewCourt] = useState({ name: '', description: '', surfaceType: 'Hard', isIndoor: false, dryCoefficient: 1.0 });
  
  const [editCourtData, setEditCourtData] = useState({
    name: '',
    description: '',
    surfaceType: 'Hard',
    isIndoor: false,
    dryCoefficient: 1.0,
    status: 'Open',                           // 🚀 ADDED
    estimatedReopenTimeUtc: '',               // 🚀 ADDED
    aggregateMinutesPlayed: 0,                // 🚀 ADDED
    maintenanceThresholdMinutes: 270,         // 🚀 ADDED
    floodlightState: 'Off',                   // 🚀 ADDED
    isDecommissioned: false                  // 🚀 ADDED
  });

  // FIXED FEATURE EXTENSION: Tracks the active court entity targeted for deletion
  const [courtToDeleteId, setCourtToDeleteId] = useState<string | null>(null);

  const [weatherData, setWeatherData] = useState<{ temp: number; text: string } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(false);

  // 🚀 Asynchronously pulls live climate telemetry based on coordinate pins
  const fetchRealTimeOutdoorTelemetry = async (lat: number, lng: number) => {
    if (!lat || !lng) return;
    setWeatherLoading(true);
    try {
      // Open-Meteo provides free, high-density weather metrics without requiring API keys or billing passes
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data && data.current_weather) {
        const rawTemp = data.current_weather.temperature;
        const weatherCode = data.current_weather.weathercode;
        // console.log(`🌤️ [WEATHER TELEMETRY]: Lat=${lat}, Lng=${lng}, Temp=${rawTemp}°C, Code=${weatherCode}`);
        // Map standard WMO meteorological weather codes to clean, scannable visual emojis
        let conditionText = "Clear Sky ☀️";
        if (weatherCode >= 1 && weatherCode <= 3) conditionText = "Mainly Clear 🌤️";
        else if (weatherCode >= 45 && weatherCode <= 48) conditionText = "Foggy 🌫️";
        else if (weatherCode >= 51 && weatherCode <= 67) conditionText = "Rainy / Drizzle 🌧️";
        else if (weatherCode >= 71 && weatherCode <= 77) conditionText = "Snow Showers ❄️";
        else if (weatherCode >= 80 && weatherCode <= 82) conditionText = "Rain Showers 🌦️";
        else if (weatherCode >= 95 && weatherCode <= 99) conditionText = "Thunderstorm ⛈️";
        
        setWeatherData({ temp: rawTemp, text: conditionText });
      }
    } catch (err) {
      console.error("Failed to acquire external environmental telemetry data matrix layers:", err);
      setWeatherData(null);
    } finally {
      setWeatherLoading(false);
    }
  };

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setActionError(null);
      const branchRes = await apiClient.get<Branch[]>('/Facility/branches');
      setBranches(branchRes.data);
      
      if (branchRes.data.length > 0 && !selectedBranchId) {
        const defaultBranch = branchRes.data[0];
        setSelectedBranchId(defaultBranch.id);
        setEditBranchData({
          name: defaultBranch.name,
          description: defaultBranch.description,
          timeZoneId: defaultBranch.timeZoneId,
          latitude: defaultBranch.latitude || 51.5074,   // 🚀 CAPTURE DATABASE LATITUDE
          longitude: defaultBranch.longitude || -0.1278  // 🚀 CAPTURE DATABASE LONGITUDE
        });
      }
    } catch (err: any) {
      setActionError('Failed to synchronize infrastructure branches list.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCourtsForSelectedBranch = async (branchId: string) => {
    if (!branchId) return;
    try {
      setActionError(null);
      const courtRes = await apiClient.get<Court[]>(`/Facility/branches/${branchId}/courts`);
      setCourts(courtRes.data);
    } catch (err: any) {
      setActionError('Failed to isolate target branch court asset metrics.');
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedBranchId) {
      fetchCourtsForSelectedBranch(selectedBranchId);
      const activeB = branches.find(b => b.id === selectedBranchId);
      if (activeB) {
        setEditBranchData({ 
          name: activeB.name, 
          description: activeB.description, 
          timeZoneId: activeB.timeZoneId,
          latitude: activeB.latitude || 51.5074,   // 🚀 RE-SYNC ON TOGGLE
          longitude: activeB.longitude || -0.1278 // 🚀 RE-SYNC ON TOGGLE
        });
        // 🚀 THE WEATHER TRIGGER INJECTION:
        // Instantly fire a live background metrics request over your fresh coordinate slots!
        fetchRealTimeOutdoorTelemetry(activeB.latitude || 33.7274, activeB.longitude || -116.3952);
      }
      setIsEditingBranch(false);
      setEditingCourtId(null);
    } else {
      setCourts([]);
    }
  }, [selectedBranchId]);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionError(null);
      const res = await apiClient.post<Branch>('/Facility/branches', newBranch);
      setBranches([...branches, res.data]);
      setSelectedBranchId(res.data.id);
      setShowBranchModal(false);
      setNewBranch({ name: '', description: '', timeZoneId: 'Europe/London' });
    } catch (err: any) {
      setActionError(err.response?.data || 'Could not persist branch node layout.');
    }
  };
  const handleUpdateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionError(null);
      
      // Assemble the clean, explicitly cast numeric request payload
      const payload = {
        name: editBranchData.name.trim(),
        description: editBranchData.description.trim(),
        timeZoneId: editBranchData.timeZoneId,
        latitude: parseFloat(String(editBranchData.latitude)) || 0.0,
        longitude: parseFloat(String(editBranchData.longitude)) || 0.0
      };

      await apiClient.put(`/Facility/branches/${selectedBranchId}`, payload);
      
      // 🚀 FIXED: Overwrite the active branches state list with your newly submitted coordinate params!
      setBranches(branches.map(b => b.id === selectedBranchId ? { ...b, ...payload } : b));
      setIsEditingBranch(false);
      alert('🗺️ Branch coordinates updated and synchronized successfully!');
    } catch (err: any) {
      setActionError(err.response?.data || 'Failed to update selected branch attributes.');
    }
  };

  const handleCreateCourt = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionError(null);
      const res = await apiClient.post<Court>('/Facility/courts', { branchId: selectedBranchId, ...newCourt });
      setCourts([...courts, res.data]);
      setShowCourtModal(false);
      setNewCourt({ name: '', description: '', surfaceType: 'Hard', isIndoor: false, dryCoefficient: 1.0 });
    } catch (err: any) {
      setActionError(err.response?.data || 'Failed to provision court asset row.');
    }
  };

  const handleBeginEditCourt = (court: Court) => {
    setEditingCourtId(court.id);
    setEditCourtData({
      name: court.name,
      description: court.description,
      surfaceType: court.surfaceType,
      isIndoor: court.isIndoor,
      dryCoefficient: court.dryCoefficient,
      status: court.status,
      estimatedReopenTimeUtc: court.estimatedReopenTimeUtc ? court.estimatedReopenTimeUtc.substring(0, 16) : '',
      aggregateMinutesPlayed: court.aggregateMinutesPlayed,
      maintenanceThresholdMinutes: court.maintenanceThresholdMinutes,
      floodlightState: court.floodlightState || 'Off',
      isDecommissioned: court.isDecommissioned || false
    });
  };

  const handleUpdateCourt = async (courtId: string) => {
    try {
      setActionError(null);

      // 🚀 FIXED: Assemble a clean, flattened serialization payload matching your backend expectations explicitly
      const payload = {
        name: editCourtData.name.trim(),
        description: editCourtData.description.trim(),
        surfaceType: editCourtData.surfaceType,
        isIndoor: editCourtData.isIndoor,
        dryCoefficient: parseFloat(String(editCourtData.dryCoefficient)) || 1.0,
        status: editCourtData.status,
        estimatedReopenTimeUtc: editCourtData.estimatedReopenTimeUtc ? new Date(editCourtData.estimatedReopenTimeUtc).toISOString() : null,
        aggregateMinutesPlayed: parseInt(String(editCourtData.aggregateMinutesPlayed)) || 0,
        maintenanceThresholdMinutes: parseInt(String(editCourtData.maintenanceThresholdMinutes)) || 270,
        floodlightState: editCourtData.floodlightState,
        isDecommissioned: editCourtData.isDecommissioned
      };

      await apiClient.put(`/Facility/courts/${courtId}`, payload);
      
      // Dynamically refresh local state grid values on successful callback completion
      setCourts(courts.map(c => c.id === courtId ? { ...c, ...payload, estimatedReopenTimeUtc: payload.estimatedReopenTimeUtc } : c));
      setEditingCourtId(null);
    } catch (err: any) {
      console.error('Court update override failed payload binding:', err);
      
      // 🚀 THE REACT CRASH PREVENTION FIX:
      // Safely extract string error codes out of the .NET object matrix instead of passing the raw error node to the state!
      const errorDetails = err.response?.data;
      if (errorDetails && typeof errorDetails === 'object' && errorDetails.title) {
        setActionError(`Validation Fault: ${errorDetails.title}. Check that all numeric values and thresholds conform to facility criteria.`);
      } else {
        setActionError(err.response?.data || err.message || 'Failed to preserve court configuration changes.');
      }
    }
  };

    // FIX: Instead of blocking the thread with window.confirm, open the custom overlay modal
  const handleTriggerPurgeModal = (courtId: string) => {
    setCourtToDeleteId(courtId);
  };

  const handleExecutePurgeAction = async () => {
    if (!courtToDeleteId) return;
    try {
      setActionError(null);
      await apiClient.delete(`/Facility/courts/${courtToDeleteId}`);
      setCourts(courts.filter(c => c.id !== courtToDeleteId));
      setCourtToDeleteId(null); // Close modal cleanly
    } catch (err: any) {
      setActionError('Decommission Failure: Unable to remove target court array position.');
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-xs font-mono text-slate-500">Querying Regional Facility Infrastructure Matrices...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-4 mb-6">
        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">🏟️ Core Asset Matrix</h2>
        <p className="text-xs text-slate-500 mt-1 font-mono">Manage branch and court provisions, deploy venue and explore court surface status.</p>
      </div>

      {actionError && (
        <div className="p-4 bg-rose-100 border border-rose-300 text-rose-600 text-xs font-medium flex items-center space-x-2">
          <span>⚠️</span> <span>{actionError}</span>
        </div>
      )}

      <div className="bg-white border border-slate-300 p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-800">Active Branch Location Node</label>
            {branches.length > 0 ? (
              <div className="flex items-center space-x-2">
                <select value={selectedBranchId} onChange={(e) => setSelectedBranchId(e.target.value)} 
                className="bg-white border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500 min-w-[200px]" >
                  {branches.map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}
                </select>
                {!isEditingBranch && (
                  <button onClick={() => setIsEditingBranch(true)} 
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300 px-4 py-2.5 text-xs font-bold transition">📝 Edit Info</button>
                )}
                {weatherLoading ? (
                  <span className="text-[10px] font-mono text-slate-400 animate-pulse uppercase tracking-tight pl-2">
                    📡 Syncing Climate...
                  </span>
                ) : weatherData ? (
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 h-[38px] rounded-none shadow-sm shrink-0">
                    <span className="text-xs font-sans font-black text-slate-800">
                      {weatherData.temp.toFixed(1)}°C
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-tight border-l border-slate-300 pl-1.5 ml-0.5">
                      {weatherData.text}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-rose-400 italic">No facility branch locations configured yet.</p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => setShowBranchModal(true)} 
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300 px-4 py-2.5 text-xs font-bold transition">➕ Deploy Venue</button>
            <button disabled={!selectedBranchId} onClick={() => setShowCourtModal(true)} 
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white px-4 py-2.5 text-xs font-black transition">➕ Provision Court</button>
            <button 
              disabled={!selectedBranchId}
              onClick={(e) => {
                e.preventDefault();
                
                // 1. Isolate the currently active branch node from your loaded data list array
                const activeBranch = branches.find(b => b.id === selectedBranchId);
                
                // 2. Extract coordinates safely with standard fallbacks to protect against null bounds
                const lat = activeBranch?.latitude ?? 49.2827;
                const lng = activeBranch?.longitude ?? -123.1207;
                
                // 3. Compile the exact authenticated Google Navigation API target URL string path
                const targetMapsUrl = `https://www.google.com/maps/@?api=1&map_action=map&center=${lat},${lng}&zoom=18&basemap=roadmap`;
                
                console.log(`🌐 [MAP NAVIGATION INTERCEPT]: Opening external link coordinate frame path: ${targetMapsUrl}`);
                
                // 4. Force browser window matrix engine to launch the path inside a secure standalone browser tab channel
                window.open(targetMapsUrl, '_blank', 'noopener,noreferrer');
              }}
              // onClick={() => setShowMapModal(true)}
              className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white border border-slate-950 px-4 py-2.5 text-xs font-black uppercase tracking-wider transition rounded-none h-[38px] flex items-center gap-1.5 shadow-sm"
            >
              🗺️ Show on Map
            </button>
          </div>
        </div>

        {isEditingBranch && (
          <form onSubmit={handleUpdateBranch} 
            className="p-4 bg-slate-100 border border-slate-300 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="space-y-1">
              <label className="block font-bold text-slate-600 uppercase">Modify Branch Title</label>
              <input type="text" required value={editBranchData.name} onChange={(e) => setEditBranchData({...editBranchData, name: e.target.value})} className="w-full bg-white border border-slate-300 p-2 text-slate-800" />
            </div>
            <div className="space-y-1">
              <label className="block font-bold text-slate-600 uppercase">Modify Area Focus</label>
              <input type="text" required value={editBranchData.description} onChange={(e) => setEditBranchData({...editBranchData, description: e.target.value})} className="w-full bg-white border border-slate-300 p-2 text-slate-800" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 border-t border-slate-200 pt-3">
              <div className="space-y-1">
                <label className="block font-bold text-slate-600 uppercase text-[10px]">Administrative GPS Latitude</label>
                <input 
                  type="number" 
                  step="0.000001" 
                  required 
                  value={editBranchData.latitude || 51.5074} 
                  onChange={(e) => setEditBranchData({...editBranchData, latitude: parseFloat(e.target.value) || 0.0})} 
                  className="w-full bg-white border border-slate-300 p-2 text-slate-800 font-mono text-xs focus:outline-none focus:border-purple-600" 
                />
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-slate-600 uppercase text-[10px]">Administrative GPS Longitude</label>
                <input 
                  type="number" 
                  step="0.000001" 
                  required 
                  value={editBranchData.longitude || -0.1278} 
                  onChange={(e) => setEditBranchData({...editBranchData, longitude: parseFloat(e.target.value) || 0.0})} 
                  className="w-full bg-white border border-slate-300 p-2 text-slate-800 font-mono text-xs focus:outline-none focus:border-purple-600" 
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block font-bold text-slate-600 uppercase">Modify Zone</label>
              <div className="flex space-x-2">
                <select value={editBranchData.timeZoneId} onChange={(e) => setEditBranchData({...editBranchData, timeZoneId: e.target.value})} className="w-full bg-white border border-slate-300 p-2 text-slate-800" >
                  <option value="Europe/London">Europe/London</option>
                  <option value="Asia/Dubai">Asia/Dubai</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="America/Vancouver">America/Vancouver (PST/PDT)</option>
                  <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                  <option value="Europe/Paris">Europe/Paris (CEST/CET)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                  <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
                  <option value="UTC">UTC (Universal Coordinated Time)</option>                  
                </select>
                <button type="submit" className="bg-purple-600 font-bold px-3 py-1 text-white">Save</button>
                <button type="button" onClick={() => setIsEditingBranch(false)} className="bg-slate-200 px-3 py-1 text-slate-700">Cancel</button>
              </div>
            </div>
          </form>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courts.map((court) => {
          const wearPercent = Math.min(100, Math.round((court.aggregateMinutesPlayed / court.maintenanceThresholdMinutes) * 100));
          const isCurrentCourtEditing = editingCourtId === court.id;
          
          return (
            <div key={court.id} 
              className="bg-white border border-slate-300 p-5 shadow-xl transition flex flex-col justify-between space-y-4">
              
              {!isCurrentCourtEditing ? (
                <div className="space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-black text-slate-800 tracking-tight">{court.name}</h3>
                        <p className="text-[11px] text-slate-700 mt-0.5 line-clamp-2 leading-relaxed">{court.description}</p>
                      </div>
                      <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border bg-emerald-100 text-emerald-700 border-emerald-300">{court.status}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-[10px] bg-slate-100 px-2 py-0.5 font-sans text-slate-700 border border-slate-300">🛠️ {court.surfaceType}</span>
                      <span className="text-[10px] bg-slate-100 px-2 py-0.5 font-sans text-slate-700 border border-slate-300">{court.isIndoor ? '🏠 Indoor' : '☀️ Outdoor'}</span>
                      <span className="text-[10px] bg-slate-100 px-2 py-0.5 font-sans text-slate-700 border border-slate-300">💧 Coeff: {court.dryCoefficient}</span>
                      <span className={`text-[10px] px-2 py-0.5 font-sans border font-medium ${court.floodlightState === 'On' ? 'bg-amber-50 border-amber-300 text-amber-800 font-bold' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                        {court.floodlightState === 'On' ? '⚡ Floodlights: Active (On)' : '💡 Floodlights: Off'}
                      </span>
                      
                      {court.estimatedReopenTimeUtc && (
                        <span className="text-[10px] bg-purple-50 border border-purple-200 px-2 py-0.5 font-mono text-purple-700 font-bold">
                          ⏳ Reopen: {new Date(court.estimatedReopenTimeUtc).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 border-t border-slate-300 pt-3">
                    <div className="flex items-center justify-between text-[10px] font-sans">
                      <span className="text-slate-700 uppercase">Surface Wear</span>
                      <span className="text-slate-700">{court.aggregateMinutesPlayed} / {court.maintenanceThresholdMinutes} m</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 overflow-hidden border border-slate-300">
                      <div style={{ width: `${wearPercent}%` }} className="h-full bg-emerald-500 transition-all duration-500" />
                    </div>
                  </div>

                  <div className="flex items-center justify-end border-t border-slate-300 pt-2 space-x-2">
                    <button onClick={() => handleBeginEditCourt(court)} className="text-[10px] font-bold text-slate-600 hover:text-slate-800 border border-transparent hover:border-slate-400 hover:bg-slate-100 px-2.5 py-1.5 transition">📝 Configure</button>
                    <button onClick={() => handleTriggerPurgeModal(court.id)} className="text-[10px] font-bold text-slate-600 hover:text-rose-600 border border-transparent hover:border-rose-300 hover:bg-rose-50 px-2.5 py-1.5 transition">🗑️ Decommision</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-xs flex-1 flex flex-col justify-between p-1 bg-white">
                  <div className="space-y-3">
                    {/* 🚀 FIXED (2): Unique Identifier Grid tracking displayed proudly at the absolute top boundary row */}
                    <div className="bg-slate-100 border border-slate-300 p-2 font-mono text-[9px] text-slate-500 rounded-none flex items-center justify-between">
                      <span>🆔 COURT ID:</span>
                      <span className="font-bold text-slate-700 select-all select-none">{court.id}</span>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.preventDefault();
                          
                          // 🚀 THE NATIVE RE-BIND FIX: Capture the button node IMMEDIATELY 
                          // to prevent React's async event pool from wiping it to null!
                          const btnNode = e.currentTarget;
                          if (!btnNode) return;

                          try {
                            // Native Device Clipboard write execution pass
                            await navigator.clipboard.writeText(court.id);
                            
                            // Apply your custom temporary success notification state flags safely
                            const originalContent = btnNode.innerHTML;
                            btnNode.innerHTML = `<span style="font-size: 9px; font-weight: bold; color: #16a34a;">✅ Copied!</span>`;
                            btnNode.style.borderColor = "#22c55e";
                            
                            setTimeout(() => {
                              btnNode.innerHTML = originalContent;
                              btnNode.style.borderColor = "";
                            }, 1200);
                          } catch (clipErr) {
                            console.error("Failed to acquire device system clipboard write privileges:", clipErr);
                            alert(`Clipboard ID Block: ${court.id}`);
                          }
                        }}
                        className="bg-transparent border border-transparent hover:border-slate-400 hover:bg-slate-200 p-1.5 transition-all duration-150 shrink-0 rounded-full flex items-center justify-center cursor-pointer select-none h-[26px] w-[26px]"
                        title="Copy Court GUID to System Clipboard"
                      >
                        {/* 📊 MATCHED SNAPSHOT GRAPHIC LAYER SVG */}
                        <svg 
                          className="h-3.5 w-3.5 text-slate-600 hover:text-slate-900" 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor" 
                          strokeWidth={2.5}
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" 
                          />
                        </svg>
                      </button>
                    </div>

                    <h4 className="font-black text-purple-700 border-b border-slate-300 pb-1 text-[11px] uppercase tracking-wide">
                      Modify Court Configuration Overrides
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Court Title</label>
                        <input type="text" value={editCourtData.name} onChange={(e) => setEditCourtData({...editCourtData, name: e.target.value})} className="w-full bg-white border border-slate-300 p-1.5 text-slate-800 focus:outline-none focus:border-purple-600 font-medium" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Operational Status</label>
                        <select value={editCourtData.status} onChange={(e) => setEditCourtData({...editCourtData, status: e.target.value})} className="w-full bg-white border border-slate-300 p-1.5 text-slate-800 font-bold focus:outline-none focus:border-purple-600">
                          <option value="Open">Open</option>
                          <option value="Rained_Out">Rained_Out</option>
                          <option value="Maintenance_Locked">Maintenance_Locked</option>
                        </select>
                      </div>
                    </div>

                    {/* 🚀 FIXED (2): Surface Type and Drying Coefficient explicitly added as editable fields during edit-mode */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Surface Construction Type</label>
                        <select value={editCourtData.surfaceType} onChange={(e) => setEditCourtData({...editCourtData, surfaceType: e.target.value})} className="w-full bg-white border border-slate-300 p-1.5 text-slate-800 font-medium focus:outline-none focus:border-purple-600">
                          <option value="Hard">Hardcourt</option>
                          <option value="Clay">Moisture Red Clay</option>
                          <option value="Grass">Traditional Grass</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Drying Coefficient Multiplier</label>
                        <input type="number" step="0.1" value={editCourtData.dryCoefficient} onChange={(e) => setEditCourtData({...editCourtData, dryCoefficient: parseFloat(e.target.value) || 1.0})} className="w-full bg-white border border-slate-300 p-1.5 text-slate-800 focus:outline-none focus:border-purple-600" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Floodlight Hardware Relay</label>
                        <select value={editCourtData.floodlightState} onChange={(e) => setEditCourtData({...editCourtData, floodlightState: e.target.value})} className="w-full bg-white border border-slate-300 p-1.5 text-slate-800 font-medium focus:outline-none focus:border-purple-600">
                          <option value="Off">💡 Power Relay: Off</option>
                          <option value="On">⚡ Power Relay: On (Ignite Grid)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Estimated Reopen (UTC)</label>
                        <input type="datetime-local" value={editCourtData.estimatedReopenTimeUtc} onChange={(e) => setEditCourtData({...editCourtData, estimatedReopenTimeUtc: e.target.value})} className="w-full bg-white border border-slate-300 p-1.5 text-slate-800 focus:outline-none focus:border-purple-600" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Maintenance Ceiling (Mins)</label>
                        <input type="number" value={editCourtData.maintenanceThresholdMinutes} onChange={(e) => setEditCourtData({...editCourtData, maintenanceThresholdMinutes: parseInt(e.target.value) || 270})} className="w-full bg-white border border-slate-300 p-1.5 text-slate-800 focus:outline-none focus:border-purple-600" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Accumulated Minutes Played</label>
                        {/* 🚀 FIXED (3): Balanced layout flex-box wrapper containing width bounds to prevent the Reset button from protruding */}
                        <div className="flex items-center gap-1.5 w-full">
                          <input 
                            type="number" 
                            value={editCourtData.aggregateMinutesPlayed} 
                            onChange={(e) => setEditCourtData({...editCourtData, aggregateMinutesPlayed: parseInt(e.target.value) || 0})} 
                            className="flex-1 min-w-[60px] bg-white border border-slate-300 p-1.5 text-slate-800 focus:outline-none focus:border-purple-600" 
                          />
                          <button 
                            type="button" 
                            onClick={() => setEditCourtData({...editCourtData, aggregateMinutesPlayed: 0})} 
                            className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-2 py-1.5 text-[9px] uppercase font-mono tracking-tight font-black h-[31px] transition shrink-0 rounded-none shadow-sm flex items-center justify-center gap-1"
                          >
                            🔄 Reset
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 pt-1">
                      <div className="flex items-center space-x-1.5 select-none">
                        <input type="checkbox" id={`editIndoor-${court.id}`} checked={editCourtData.isIndoor} onChange={(e) => setEditCourtData({...editCourtData, isIndoor: e.target.checked})} className="accent-purple-500 rounded h-3.5 w-3.5 cursor-pointer" />
                        <label htmlFor={`editIndoor-${court.id}`} className="text-slate-700 font-bold text-[10px] cursor-pointer uppercase">Indoor Enclosure</label>
                      </div>
                      <div className="flex items-center space-x-1.5 select-none">
                        <input type="checkbox" id={`editDecom-${court.id}`} checked={editCourtData.isDecommissioned} onChange={(e) => setEditCourtData({...editCourtData, isDecommissioned: e.target.checked})} className="accent-red-500 rounded h-3.5 w-3.5 cursor-pointer" />
                        <label htmlFor={`editDecom-${court.id}`} className="text-red-700 font-black text-[10px] cursor-pointer uppercase tracking-tight">⚠️ Decommission Soft-Delete</label>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-2 border-t border-slate-300 pt-3">
                    <button type="button" onClick={() => setEditingCourtId(null)} className="bg-slate-200 hover:bg-slate-300 px-4 py-2 text-slate-700 text-[10px] font-black rounded-none border border-slate-300 transition">Cancel</button>
                    <button type="button" onClick={() => handleUpdateCourt(court.id)} className="bg-purple-600 hover:bg-purple-500 text-white font-black px-4 py-2 text-[10px] rounded-none shadow-md border border-purple-700 transition">Commit Overrides</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {courts.length === 0 && (
          <div className="col-span-full border border-dashed border-slate-300 p-12 text-center text-xs font-sans text-slate-600 italic">
            No physical court assets provisioned under this specific branch configuration profile.
          </div>
        )}
      </div>
      {/* =========================================================================
          MODALS REGION OVERLAYS (DEPLOY NEW BRANCH OVERLAY INCLUDED FOR COMPLIANCE)
          ========================================================================= */}
      {showBranchModal && (
        <div className="fixed inset-0 bg-slate-400/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-300 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-slate-900">Deploy Location Branch Venue</h3>
            <form onSubmit={handleCreateBranch} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-slate-600 uppercase">Venue Location Name</label>
                <input type="text" required value={newBranch.name} onChange={(e) => setNewBranch({...newBranch, name: e.target.value})} placeholder="e.g., London Grass Core" className="w-full bg-white border border-slate-300 p-2.5 text-slate-800 focus:outline-none focus:border-purple-500" />
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-slate-600 uppercase">Structural Description</label>
                <textarea rows={2} required value={newBranch.description} onChange={(e) => setNewBranch({...newBranch, description: e.target.value})} placeholder="Describe operational focus boundaries..." className="w-full bg-white border border-slate-300 p-2.5 text-slate-800 focus:outline-none focus:border-purple-500" />
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-slate-600 uppercase">Regional IANA Time-Zone Routing Vector</label>
                <select value={newBranch.timeZoneId} onChange={(e) => setNewBranch({...newBranch, timeZoneId: e.target.value})} className="w-full bg-white border border-slate-300 p-2.5 text-slate-800 focus:outline-none" >
                  <option value="Europe/London">Europe/London</option>
                  <option value="Asia/Dubai">Asia/Dubai</option>
                  <option value="America/New_York">America/New_York</option>
                </select>
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setShowBranchModal(false)} className="bg-slate-200 hover:bg-slate-300 px-4 py-2 text-slate-700 transition">Cancel</button>
                <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white font-black px-4 py-2 transition">Deploy Node</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCourtModal && (
        <div className="fixed inset-0 bg-slate-400/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-300 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-slate-900">Provision Court Asset Framework</h3>
            <form onSubmit={handleCreateCourt} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-slate-600 uppercase">Court Asset Reference Title</label>
                <input type="text" required value={newCourt.name} onChange={(e) => setNewCourt({...newCourt, name: e.target.value})} placeholder="e.g., Championship Grass 1" className="w-full bg-white border border-slate-300 p-2.5 text-slate-800 focus:outline-none focus:border-purple-500" />
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-slate-600 uppercase">Hardware Configuration Description</label>
                <textarea rows={2} required value={newCourt.description} onChange={(e) => setNewCourt({...newCourt, description: e.target.value})} placeholder="Detail materials layout..." className="w-full bg-white border border-slate-300 p-2.5 text-slate-800 focus:outline-none focus:border-purple-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-600 uppercase">Surface Construction Type</label>
                  <select value={newCourt.surfaceType} onChange={(e) => setNewCourt({...newCourt, surfaceType: e.target.value})} className="w-full bg-white border border-slate-300 p-2.5 text-slate-800" >
                    <option value="Grass">Traditional Grass</option>
                    <option value="Clay">Moisture Red Clay</option>
                    <option value="Hard">Standard Hardcourt</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-600 uppercase">Drying Coefficient Multiplier</label>
                  <input type="number" step="0.1" required value={newCourt.dryCoefficient} onChange={(e) => setNewCourt({...newCourt, dryCoefficient: parseFloat(e.target.value) || 1.0})} className="w-full bg-white border border-slate-300 p-2.5 text-slate-800" />
                </div>
              </div>
              <div className="flex items-center space-x-2 py-1">
                <input type="checkbox" id="indoorCheck" checked={newCourt.isIndoor} onChange={(e) => setNewCourt({...newCourt, isIndoor: e.target.checked})} className="rounded bg-white border-slate-300 text-purple-500 accent-purple-500 h-4 w-4" />
                <label htmlFor="indoorCheck" className="text-slate-700 font-semibold cursor-pointer">Indoor Enclosure</label>
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setShowCourtModal(false)} className="bg-slate-200 hover:bg-slate-300 px-4 py-2 text-slate-700 transition">Cancel</button>
                <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white font-black px-4 py-2 transition">Commit Asset</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL INTERFACES: CUSTOM HIGH-UTILITY CONFIRM PURGE OVERLAY
          ========================================================================= */}
      {courtToDeleteId && (
        <div className="fixed inset-0 bg-slate-400/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-300 max-w-sm w-full p-6 space-y-4 shadow-2xl text-center">
            
            <div className="inline-flex items-center justify-center h-12 w-12 bg-rose-100 border border-rose-300 text-rose-600 text-xl shadow-inner">
              ⚠️
            </div>
            
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900 tracking-tight">Decommission Physical Court Asset</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you absolutely sure you want to decouple this asset? This action will permanently remove this court and all historical scheduling logs from the PostgreSQL cluster database.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2 text-xs font-bold">
              <button 
                type="button" 
                onClick={handleExecutePurgeAction} 
                className="w-full bg-rose-600 hover:bg-rose-500 text-white p-2.5 rounded-xl transition shadow-lg shadow-rose-950/20"
              >
                Yes, Decommission Infrastructure Asset Permanent
              </button>
              <button 
                type="button" 
                onClick={() => setCourtToDeleteId(null)} 
                className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300 p-2.5 transition font-semibold"
              >
                Cancel Action
              </button>
            </div>

          </div>
        </div>
      )}

      {showMapModal && (
        <div className="fixed inset-0 bg-slate-400/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-300 max-w-2xl w-full p-5 space-y-4 shadow-2xl relative rounded-none">
            
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                🗺️ Physical Branch Location Pinpoint Map (Embed Console)
              </h3>
              <button 
                onClick={() => setShowMapModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold font-sans text-sm p-1"
              >
                ✕ Close
              </button>
            </div>

            {/* 🚀 THE ZERO-INSTALLATION IFRAME: 100% Free with unlimited loads and no billing account required! */}
            {(() => {
              const activeBranch = branches.find(b => b.id === selectedBranchId);
              const lat = activeBranch?.latitude || 51.5074;
              const lng = activeBranch?.longitude || -0.1278;
              
              return (
                <iframe
                  title="Google Maps Location View"
                  width="100%"
                  height="380"
                  style={{ border: "1px solid #cbd5e1" }}
                  loading="lazy"
                  allowFullScreen
                  src={`https://www.google.com/maps/@?api=1&map_action=map&center=${lat},${lng}&zoom=18&basemap=roadmap`}
                />
              );
            })()}
            
            <div className="text-[10px] text-slate-500 font-mono text-right uppercase tracking-tight">
              Active Anchor Matrix Coordinates: {branches.find(b => b.id === selectedBranchId)?.latitude}, {branches.find(b => b.id === selectedBranchId)?.longitude}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
