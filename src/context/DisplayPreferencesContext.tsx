import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type DateFormatPreference = 'yyyy-mm-dd' | 'dd-mm-yyyy' | 'mm-dd-yyyy' | 'mm/dd/yyyy'
export type TimeFormatPreference = '24h' | '12h'

interface DisplayPreferencesState {
  dateFormat: DateFormatPreference
  timeFormat: TimeFormatPreference
}

interface DisplayPreferencesContextValue extends DisplayPreferencesState {
  setDateFormat: (value: DateFormatPreference) => void
  setTimeFormat: (value: TimeFormatPreference) => void
  formatDateTime: (value?: Date | string | number | null) => string
  formatDate: (value?: Date | string | number | null) => string
  formatTime: (value?: Date | string | number | null) => string
}

const STORAGE_KEY = 'dayshield-display-preferences'

const DEFAULT_PREFERENCES: DisplayPreferencesState = {
  dateFormat: 'yyyy-mm-dd',
  timeFormat: '24h',
}

const DisplayPreferencesContext = createContext<DisplayPreferencesContextValue | undefined>(undefined)

function isDateFormatPreference(value: unknown): value is DateFormatPreference {
  return value === 'yyyy-mm-dd' || value === 'dd-mm-yyyy' || value === 'mm-dd-yyyy' || value === 'mm/dd/yyyy'
}

function isTimeFormatPreference(value: unknown): value is TimeFormatPreference {
  return value === '24h' || value === '12h'
}

function parseStoredPreferences(raw: string | null): DisplayPreferencesState {
  if (!raw) return DEFAULT_PREFERENCES

  try {
    const parsed = JSON.parse(raw) as Partial<DisplayPreferencesState>
    const dateFormat = isDateFormatPreference(parsed.dateFormat)
      ? parsed.dateFormat
      : DEFAULT_PREFERENCES.dateFormat
    const timeFormat = isTimeFormatPreference(parsed.timeFormat)
      ? parsed.timeFormat
      : DEFAULT_PREFERENCES.timeFormat
    return { dateFormat, timeFormat }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function toDate(value?: Date | string | number | null): Date | null {
  if (value === undefined || value === null) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function formatDatePart(date: Date, dateFormat: DateFormatPreference): string {
  const y = date.getFullYear()
  const m = pad2(date.getMonth() + 1)
  const d = pad2(date.getDate())

  switch (dateFormat) {
    case 'dd-mm-yyyy':
      return `${d}-${m}-${y}`
    case 'mm-dd-yyyy':
      return `${m}-${d}-${y}`
    case 'mm/dd/yyyy':
      return `${m}/${d}/${y}`
    case 'yyyy-mm-dd':
    default:
      return `${y}-${m}-${d}`
  }
}

function formatTimePart(date: Date, timeFormat: TimeFormatPreference): string {
  const minutes = pad2(date.getMinutes())
  const seconds = pad2(date.getSeconds())

  if (timeFormat === '12h') {
    const hours24 = date.getHours()
    const meridiem = hours24 >= 12 ? 'PM' : 'AM'
    const hours12 = hours24 % 12 || 12
    return `${pad2(hours12)}:${minutes}:${seconds} ${meridiem}`
  }

  return `${pad2(date.getHours())}:${minutes}:${seconds}`
}

export function DisplayPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<DisplayPreferencesState>(() => {
    if (typeof window === 'undefined') return DEFAULT_PREFERENCES
    return parseStoredPreferences(window.localStorage.getItem(STORAGE_KEY))
  })

  const persist = useCallback((next: DisplayPreferencesState) => {
    setPreferences(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    }
  }, [])

  const setDateFormat = useCallback((value: DateFormatPreference) => {
    persist({ ...preferences, dateFormat: value })
  }, [persist, preferences])

  const setTimeFormat = useCallback((value: TimeFormatPreference) => {
    persist({ ...preferences, timeFormat: value })
  }, [persist, preferences])

  const formatDate = useCallback((value?: Date | string | number | null) => {
    const date = toDate(value)
    return date ? formatDatePart(date, preferences.dateFormat) : '-'
  }, [preferences.dateFormat])

  const formatTime = useCallback((value?: Date | string | number | null) => {
    const date = toDate(value)
    return date ? formatTimePart(date, preferences.timeFormat) : '-'
  }, [preferences.timeFormat])

  const formatDateTime = useCallback((value?: Date | string | number | null) => {
    const date = toDate(value)
    if (!date) return '-'
    return `${formatDatePart(date, preferences.dateFormat)} ${formatTimePart(date, preferences.timeFormat)}`
  }, [preferences.dateFormat, preferences.timeFormat])

  const contextValue = useMemo<DisplayPreferencesContextValue>(() => ({
    dateFormat: preferences.dateFormat,
    timeFormat: preferences.timeFormat,
    setDateFormat,
    setTimeFormat,
    formatDate,
    formatTime,
    formatDateTime,
  }), [formatDate, formatDateTime, formatTime, preferences.dateFormat, preferences.timeFormat, setDateFormat, setTimeFormat])

  return <DisplayPreferencesContext.Provider value={contextValue}>{children}</DisplayPreferencesContext.Provider>
}

export function useDisplayPreferences(): DisplayPreferencesContextValue {
  const ctx = useContext(DisplayPreferencesContext)
  if (!ctx) {
    throw new Error('useDisplayPreferences must be used within DisplayPreferencesProvider')
  }
  return ctx
}
