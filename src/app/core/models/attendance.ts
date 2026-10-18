export type AttendanceSessionStatus = 'PLANNED' | 'IN_PROGRESS' | 'CLOSED' | 'CANCELLED';
export type AttendanceMethod = 'MANUAL' | 'LIST' | 'QR' | 'SELF';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'EARLY_DEPARTURE';

export interface AttendanceSession {
  id: string;
  title: string;
  church: string | null;
  church_name: string | null;
  campus: string | null;
  campus_name: string | null;
  session_type: string | null;
  session_type_name: string | null;
  ministry: string | null;
  tribe: string | null;
  event_occurrence: string | null;
  starts_at: string;
  ends_at: string;
  status: AttendanceSessionStatus;
  allowed_methods: AttendanceMethod[];
  tolerance_minutes: number;
  recurrence_frequency: 'NONE' | 'WEEKLY' | 'MONTHLY';
  recurrence_series_id: string | null;
  recurrence_until: string | null;
  opened_at: string | null;
  closed_at: string | null;
  expected_count: number;
  present_count: number;
  recurrence_count: number;
}

export interface AttendanceRecord {
  id: string;
  status: AttendanceStatus;
  checked_in_at: string | null;
  method: AttendanceMethod | null;
  recorded_by: number | string | null;
  departed_at: string | null;
  departure_reason: string;
  updated_at: string;
  excuses?: Array<{ id: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; reason: string }>;
}

export interface ExpectedParticipant {
  id: string;
  member_id: string | null;
  visitor_id: string | null;
  first_name: string;
  last_name: string;
  is_visitor: boolean;
  expected_for_absence: boolean;
  attendance: AttendanceRecord | null;
  addition_reason: string;
  created_at: string;
}

export interface AttendancePage<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface AttendanceSessionType {
  id: string;
  name: string;
  population_rule: 'ALL_MEMBERS' | 'MINISTRY' | 'TRIBE' | 'MANUAL';
  default_methods: AttendanceMethod[];
  tolerance_minutes: number;
  is_active: boolean;
}

export interface AttendanceAlert {
  id: string;
  member: string;
  member_name: string;
  rule_key: string;
  status: 'NEW' | 'SEEN' | 'IN_PROGRESS' | 'RESOLVED';
  trigger_detail: Record<string, string | number>;
  created_at: string;
  resolved_at: string | null;
}

export interface AttendancePolicy {
  id?: string;
  church: string;
  consecutive_absences: number;
  minimum_attendance_rate: number;
  observation_weeks: number;
  evaluation_frequency: 'DAILY' | 'WEEKLY';
  count_excused_absences: boolean;
}

export interface MemberAttendanceHistory {
  session_id: string;
  session_title: string;
  starts_at: string;
  session_status: string;
  expected_for_absence: boolean;
  attendance: AttendanceRecord | null;
}

export interface AttendanceWeeklyReport {
  period: { start: string; end: string };
  sessions: { planned: number; in_progress: number; closed: number; cancelled: number };
  attendance: {
    expected: number;
    present: number;
    absent: number;
    excused: number;
    late: number;
    early_departure: number;
    attendance_rate: number;
  };
}

export interface AttendanceManagerContext {
  is_organization_admin: boolean;
  managed_church_ids: string[];
  default_church_id: string | null;
  church_selection_fixed: boolean;
  churches: AttendanceChurch[];
  campuses: AttendanceCampus[];
}

export interface AttendanceChurch {
  church_id: string;
  name: string;
}

export interface AttendanceCampus {
  campus_id: string;
  name: string;
  church: string;
}

export interface AttendanceMember {
  id: string;
  first_name: string;
  last_name: string;
  church_id: string;
  campus_id: string | null;
}
