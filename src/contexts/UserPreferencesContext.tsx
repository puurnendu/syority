'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type UserPreferences = {
  timeUnits?: {
    unitsUnit: string;
    unitsSubunit: boolean;
    unitsDecimals: string;
    unitsShowLabel: boolean;
    durationsUnit: string;
    durationsSubunit: boolean;
    durationsDecimals: string;
    durationsShowLabel: boolean;
    unitsTimeFormat: string;
  };
  dates?: {
    dateFormat: string; // 'MDY' | 'DMY' | 'YMD'
    timeFormat: string; // '12h' | '24h' | 'none'
    timeShowMinutes: boolean;
    dateOpt4Digit: boolean;
    dateOptMonthName: boolean;
    dateOptLeadingZero: boolean;
    dateSeparator: string; // '-' | '/' | '.'
    siteTimezone: string;  // Added for global timezone management
  };
  currency?: {
    currencyCode: string;
    showCurrencySymbol: boolean;
    showCurrencyDecimals: boolean;
  };
  application?: {
    startupWindow: string;
    showWelcome: boolean;
    grpShowId: boolean;
    grpShowName: boolean;
    displayCode: string;
    finPeriodFrom: string;
    finPeriodTo: string;
  };
};

const defaultPreferences: UserPreferences = {
  timeUnits: {
    unitsUnit: 'Hour', unitsSubunit: false, unitsDecimals: '0', unitsShowLabel: true,
    durationsUnit: 'Hour', durationsSubunit: false, durationsDecimals: '0', durationsShowLabel: true,
    unitsTimeFormat: 'units_duration'
  },
  dates: {
    dateFormat: 'DMY', timeFormat: 'none', timeShowMinutes: true,
    dateOpt4Digit: false, dateOptMonthName: true, dateOptLeadingZero: true, dateSeparator: '-',
    siteTimezone: 'local'
  },
  currency: {
    currencyCode: 'INR', showCurrencySymbol: true, showCurrencyDecimals: true
  },
  application: {
    startupWindow: 'Activities', showWelcome: false, grpShowId: false, grpShowName: true,
    displayCode: 'value', finPeriodFrom: '', finPeriodTo: ''
  }
};

type UserPreferencesContextType = {
  preferences: UserPreferences;
  refreshPreferences: () => void;
};

const UserPreferencesContext = createContext<UserPreferencesContextType>({
  preferences: defaultPreferences,
  refreshPreferences: () => {},
});

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);

  const refreshPreferences = () => {
    try {
      const stored = localStorage.getItem('syority_user_preferences');
      if (stored) {
        // Deep merge with defaults to avoid missing keys
        const parsed = JSON.parse(stored);
        setPreferences({
          ...defaultPreferences,
          ...parsed,
          timeUnits: { ...defaultPreferences.timeUnits, ...parsed.timeUnits },
          dates: { ...defaultPreferences.dates, ...parsed.dates },
          currency: { ...defaultPreferences.currency, ...parsed.currency },
          application: { ...defaultPreferences.application, ...parsed.application },
        });
      }
    } catch {}
  };

  useEffect(() => {
    refreshPreferences();
  }, []);

  return (
    <UserPreferencesContext.Provider value={{ preferences, refreshPreferences }}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences() {
  return useContext(UserPreferencesContext);
}
