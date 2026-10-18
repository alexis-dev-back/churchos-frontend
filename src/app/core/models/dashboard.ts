export interface DashboardStatistics {
  members: number;
  families: number;
  events: number;
  donations: number;
  membersDelta: number;
  familiesDelta: number;
  donationsDelta: number;
}

export interface AttendancePoint {
  label: string;
  value: number;
}

export interface MinistryDistribution {
  label: string;
  value: number;
  percent: number;
  color: string;
}

export interface EventItem {
  date: string;
  day: string;
  title: string;
  location: string;
  time: string;
  color: string;
}

export interface ActivityItem {
  title: string;
  subtitle: string;
  time: string;
  color: string;
}

export interface PriorityTask {
  title: string;
  schedule: string;
  level: 'URGENT' | 'IMPORTANT' | 'NORMAL';
}

export interface DonationPoint {
  month: string;
  value: number;
}

export interface RecentMember {
  name: string;
  status: string;
  age: number;
  time: string;
  avatar: string;
}
