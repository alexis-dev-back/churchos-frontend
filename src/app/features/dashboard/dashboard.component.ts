import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardOverview, DashboardService } from '../../core/services/dashboard.service';
import { Member } from '../../core/models/member';

interface MonthlyPoint {
  label: string;
  value: number;
  height: number;
}

interface BreakdownItem {
  label: string;
  value: number;
  percent: number;
  color: string;
}

interface ChurchBreakdownItem {
  name: string;
  count: number;
  percent: number;
}

interface ModuleKpi {
  label: string;
  value: string;
  note: string;
  tone: string;
  path: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  overview: DashboardOverview | null = null;
  loading = true;
  errorMessage = '';
  readonly todayLabel = this.formatToday();

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.dashboardService.getOverview().subscribe({
      next: (overview) => { this.overview = overview; this.loading = false; },
      error: (error) => { this.errorMessage = error.error?.detail ?? 'Impossible de charger les données du tenant. Vérifiez votre connexion et l’organisation active.'; this.loading = false; },
    });
  }

  get kpis(): Array<{ label: string; value: number; note: string; tone: string }> {
    const data = this.overview;
    if (!data) return [];
    const newMembers = this.newMembersThisMonth;
    return [
      { label: 'Membres', value: data.members.length, note: newMembers ? `+${newMembers} ce mois` : 'Profils rattachés', tone: 'green' },
      { label: 'Personnes', value: data.people.length, note: 'Fiches de personnes', tone: 'blue' },
      { label: 'Familles', value: data.families.length, note: 'Foyers enregistrés', tone: 'orange' },
      { label: 'Églises', value: data.churches.length, note: 'Sites actifs', tone: 'green' },
      { label: 'Campus', value: data.campuses.length, note: 'Sites rattachés', tone: 'blue' },
    ];
  }

  get moduleKpis(): ModuleKpi[] {
    const data = this.overview;
    if (!data) return [];

    const unavailable = 'Indicateur indisponible';
    const now = Date.now();
    const upcomingOccurrences = data.events?.flatMap((event) =>
      ['CANCELLED', 'ARCHIVED', 'COMPLETED'].includes(event.status)
        ? []
        : event.occurrences.filter((occurrence) =>
          new Date(occurrence.starts_at).getTime() >= now
          && !['CANCELLED', 'ARCHIVED', 'COMPLETED'].includes(occurrence.status),
        ),
    ) ?? null;
    const activeChildren = data.ecodim?.reduce((total, dashboard) => total + dashboard.summary.active_children, 0) ?? null;
    const upcomingEcodimSessions = data.ecodim?.reduce((total, dashboard) => total + dashboard.summary.upcoming_sessions, 0) ?? null;

    return [
      {
        label: 'Événements à venir',
        value: upcomingOccurrences === null ? '—' : String(upcomingOccurrences.length),
        note: upcomingOccurrences === null ? unavailable : `${upcomingOccurrences.reduce((total, occurrence) => total + occurrence.registration_count, 0)} inscriptions`,
        tone: 'blue',
        path: '/events',
      },
      {
        label: 'Présence cette semaine',
        value: data.attendance ? `${data.attendance.attendance.attendance_rate}%` : '—',
        note: data.attendance ? `${data.attendance.attendance.present} présent(s) sur ${data.attendance.attendance.expected}` : unavailable,
        tone: 'green',
        path: '/attendance',
      },
      {
        label: 'Finances à traiter',
        value: data.finance ? String(data.finance.reduce((total, summary) => total + summary.pending_transactions, 0)) : '—',
        note: data.finance ? 'Opérations en attente' : unavailable,
        tone: 'orange',
        path: '/finance',
      },
      {
        label: 'Dossiers pastoraux ouverts',
        value: data.pastoral ? String(data.pastoral.open_cases) : '—',
        note: data.pastoral ? `${data.pastoral.overdue_tasks} tâche(s) en retard` : unavailable,
        tone: 'blue',
        path: '/pastoral',
      },
      {
        label: 'Enfants ECODIM actifs',
        value: activeChildren === null ? '—' : String(activeChildren),
        note: upcomingEcodimSessions === null ? unavailable : `${upcomingEcodimSessions} séance(s) à venir`,
        tone: 'green',
        path: '/ecodim',
      },
      {
        label: 'Ministères actifs',
        value: data.ministries ? String(data.ministries.filter((item) => item.status === 'ACTIVE').length) : '—',
        note: data.ministries ? `${data.ministries.length} ministère(s) au total` : unavailable,
        tone: 'orange',
        path: '/ministries',
      },
      {
        label: 'Tribus actives',
        value: data.tribes ? String(data.tribes.filter((item) => item.status === 'ACTIVE').length) : '—',
        note: data.tribes ? `${data.tribes.length} tribu(s) au total` : unavailable,
        tone: 'blue',
        path: '/tribes',
      },
    ];
  }

  get activeMembers(): number {
    return this.overview?.members.filter((member) => member.status === 'ACTIVE').length ?? 0;
  }

  get newMembersThisMonth(): number {
    const now = new Date();
    return (this.overview?.members ?? []).filter((member) => {
      if (!member.created_at) return false;
      const date = new Date(member.created_at);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;
  }

  get monthlySeries(): MonthlyPoint[] {
    const members = this.overview?.members ?? [];
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const label = new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(date).replace('.', '');
      const value = members.filter((member) => {
        if (!member.created_at) return false;
        const created = new Date(member.created_at);
        return created.getMonth() === date.getMonth() && created.getFullYear() === date.getFullYear();
      }).length;
      return { label: label.charAt(0).toUpperCase() + label.slice(1), value };
    });
    const max = Math.max(...months.map((point) => point.value), 1);
    return months.map((point) => ({ ...point, height: point.value === 0 ? 3 : Math.max(8, Math.round((point.value / max) * 100)) }));
  }

  get statusBreakdown(): BreakdownItem[] {
    const members = this.overview?.members ?? [];
    const total = members.length || 1;
    const active = members.filter((member) => member.status === 'ACTIVE').length;
    const pending = members.filter((member) => member.status === 'PENDING').length;
    const suspended = members.filter((member) => member.status === 'SUSPENDED' || member.status === 'ARCHIVED').length;
    const other = Math.max(0, members.length - active - pending - suspended);
    const items = [
      { label: 'Actifs', value: active, color: '#2A8768' },
      { label: 'En attente', value: pending, color: '#F07020' },
      { label: 'Suspendus', value: suspended, color: '#0949A3' },
      { label: 'Autres', value: other, color: '#CBD6D1' },
    ];
    return items.map((item) => ({ ...item, percent: Math.round((item.value / total) * 100) }));
  }

  get donutGradient(): string {
    const items = this.statusBreakdown;
    const total = items.reduce((sum, item) => sum + item.value, 0);
    if (!total) return 'conic-gradient(#E6EBE8 0deg 360deg)';
    let cursor = 0;
    const stops: string[] = [];
    for (const item of items) {
      const sweep = (item.value / total) * 360;
      if (sweep <= 0) continue;
      stops.push(`${item.color} ${cursor}deg ${cursor + sweep}deg`);
      cursor += sweep;
    }
    return `conic-gradient(${stops.join(', ')})`;
  }

  get recentMembers(): Member[] {
    return [...(this.overview?.members ?? [])]
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
      .slice(0, 6);
  }

  get churchBreakdown(): ChurchBreakdownItem[] {
    const members = this.overview?.members ?? [];
    const total = members.length || 1;
    const counts = new Map<string, number>();
    for (const member of members) {
      const name = this.churchName(member);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count, percent: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  get familyWithMembers(): number {
    return this.overview?.families.filter((family) => (family.member_count ?? 0) > 0).length ?? 0;
  }

  initials(member: Member): string {
    return `${member.first_name?.slice(0, 1) ?? ''}${member.last_name?.slice(0, 1) ?? ''}`.toUpperCase() || 'M';
  }

  churchName(member: Member): string {
    if (!member.church) return 'Non affecté';
    if (typeof member.church === 'object') return member.church.name || 'Église';
    const church = this.overview?.churches.find((item) => item.church_id === member.church);
    return church?.name || 'Église';
  }

  statusLabel(status?: string): string {
    const labels: Record<string, string> = {
      ACTIVE: 'Actif',
      PENDING: 'En attente',
      SUSPENDED: 'Suspendu',
      ARCHIVED: 'Archivé',
    };
    return labels[status ?? ''] ?? (status || 'Inconnu');
  }

  formatDate(value?: string): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  }

  private formatToday(): string {
    const date = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date());
    return date.charAt(0).toUpperCase() + date.slice(1);
  }
}
