import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Task, TaskPriority, TaskStatus, TaskSummary } from '../../core/models/task';
import { TaskService } from '../../core/services/task.service';

type TaskFilter = 'all' | 'todo' | 'in_progress' | 'done' | 'overdue' | 'cancelled';
type TaskView = 'list' | 'calendar';

interface TaskCalendarCell {
  date: string;
  day: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  tasks: Task[];
}

const EMPTY_SUMMARY: TaskSummary = {
  total: 0,
  todo: 0,
  in_progress: 0,
  done: 0,
  cancelled: 0,
  overdue: 0,
  completion_rate: 0,
};

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss',
})
export class TasksComponent implements OnInit, OnDestroy {
  tasks: Task[] = [];
  summary: TaskSummary = { ...EMPTY_SUMMARY };
  loading = true;
  creating = false;
  savingEdit = false;
  deleting = false;
  busyTaskId: string | null = null;
  errorMessage = '';
  successMessage = '';
  filter: TaskFilter = 'all';
  view: TaskView = 'list';
  search = '';
  priorityFilter: TaskPriority | 'ALL' = 'ALL';
  editingId: string | null = null;
  deleteTarget: Task | null = null;
  newTask = {
    title: '',
    description: '',
    priority: 'MEDIUM' as TaskPriority,
    due_date: '',
  };
  editTask = {
    title: '',
    description: '',
    priority: 'MEDIUM' as TaskPriority,
    due_date: '',
    status: 'TODO' as TaskStatus,
  };

  readonly filters: Array<{ key: TaskFilter; label: string }> = [
    { key: 'all', label: 'Toutes' },
    { key: 'todo', label: 'À faire' },
    { key: 'in_progress', label: 'En cours' },
    { key: 'done', label: 'Terminées' },
    { key: 'overdue', label: 'En retard' },
    { key: 'cancelled', label: 'Annulées' },
  ];

  readonly priorityOptions: Array<{ value: TaskPriority; label: string }> = [
    { value: 'LOW', label: 'Basse' },
    { value: 'MEDIUM', label: 'Moyenne' },
    { value: 'HIGH', label: 'Haute' },
    { value: 'URGENT', label: 'Urgente' },
  ];

  readonly statusOptions: Array<{ value: TaskStatus; label: string }> = [
    { value: 'TODO', label: 'À faire' },
    { value: 'IN_PROGRESS', label: 'En cours' },
    { value: 'DONE', label: 'Terminée' },
    { value: 'CANCELLED', label: 'Annulée' },
  ];

  readonly weekdays = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'];
  private calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  readonly todayLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  private noticeTimer?: ReturnType<typeof setTimeout>;

  constructor(private taskService: TaskService) {}

  ngOnInit(): void {
    this.loadTasks(true);
  }

  ngOnDestroy(): void {
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
  }

  loadTasks(showLoader = false): void {
    if (showLoader) this.loading = true;
    this.taskService.list().pipe(finalize(() => (this.loading = false))).subscribe({
      next: (response) => {
        this.tasks = response.results ?? [];
        this.summary = response.summary ?? { ...EMPTY_SUMMARY };
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage = this.describeError(error);
      },
    });
  }

  get visibleTasks(): Task[] {
    const needle = this.search.trim().toLowerCase();
    return this.tasks
      .filter((task) => this.matchesFilter(task))
      .filter((task) => this.priorityFilter === 'ALL' || task.priority === this.priorityFilter)
      .filter((task) => {
        if (!needle) return true;
        return (
          task.title.toLowerCase().includes(needle)
          || (task.description || '').toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => {
        const aClosed = a.status === 'DONE' || a.status === 'CANCELLED';
        const bClosed = b.status === 'DONE' || b.status === 'CANCELLED';
        if (aClosed !== bClosed) return aClosed ? 1 : -1;
        if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1;
        if (a.due_date && b.due_date && a.due_date !== b.due_date) {
          return a.due_date.localeCompare(b.due_date);
        }
        if (a.due_date && !b.due_date) return -1;
        if (!a.due_date && b.due_date) return 1;
        return b.created_at.localeCompare(a.created_at);
      });
  }

  get hasTasks(): boolean {
    return this.tasks.length > 0;
  }

  get calendarMonthLabel(): string {
    return this.calendarMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  get calendarHasTasks(): boolean {
    return this.visibleTasks.some((task) => task.due_date?.startsWith(
      `${this.calendarMonth.getFullYear()}-${String(this.calendarMonth.getMonth() + 1).padStart(2, '0')}`,
    ));
  }

  get calendarCells(): TaskCalendarCell[] {
    const firstDay = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth(), 1);
    const offset = (firstDay.getDay() + 6) % 7;
    const today = this.toDateKey(new Date());
    const tasksByDate = new Map<string, Task[]>();

    for (const task of this.visibleTasks) {
      if (!task.due_date) continue;
      const tasksForDate = tasksByDate.get(task.due_date) ?? [];
      tasksForDate.push(task);
      tasksByDate.set(task.due_date, tasksForDate);
    }

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(firstDay.getFullYear(), firstDay.getMonth(), index - offset + 1);
      const dateKey = this.toDateKey(date);
      return {
        date: dateKey,
        day: date.getDate(),
        inCurrentMonth: date.getMonth() === this.calendarMonth.getMonth(),
        isToday: dateKey === today,
        tasks: tasksByDate.get(dateKey) ?? [],
      };
    });
  }

  shiftCalendarMonth(amount: number): void {
    this.calendarMonth = new Date(
      this.calendarMonth.getFullYear(),
      this.calendarMonth.getMonth() + amount,
      1,
    );
  }

  goToCurrentMonth(): void {
    const today = new Date();
    this.calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  }

  editTaskFromCalendar(task: Task): void {
    this.view = 'list';
    this.beginEdit(task);
  }

  filterCount(key: TaskFilter): number {
    switch (key) {
      case 'todo':
        return this.summary.todo;
      case 'in_progress':
        return this.summary.in_progress;
      case 'done':
        return this.summary.done;
      case 'overdue':
        return this.summary.overdue;
      case 'cancelled':
        return this.summary.cancelled;
      default:
        return this.summary.total;
    }
  }

  addTask(): void {
    const title = this.newTask.title.trim();
    if (!title || this.creating) return;

    this.creating = true;
    this.clearMessages();
    this.taskService
      .create({
        title,
        description: this.newTask.description.trim(),
        priority: this.newTask.priority,
        due_date: this.newTask.due_date || null,
      })
      .pipe(finalize(() => (this.creating = false)))
      .subscribe({
        next: () => {
          this.newTask = { title: '', description: '', priority: 'MEDIUM', due_date: '' };
          this.showSuccess('La tâche a été ajoutée.');
          this.loadTasks();
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage = this.describeError(error);
        },
      });
  }

  beginEdit(task: Task): void {
    this.editingId = task.id;
    this.editTask = {
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      due_date: task.due_date || '',
      status: task.status,
    };
    this.clearMessages();
  }

  cancelEdit(): void {
    this.editingId = null;
  }

  saveEdit(): void {
    const title = this.editTask.title.trim();
    if (!title || !this.editingId || this.savingEdit) return;

    this.savingEdit = true;
    this.clearMessages();
    this.taskService
      .update(this.editingId, {
        title,
        description: this.editTask.description.trim(),
        priority: this.editTask.priority,
        due_date: this.editTask.due_date || null,
        status: this.editTask.status,
      })
      .pipe(finalize(() => (this.savingEdit = false)))
      .subscribe({
        next: () => {
          this.editingId = null;
          this.showSuccess('La tâche a été mise à jour.');
          this.loadTasks();
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage = this.describeError(error);
        },
      });
  }

  changeStatus(task: Task, status: TaskStatus): void {
    if (task.status === status || this.busyTaskId) return;

    this.busyTaskId = task.id;
    this.clearMessages();
    this.taskService
      .update(task.id, { status })
      .pipe(finalize(() => (this.busyTaskId = null)))
      .subscribe({
        next: (updated) => {
          this.tasks = this.tasks.map((item) => (item.id === updated.id ? updated : item));
          this.showSuccess(
            status === 'DONE'
              ? 'Tâche terminée. Bien joué !'
              : 'Le statut de la tâche a été mis à jour.',
          );
          this.loadTasks();
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage = this.describeError(error);
        },
      });
  }

  toggleDone(task: Task): void {
    this.changeStatus(task, task.status === 'DONE' ? 'TODO' : 'DONE');
  }

  requestDelete(task: Task): void {
    this.deleteTarget = task;
    this.clearMessages();
  }

  cancelDelete(): void {
    if (this.deleting) return;
    this.deleteTarget = null;
  }

  confirmDelete(): void {
    if (!this.deleteTarget || this.deleting) return;

    this.deleting = true;
    this.taskService.remove(this.deleteTarget.id).pipe(finalize(() => (this.deleting = false))).subscribe({
      next: () => {
        const title = this.deleteTarget?.title;
        this.deleteTarget = null;
        this.showSuccess(title ? `« ${title} » a été supprimée.` : 'La tâche a été supprimée.');
        this.loadTasks();
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage = this.describeError(error);
      },
    });
  }

  formatDueDate(value: string | null): string {
    if (!value) return '';
    const date = new Date(`${value}T12:00:00`);
    return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  dueDateLabel(task: Task): string {
    if (!task.due_date) return 'Sans échéance';
    const label = this.formatDueDate(task.due_date);
    if (task.is_overdue) return `En retard · ${label}`;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(`${task.due_date}T00:00:00`);
    const days = Math.round((due.getTime() - today.getTime()) / 86400000);
    if (days === 0) return `Aujourd’hui · ${label}`;
    if (days === 1) return `Demain · ${label}`;
    return label;
  }

  trackByTaskId(_index: number, task: Task): string {
    return task.id;
  }

  trackByCalendarCell(_index: number, cell: TaskCalendarCell): string {
    return cell.date;
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private matchesFilter(task: Task): boolean {
    switch (this.filter) {
      case 'todo':
        return task.status === 'TODO';
      case 'in_progress':
        return task.status === 'IN_PROGRESS';
      case 'done':
        return task.status === 'DONE';
      case 'cancelled':
        return task.status === 'CANCELLED';
      case 'overdue':
        return task.is_overdue;
      default:
        return true;
    }
  }

  private clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
    if (this.noticeTimer) {
      clearTimeout(this.noticeTimer);
      this.noticeTimer = undefined;
    }
  }

  private showSuccess(message: string): void {
    this.errorMessage = '';
    this.successMessage = message;
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => {
      this.successMessage = '';
      this.noticeTimer = undefined;
    }, 4000);
  }

  private describeError(error: HttpErrorResponse): string {
    const detail = error.error?.detail;
    if (typeof detail === 'string') return detail;
    if (error.error && typeof error.error === 'object') {
      const values = Object.values(error.error).flat();
      const text = values.filter((value) => typeof value === 'string').join(' ');
      if (text) return text;
    }
    if (error.status === 0) {
      return 'Impossible de joindre le serveur. Vérifiez votre connexion.';
    }
    return error.message || 'Une erreur est survenue lors du chargement de vos tâches.';
  }
}
