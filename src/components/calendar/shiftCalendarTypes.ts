import type { ShiftCalendarFiltersState } from './ShiftCalendarFilters';

export type ShiftWithType = {
  id: string;
  org_id: string;
  shift_type_id: string;
  status: string;
  start_at: string;
  end_at: string;
  assigned_user_id: string | null;
  location: string | null;
  organization_shift_types: {
    id: string;
    name: string;
    letter: string;
    color: string;
    start_time: string | null;
    end_time: string | null;
  } | null;
};

export type ShiftCalendarCache = {
  shifts: ShiftWithType[];
  profilesMap: Record<string, string>;
  staffPositionsMap: Record<string, string>;
};

export type ShiftCalendarRange = { start: Date; end: Date } | null;

export type ShiftCalendarKeyParts = {
  orgId: string;
  start: Date;
  end: Date;
  filters?: ShiftCalendarFiltersState;
};

