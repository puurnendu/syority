'use client';

import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';

type TabId = 'time_units' | 'dates' | 'currency' | 'application' | 'password' | 'assistance' | 'resource_analysis' | 'calculations' | 'startup_filters';

const TABS: { id: TabId; label: string; implemented?: boolean }[] = [
  { id: 'time_units', label: 'Time Units', implemented: true },
  { id: 'dates', label: 'Dates', implemented: true },
  { id: 'currency', label: 'Currency', implemented: true },
  { id: 'assistance', label: 'Assistance' },
  { id: 'application', label: 'Application', implemented: true },
  { id: 'password', label: 'Password', implemented: true },
  { id: 'resource_analysis', label: 'Resource Analysis' },
  { id: 'calculations', label: 'Calculations' },
  { id: 'startup_filters', label: 'Startup Filters' },
];

export function UserPreferencesModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { preferences, refreshPreferences } = useUserPreferences();
  const [activeTab, setActiveTab] = useState<TabId>('time_units');
  
  // -- Time Units State --
  const [unitsUnit, setUnitsUnit] = useState('Hour');
  const [unitsSubunit, setUnitsSubunit] = useState(false);
  const [unitsDecimals, setUnitsDecimals] = useState('0');
  const [unitsShowLabel, setUnitsShowLabel] = useState(true);
  
  const [durationsUnit, setDurationsUnit] = useState('Hour');
  const [durationsSubunit, setDurationsSubunit] = useState(false);
  const [durationsDecimals, setDurationsDecimals] = useState('0');
  const [durationsShowLabel, setDurationsShowLabel] = useState(true);
  
  const [unitsTimeFormat, setUnitsTimeFormat] = useState('units_duration');

  // -- Dates State --
  const [dateFormat, setDateFormat] = useState('DMY'); // MDY, DMY, YMD
  const [timeFormat, setTimeFormat] = useState('none'); // 12h, 24h, none
  const [timeShowMinutes, setTimeShowMinutes] = useState(true);
  const [dateOpt4Digit, setDateOpt4Digit] = useState(false);
  const [dateOptMonthName, setDateOptMonthName] = useState(true);
  const [dateOptLeadingZero, setDateOptLeadingZero] = useState(true);
  const [dateSeparator, setDateSeparator] = useState('-');

  // -- Currency State --
  const [currencyCode, setCurrencyCode] = useState('INR');
  const [showCurrencySymbol, setShowCurrencySymbol] = useState(true);
  const [showCurrencyDecimals, setShowCurrencyDecimals] = useState(true);

  // -- Application State --
  const [startupWindow, setStartupWindow] = useState('Activities');
  const [showWelcome, setShowWelcome] = useState(false);
  const [grpShowId, setGrpShowId] = useState(false);
  const [grpShowName, setGrpShowName] = useState(true);
  const [displayCode, setDisplayCode] = useState('value');
  const [finPeriodFrom, setFinPeriodFrom] = useState('');
  const [finPeriodTo, setFinPeriodTo] = useState('');
  const [siteTimezone, setSiteTimezone] = useState('local');

  const TIMEZONES = [
    { label: 'Browser Local (auto-detect)', value: 'local'                },
    { label: 'UTC / GMT (±0)',              value: 'UTC'                  },
    { label: 'London (±0/+1)',             value: 'Europe/London'        },
    { label: 'Paris, Berlin (+1/+2)',      value: 'Europe/Paris'         },
    { label: 'Riyadh, Kuwait (+3)',        value: 'Asia/Riyadh'          },
    { label: 'Dubai, Abu Dhabi (+4)',      value: 'Asia/Dubai'           },
    { label: 'Karachi (+5)',               value: 'Asia/Karachi'         },
    { label: 'India IST (+5:30)',          value: 'Asia/Kolkata'         },
    { label: 'Dhaka (+6)',                 value: 'Asia/Dhaka'           },
    { label: 'Bangkok, Jakarta (+7)',      value: 'Asia/Bangkok'         },
    { label: 'Singapore, KL (+8)',         value: 'Asia/Singapore'       },
    { label: 'Tokyo (+9)',                 value: 'Asia/Tokyo'           },
    { label: 'Sydney (+10/+11)',           value: 'Australia/Sydney'     },
    { label: 'New York (−5/−4)',           value: 'America/New_York'     },
    { label: 'Chicago (−6/−5)',            value: 'America/Chicago'      },
    { label: 'Denver (−7/−6)',             value: 'America/Denver'       },
    { label: 'Los Angeles (−8/−7)',        value: 'America/Los_Angeles'  },
  ];

  // Example generator for dates block
  const generateDateSample = () => {
    let parts = [];
    const d = dateOptLeadingZero ? '04' : '4';
    const m = dateOptMonthName ? 'Apr' : (dateOptLeadingZero ? '04' : '4');
    const y = dateOpt4Digit ? '2026' : '26';
    
    if (dateFormat === 'MDY') parts = [m, d, y];
    if (dateFormat === 'DMY') parts = [d, m, y];
    if (dateFormat === 'YMD') parts = [y, m, d];
    
    let res = parts.join(dateSeparator);

    if (timeFormat === '12h') res += timeShowMinutes ? ' 1:30 PM' : ' 1 PM';
    if (timeFormat === '24h') res += timeShowMinutes ? ' 13:30' : ' 13:00';
    
    return res;
  };

  const handleSave = () => {
    // Optionally persist in local storage
    const payload = {
      timeUnits: { unitsUnit, unitsSubunit, unitsDecimals, unitsShowLabel, durationsUnit, durationsSubunit, durationsDecimals, durationsShowLabel, unitsTimeFormat },
      dates: { dateFormat, timeFormat, timeShowMinutes, dateOpt4Digit, dateOptMonthName, dateOptLeadingZero, dateSeparator, siteTimezone },
      currency: { currencyCode, showCurrencySymbol, showCurrencyDecimals },
      application: { startupWindow, showWelcome, grpShowId, grpShowName, displayCode, finPeriodFrom, finPeriodTo },
    };
    try {
      localStorage.setItem('syority_user_preferences', JSON.stringify(payload));
      refreshPreferences();
    } catch {}
    onClose();
  };

  // Load from local storage on mount
  useEffect(() => {
    if (isOpen) {
      try {
        const stored = localStorage.getItem('syority_user_preferences');
        if (stored) {
          const p = JSON.parse(stored);
          if (p.timeUnits) {
            setUnitsUnit(p.timeUnits.unitsUnit ?? 'Hour');
            setUnitsSubunit(p.timeUnits.unitsSubunit ?? false);
            setUnitsDecimals(p.timeUnits.unitsDecimals ?? '0');
            setUnitsShowLabel(p.timeUnits.unitsShowLabel ?? true);
            setDurationsUnit(p.timeUnits.durationsUnit ?? 'Hour');
            setDurationsSubunit(p.timeUnits.durationsSubunit ?? false);
            setDurationsDecimals(p.timeUnits.durationsDecimals ?? '0');
            setDurationsShowLabel(p.timeUnits.durationsShowLabel ?? true);
            setUnitsTimeFormat(p.timeUnits.unitsTimeFormat ?? 'units_duration');
          }
          if (p.dates) {
            setDateFormat(p.dates.dateFormat ?? 'DMY');
            setTimeFormat(p.dates.timeFormat ?? 'none');
            setTimeShowMinutes(p.dates.timeShowMinutes ?? true);
            setDateOpt4Digit(p.dates.dateOpt4Digit ?? false);
            setDateOptMonthName(p.dates.dateOptMonthName ?? true);
            setDateOptLeadingZero(p.dates.dateOptLeadingZero ?? true);
            setDateSeparator(p.dates.dateSeparator ?? '-');
            setSiteTimezone(p.dates.siteTimezone ?? 'local');
          }
          if (p.currency) {
            setCurrencyCode(p.currency.currencyCode ?? 'INR');
            setShowCurrencySymbol(p.currency.showCurrencySymbol ?? true);
            setShowCurrencyDecimals(p.currency.showCurrencyDecimals ?? true);
          }
          if (p.application) {
            setStartupWindow(p.application.startupWindow ?? 'Activities');
            setShowWelcome(p.application.showWelcome ?? false);
            setGrpShowId(p.application.grpShowId ?? false);
            setGrpShowName(p.application.grpShowName ?? true);
            setDisplayCode(p.application.displayCode ?? 'value');
            setFinPeriodFrom(p.application.finPeriodFrom ?? '');
            setFinPeriodTo(p.application.finPeriodTo ?? '');
          }
        }
      } catch {}
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl overflow-hidden w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-200">
        
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-white text-gray-900 font-semibold shadow-sm z-10">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            User Preferences
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden min-h-[500px]">
          
          {/* Sidebar Tabs */}
          <div className="w-48 bg-gray-50/50 border-r border-gray-200 flex flex-col py-3 overflow-y-auto">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const isImplemented = tab.implemented;
              return (
                <button
                  key={tab.id}
                  onClick={() => isImplemented && setActiveTab(tab.id)}
                  className={`
                    w-full text-left px-4 py-2.5 text-sm font-medium transition-all relative
                    ${isActive ? 'text-blue-700 bg-white shadow-[inset_4px_0_0_0_#2563eb] border-y border-transparent z-10' : ''}
                    ${!isActive && isImplemented ? 'text-gray-600 hover:bg-gray-100' : ''}
                    ${!isImplemented ? 'text-gray-400 cursor-not-allowed opacity-60' : ''}
                  `}
                  title={!isImplemented ? 'Coming soon' : ''}
                >
                  <span className={isActive ? '' : 'pl-1'}>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Main Content Area */}
          <div className="flex-1 bg-white p-6 overflow-y-auto">
            
            {/* 1. TIME UNITS */}
            {activeTab === 'time_units' && (
              <div className="max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                {/* Units Format */}
                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="bg-gray-50/80 px-4 py-2.5 border-b border-gray-200 font-semibold text-sm text-gray-800">
                    Units Format
                  </div>
                  <div className="p-5 space-y-5 bg-white">
                    <div className="grid grid-cols-3 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Unit of Time</label>
                        <select
                          className="w-full text-sm rounded bg-gray-50 border border-gray-200 p-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-gray-700"
                          value={unitsUnit} onChange={e => setUnitsUnit(e.target.value)}
                        >
                          <option value="Hour">Hour</option>
                          <option value="Day">Day</option>
                          <option value="Week">Week</option>
                          <option value="Month">Month</option>
                          <option value="Year">Year</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sub-unit</label>
                        <label className="flex items-center gap-2 mt-2 select-none cursor-pointer group">
                          <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={unitsSubunit} onChange={e => setUnitsSubunit(e.target.checked)} />
                          <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">Minutes</span>
                        </label>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Decimals</label>
                        <select
                          className="w-full text-sm rounded bg-gray-50 border border-gray-200 p-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-gray-700"
                          value={unitsDecimals} onChange={e => setUnitsDecimals(e.target.value)}
                        >
                          <option value="0">0</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2">
                       <label className="flex items-center gap-2 select-none cursor-pointer group">
                          <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={unitsShowLabel} onChange={e => setUnitsShowLabel(e.target.checked)} />
                          <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Show Unit label</span>
                        </label>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-500">Example</span>
                          <div className="bg-gray-50 border border-gray-200 text-gray-700 font-medium px-4 py-1.5 rounded text-sm w-24 text-right shadow-inner">
                            {unitsShowLabel ? '41h' : '41'}
                          </div>
                        </div>
                    </div>
                  </div>
                </div>

                {/* Durations Format */}
                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="bg-gray-50/80 px-4 py-2.5 border-b border-gray-200 font-semibold text-sm text-gray-800">
                    Durations Format
                  </div>
                  <div className="p-5 space-y-5 bg-white">
                    <div className="grid grid-cols-3 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Unit of Time</label>
                        <select
                          className="w-full text-sm rounded bg-gray-50 border border-gray-200 p-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-gray-700"
                          value={durationsUnit} onChange={e => setDurationsUnit(e.target.value)}
                        >
                          <option value="Hour">Hour</option>
                          <option value="Day">Day</option>
                          <option value="Week">Week</option>
                          <option value="Month">Month</option>
                          <option value="Year">Year</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sub-unit</label>
                        <label className="flex items-center gap-2 mt-2 select-none cursor-pointer group">
                          <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={durationsSubunit} onChange={e => setDurationsSubunit(e.target.checked)} />
                          <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">Minutes</span>
                        </label>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Decimals</label>
                        <select
                          className="w-full text-sm rounded bg-gray-50 border border-gray-200 p-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-gray-700"
                          value={durationsDecimals} onChange={e => setDurationsDecimals(e.target.value)}
                        >
                          <option value="0">0</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2">
                       <label className="flex items-center gap-2 select-none cursor-pointer group">
                          <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={durationsShowLabel} onChange={e => setDurationsShowLabel(e.target.checked)} />
                          <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Show Duration label</span>
                        </label>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-500">Example</span>
                          <div className="bg-gray-50 border border-gray-200 text-gray-700 font-medium px-4 py-1.5 rounded text-sm w-24 text-right shadow-inner">
                            {durationsShowLabel ? '81h' : '81'}
                          </div>
                        </div>
                    </div>
                  </div>
                </div>

                {/* Units/Time Format */}
                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="bg-gray-50/80 px-4 py-2.5 border-b border-gray-200 font-semibold text-sm text-gray-800">
                    Units/Time Format
                  </div>
                  <div className="p-5 space-y-4 bg-white">
                    <p className="text-sm text-gray-600">Resource Units/Time can be shown as a percentage or as units per duration</p>
                    <div className="space-y-3 pt-1">
                      <label className="flex items-center gap-3 select-none cursor-pointer group">
                        <input type="radio" value="percentage" checked={unitsTimeFormat === 'percentage'} onChange={e => setUnitsTimeFormat(e.target.value)} className="w-4 h-4 border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                        <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">Show as a percentage (50%)</span>
                      </label>
                      <label className="flex items-center gap-3 select-none cursor-pointer group">
                        <input type="radio" value="units_duration" checked={unitsTimeFormat === 'units_duration'} onChange={e => setUnitsTimeFormat(e.target.value)} className="w-4 h-4 border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                        <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">Show as units/duration (4h/d)</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. DATES */}
            {activeTab === 'dates' && (
              <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-300 grid grid-cols-2 gap-6">
                
                <div className="space-y-6">
                  {/* Date Format */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-gray-50/80 px-4 py-2.5 border-b border-gray-200 font-semibold text-sm text-gray-800">
                      Date Format
                    </div>
                    <div className="p-5 space-y-4 bg-white">
                       <label className="flex items-center gap-3 select-none cursor-pointer group">
                          <input type="radio" value="MDY" checked={dateFormat === 'MDY'} onChange={e => setDateFormat(e.target.value)} className="w-4 h-4 border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                          <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Month, Day, Year</span>
                       </label>
                       <label className="flex items-center gap-3 select-none cursor-pointer group">
                          <input type="radio" value="DMY" checked={dateFormat === 'DMY'} onChange={e => setDateFormat(e.target.value)} className="w-4 h-4 border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                          <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Day, Month, Year</span>
                       </label>
                       <label className="flex items-center gap-3 select-none cursor-pointer group">
                          <input type="radio" value="YMD" checked={dateFormat === 'YMD'} onChange={e => setDateFormat(e.target.value)} className="w-4 h-4 border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                          <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Year, Month, Day</span>
                       </label>
                    </div>
                  </div>

                  {/* Time */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-gray-50/80 px-4 py-2.5 border-b border-gray-200 font-semibold text-sm text-gray-800">
                      Time
                    </div>
                    <div className="p-5 space-y-4 bg-white">
                       <label className="flex items-center gap-3 select-none cursor-pointer group">
                          <input type="radio" value="12h" checked={timeFormat === '12h'} onChange={e => setTimeFormat(e.target.value)} className="w-4 h-4 border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                          <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">12 hour (1:30 PM)</span>
                       </label>
                       <label className="flex items-center gap-3 select-none cursor-pointer group">
                          <input type="radio" value="24h" checked={timeFormat === '24h'} onChange={e => setTimeFormat(e.target.value)} className="w-4 h-4 border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                          <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">24 hour (13:30)</span>
                       </label>
                       <label className="flex items-center gap-3 select-none cursor-pointer group">
                          <input type="radio" value="none" checked={timeFormat === 'none'} onChange={e => setTimeFormat(e.target.value)} className="w-4 h-4 border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                          <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Do not show time</span>
                       </label>
                       
                       <div className="h-px bg-gray-100 my-4" />
                       
                       <label className={`flex items-center gap-3 select-none ${timeFormat !== 'none' ? 'cursor-pointer group' : 'opacity-50 cursor-not-allowed'}`}>
                          <input type="checkbox" disabled={timeFormat === 'none'} checked={timeShowMinutes} onChange={e => setTimeShowMinutes(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50" />
                          <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Show minutes</span>
                       </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Options */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm h-full flex flex-col">
                    <div className="bg-gray-50/80 px-4 py-2.5 border-b border-gray-200 font-semibold text-sm text-gray-800">
                      Options
                    </div>
                    <div className="p-5 flex-1 flex flex-col gap-5 bg-white">
                       <label className="flex items-center justify-between select-none cursor-pointer group">
                          <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">4-digit year</span>
                          <input type="checkbox" checked={dateOpt4Digit} onChange={e => setDateOpt4Digit(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                       </label>
                       <label className="flex items-center justify-between select-none cursor-pointer group">
                          <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Month name</span>
                          <input type="checkbox" checked={dateOptMonthName} onChange={e => setDateOptMonthName(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                       </label>
                       <label className="flex items-center justify-between select-none cursor-pointer group">
                          <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Leading zeroes</span>
                          <input type="checkbox" checked={dateOptLeadingZero} onChange={e => setDateOptLeadingZero(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                       </label>
                       <div className="flex items-center justify-between pt-2">
                          <span className="text-sm font-medium text-gray-700">Separator</span>
                          <select
                            className="text-sm rounded bg-gray-50 border border-gray-200 p-1.5 px-3 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-center font-bold"
                            value={dateSeparator} onChange={e => setDateSeparator(e.target.value)}
                          >
                            <option value="-">-</option>
                            <option value="/">/</option>
                            <option value=".">.</option>
                          </select>
                       </div>
                    </div>
                  </div>

                  {/* Timezone */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-gray-50/80 px-4 py-2.5 border-b border-gray-200 flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-500" />
                      <span className="font-semibold text-sm text-gray-800 tracking-tight">Regional Timezone</span>
                    </div>
                    <div className="p-5 bg-white">
                       <select
                          className="w-full text-sm rounded-lg bg-gray-50 border border-gray-200 p-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold text-gray-700 cursor-pointer hover:bg-white"
                          value={siteTimezone} onChange={e => setSiteTimezone(e.target.value)}
                       >
                          {TIMEZONES.map(tz => (
                            <option key={tz.value} value={tz.value}>{tz.label}</option>
                          ))}
                       </select>
                       <div className="mt-3 flex items-start gap-2 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/50">
                         <svg className="w-3.5 h-3.5 text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                           <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                         </svg>
                         <p className="text-[10px] text-blue-600/80 leading-relaxed italic">
                           Select the timezone for project dates and activity scheduling.
                         </p>
                       </div>
                    </div>
                  </div>
                </div>

                {/* Sample Display */}
                <div className="col-span-2 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="bg-gray-50/80 px-4 py-2.5 border-b border-gray-200 font-semibold text-sm text-gray-800">
                    Sample
                  </div>
                  <div className="p-4 bg-white flex items-center gap-4">
                     <span className="text-sm text-gray-500 font-medium">Preview</span>
                     <div className="bg-gray-50 border border-gray-200 text-gray-800 font-medium px-4 py-2 rounded text-sm min-w-[200px] shadow-inner tracking-wide flex-1">
                       {generateDateSample()}
                     </div>
                  </div>
                </div>

              </div>
            )}

            {/* 3. CURRENCY */}
            {activeTab === 'currency' && (
              <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm flex flex-col">
                    <div className="bg-gray-50/80 px-4 py-2.5 border-b border-gray-200 font-semibold text-sm text-gray-800">
                      Currency Options
                    </div>
                    <div className="p-6 space-y-6 bg-white">
                      <div>
                        <p className="text-sm text-gray-600 mb-3 font-medium">Select a currency for viewing monetary values</p>
                        <div className="flex items-center gap-2 max-w-sm">
                          <div className="flex-1 relative">
                            <select
                                className="w-full text-sm rounded bg-gray-50 border border-gray-200 p-2.5 pl-3 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-gray-700 appearance-none"
                                value={currencyCode} onChange={e => setCurrencyCode(e.target.value)}
                            >
                                <option value="INR">Indian Rupee</option>
                                <option value="USD">US Dollar</option>
                                <option value="EUR">Euro</option>
                                <option value="GBP">British Pound</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                          </div>
                          <button className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded text-gray-500 hover:bg-gray-100 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-gray-100">
                         <div className="flex items-center justify-between max-w-sm group">
                           <label className="flex items-center gap-3 select-none cursor-pointer">
                              <input type="checkbox" checked={showCurrencySymbol} onChange={e => setShowCurrencySymbol(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Show currency symbol</span>
                           </label>
                           <span className="text-sm font-bold text-gray-900 w-12 text-right">
                             {currencyCode === 'INR' ? '₹' : currencyCode === 'USD' ? '$' : currencyCode === 'EUR' ? '€' : '£'}
                           </span>
                         </div>
                         
                         <div className="flex items-center justify-between max-w-sm group">
                           <label className="flex items-center gap-3 select-none cursor-pointer">
                              <input type="checkbox" checked={showCurrencyDecimals} onChange={e => setShowCurrencyDecimals(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Show decimal digits</span>
                           </label>
                           <span className="text-sm text-gray-500 font-medium tabular-nums w-12 text-right">0.00</span>
                         </div>
                      </div>
                    </div>
                </div>
              </div>
            )}

            {/* 4. APPLICATION */}
            {activeTab === 'application' && (
              <div className="max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                {/* Startup Window */}
                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="bg-gray-50/80 px-4 py-2.5 border-b border-gray-200 font-semibold text-sm text-gray-800">
                    Startup Window
                  </div>
                  <div className="p-5 space-y-5 bg-white">
                    <div className="space-y-2 max-w-sm">
                      <label className="text-sm font-medium text-gray-700">Application Startup Window</label>
                      <select
                          className="w-full text-sm rounded bg-gray-50 border border-gray-200 p-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-gray-700"
                          value={startupWindow} onChange={e => setStartupWindow(e.target.value)}
                      >
                          <option value="Activities">Activities</option>
                          <option value="Dashboard">Dashboard</option>
                          <option value="Projects">Projects</option>
                          <option value="Resources">Resources</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-3 select-none cursor-pointer group pt-1">
                      <input type="checkbox" checked={showWelcome} onChange={e => setShowWelcome(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                      <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Show the Welcome dialog at startup</span>
                    </label>
                  </div>
                </div>

                {/* Group and Sorting */}
                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="bg-gray-50/80 px-4 py-2.5 border-b border-gray-200 font-semibold text-sm text-gray-800">
                    Group and Sorting
                  </div>
                  <div className="p-5 space-y-3 bg-white">
                    <p className="text-sm text-gray-600 font-medium mb-1">Labels on grouping bands</p>
                    <label className="flex items-center gap-3 select-none cursor-pointer group">
                      <input type="checkbox" checked={grpShowId} onChange={e => setGrpShowId(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                      <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Show ID / Code</span>
                    </label>
                    <label className="flex items-center gap-3 select-none cursor-pointer group">
                      <input type="checkbox" checked={grpShowName} onChange={e => setGrpShowName(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                      <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Show Name / Description</span>
                    </label>
                  </div>
                </div>
                
                {/* Codes */}
                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="bg-gray-50/80 px-4 py-2.5 border-b border-gray-200 font-semibold text-sm text-gray-800">
                    Codes
                  </div>
                  <div className="p-5 space-y-3 bg-white">
                    <p className="text-sm text-gray-600 font-medium mb-1">Specify how to display code values</p>
                    <label className="flex items-center gap-3 select-none cursor-pointer group">
                      <input type="radio" value="value" checked={displayCode === 'value'} onChange={e => setDisplayCode(e.target.value)} className="w-4 h-4 border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                      <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Code Value</span>
                    </label>
                    <label className="flex items-center gap-3 select-none cursor-pointer group">
                      <input type="radio" value="description" checked={displayCode === 'description'} onChange={e => setDisplayCode(e.target.value)} className="w-4 h-4 border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                      <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Description</span>
                    </label>
                  </div>
                </div>

                {/* Financial Period Data */}
                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="bg-gray-50/80 px-4 py-2.5 border-b border-gray-200 font-semibold text-sm text-gray-800">
                    Financial Period Data
                  </div>
                  <div className="p-5 bg-white">
                    <p className="text-sm text-gray-600 font-medium mb-3">Select dates range to load Financial Period Data</p>
                    <div className="flex items-center gap-4">
                      <input type="date" value={finPeriodFrom} onChange={e => setFinPeriodFrom(e.target.value)} className="w-36 text-sm rounded bg-gray-50 border border-gray-200 p-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700" />
                      <span className="text-sm text-gray-500 font-medium">to</span>
                      <input type="date" value={finPeriodTo} onChange={e => setFinPeriodTo(e.target.value)} className="w-36 text-sm rounded bg-gray-50 border border-gray-200 p-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700" />
                      <button className="flex items-center gap-1.5 px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 border border-green-200 transition-colors font-medium text-sm rounded">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Select
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* 5. PASSWORD */}
            {activeTab === 'password' && (
              <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                 <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="bg-gray-50/80 px-4 py-2.5 border-b border-gray-200 font-semibold text-sm text-gray-800">
                    User Password
                  </div>
                  <div className="p-6 bg-white space-y-6">
                    <p className="text-sm text-gray-600">
                      Click the &apos;Password&apos; button to change your current application password.
                    </p>
                    <div className="flex justify-center pt-2">
                       <button className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-300 shadow-sm rounded-md font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 hover:border-blue-200 transition-all transform hover:scale-[1.02] active:scale-[0.98]">
                         <svg className="w-5 h-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                         Password
                       </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-xl z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
           <button
            onClick={() => {}}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 transition-colors flex items-center gap-1.5"
          >
             <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
            Help
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded shadow-sm hover:bg-blue-700 hover:shadow transition-all"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
