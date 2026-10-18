import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EventService } from '../../core/services/event.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <main class="page">
      <section class="card">
        <p class="eyebrow">AUTO-POINTAGE</p>
        <h1>{{ loading ? 'Vérification en cours…' : result?.detail || errorMessage || 'Code manquant' }}</h1>
        <ng-container *ngIf="result as current"><p>{{ current.attendance.attendee_name }} · {{ current.attendance.checked_in_at | date:'dd/MM/yyyy HH:mm' }}</p></ng-container>
        <p class="notice" *ngIf="result?.result === 'ALREADY_CHECKED_IN'">PRÉSENCE DÉJÀ ENREGISTRÉE</p>
        <p class="notice error" *ngIf="errorMessage" role="alert">{{ errorMessage }}</p>
      </section>
    </main>
  `,
  styles: [`
    :host{display:block;color:#25323a}.page{max-width:560px;margin:45px auto;padding:0 14px}.card{padding:25px;background:#fff;border:1px solid #e0e6e6;text-align:center}.card h1{font-size:1.35rem}.eyebrow{color:#148451;font-size:.72rem;font-weight:800}.notice{padding:10px;background:#e9f5ed;color:#23613a}.notice.error{background:#fff0ef;color:#a13333}
  `],
})
export class EventSelfCheckInComponent implements OnInit {
  loading = true;
  errorMessage = '';
  result: { result: string; detail: string; attendance: { attendee_name: string; checked_in_at: string } } | null = null;

  constructor(private route: ActivatedRoute, private events: EventService) {}

  ngOnInit(): void {
    const eventId = this.route.snapshot.paramMap.get('eventId');
    const occurrenceId = this.route.snapshot.paramMap.get('occurrenceId');
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!eventId || !occurrenceId || !token) {
      this.loading = false;
      this.errorMessage = 'Le code d’auto-pointage est incomplet.';
      return;
    }
    this.events.selfCheckIn(eventId, occurrenceId, token).subscribe({
      next: (result) => { this.result = result; this.loading = false; },
      error: (error) => { this.errorMessage = this.errorText(error); this.loading = false; },
    });
  }

  private errorText(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as Record<string, unknown> | string | null;
      if (typeof body === 'string') return body;
      if (body && typeof body === 'object' && typeof body['detail'] === 'string') return body['detail'];
      return `Pointage refusé (HTTP ${error.status}).`;
    }
    return 'Une erreur inattendue est survenue.';
  }
}
