export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  status_label: string;
  priority: TaskPriority;
  priority_label: string;
  due_date: string | null;
  completed_at: string | null;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskSummary {
  total: number;
  todo: number;
  in_progress: number;
  done: number;
  cancelled: number;
  overdue: number;
  completion_rate: number;
}

export interface TaskListResponse {
  results: Task[];
  summary: TaskSummary;
}

export interface TaskWritePayload {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
}

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  search?: string;
  overdue?: boolean;
}
