export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
export type EventScope = 'ORGANIZATION' | 'CHURCH' | 'CAMPUS';
export type RegistrationMode = 'DISABLED' | 'OPTIONAL' | 'REQUIRED';
export type CheckInMode = 'DISABLED' | 'REGISTRATION' | 'SELF';

export interface EventOccurrence {
  id: string;
  starts_at: string;
  ends_at: string;
  status: EventStatus;
  location: string;
  registration_mode: RegistrationMode;
  capacity: number | null;
  waitlist_enabled: boolean;
  checkin_mode: CheckInMode;
  checkin_opens_at: string | null;
  checkin_closes_at: string | null;
  registration_count: number;
  waitlist_count: number;
  offered_count: number;
  attendance_count: number;
}

export interface EventChurchReference {
  church_id: string;
  name: string;
}

export interface ChurchEvent {
  id: string;
  organization: string;
  scope: EventScope;
  church: string | null;
  church_name: string | null;
  campus: string | null;
  campus_name: string | null;
  included_churches: EventChurchReference[];
  title: string;
  description: string;
  category: string;
  location: string;
  timezone: string;
  status: EventStatus;
  recurrence_frequency: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  recurrence_interval: number;
  recurrence_until: string | null;
  occurrences: EventOccurrence[];
  created_at: string;
  updated_at: string;
}

export interface EventWriteRequest {
  scope: EventScope;
  church_id?: string;
  campus_id?: string;
  included_church_ids?: string[];
  title: string;
  description?: string;
  category?: string;
  location?: string;
  timezone?: string;
  recurrence_frequency?: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  recurrence_interval?: number;
  recurrence_until?: string | null;
  starts_at: string;
  ends_at: string;
  occurrence_location?: string;
  registration_mode?: RegistrationMode;
  capacity?: number | null;
  waitlist_enabled?: boolean;
  checkin_mode?: CheckInMode;
  checkin_opens_at?: string | null;
  checkin_closes_at?: string | null;
}

export interface EventRegistration {
  id: string;
  occurrence: string;
  member: string | null;
  person: string | null;
  attendee_name: string;
  attendee_email: string | null;
  attendee_phone: string | null;
  status: 'CONFIRMED' | 'WAITLISTED' | 'OFFERED' | 'CANCELLED' | 'DECLINED' | 'EXPIRED';
  offer_expires_at: string | null;
  created_at: string;
  cancelled_at: string | null;
}

export interface EventAttendance {
  id: string;
  occurrence: string;
  registration: string | null;
  member: string | null;
  attendee_name: string;
  attendee_phone: string | null;
  state: 'PRESENT' | 'REVOKED';
  checked_in_at: string;
  checked_in_by: number | string | null;
  source: string;
}

export interface EventRegistrationResult {
  registration: EventRegistration;
  qr_token: string | null;
  verification_code: string | null;
  manage_token: string | null;
  status: EventRegistration['status'];
}

export interface PublicEventDetails {
  id: string;
  title: string;
  description: string;
  category: string;
  scope: EventScope;
  church_name: string | null;
  campus_name: string | null;
  location: string;
  timezone: string;
  occurrences: EventOccurrence[];
}

export interface EventScanResult {
  result: 'VALID' | 'CANCELLED' | 'INELIGIBLE' | 'ALREADY_CHECKED_IN' | 'INVALID' | 'WRONG_OCCURRENCE';
  detail: string;
  attendee?: {
    name: string;
    phone: string | null;
    registered_at: string;
    registration_status: string;
    event: string;
    occurrence_id: string;
  };
  registration_id?: string;
  checked_in_at?: string;
  occurrence_status?: EventStatus;
}

export interface EventStatistics {
  event_id: string;
  occurrences: Array<{
    occurrence_id: string;
    starts_at: string;
    status: EventStatus;
    capacity: number | null;
    confirmed: number;
    offered: number;
    waitlisted: number;
    remaining: number | null;
    attendance: number;
  }>;
}

export interface EventManagerAccess {
  can_manage: boolean;
  is_organization_admin: boolean;
  churches: Array<{ church_id: string; name: string }>;
}

export interface ChurchEventAdministrator {
  member_id: string;
  name: string;
  email: string;
}
