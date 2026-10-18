import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { jsPDF } from 'jspdf';
import * as QRCode from 'qrcode';
import { EventOccurrence, EventRegistrationResult, PublicEventDetails } from '../../core/models/event';
import { EventService } from '../../core/services/event.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="page">
      <p class="eyebrow">INSCRIPTION À UN ÉVÉNEMENT</p>
      <p class="notice error" *ngIf="errorMessage" role="alert">{{ errorMessage }}</p>
      <p class="empty" *ngIf="loading">Chargement de l’événement…</p>
      <section class="card" *ngIf="event">
        <h1>{{ event.title }}</h1><p>{{ event.description }}</p><p class="muted">{{ event.location }} · {{ event.timezone }}</p>
        <ng-container *ngIf="!result">
          <label>Séance<select [(ngModel)]="occurrenceId" name="occurrence"><option *ngFor="let occurrence of event.occurrences" [value]="occurrence.id">{{ occurrence.starts_at | date:'EEEE d MMMM y, HH:mm':event.timezone }} · {{ occurrence.capacity === null ? 'Places ouvertes' : (occurrence.registration_count + occurrence.offered_count) + '/' + occurrence.capacity }}</option></select></label>
          <p class="notice" *ngIf="selectedOccurrence?.registration_mode === 'DISABLED'">Les inscriptions ne sont pas activées pour cette séance.</p>
          <form (ngSubmit)="register()" *ngIf="selectedOccurrence && selectedOccurrence.registration_mode !== 'DISABLED'">
            <label>Prénom<input [(ngModel)]="guest.first_name" name="first_name" autocomplete="given-name" /></label>
            <label>Nom<input [(ngModel)]="guest.last_name" name="last_name" autocomplete="family-name" /></label>
            <label>Courriel<input type="email" [(ngModel)]="guest.email" name="email" autocomplete="email" /></label>
            <label>Téléphone<input type="tel" [(ngModel)]="guest.phone" name="phone" autocomplete="tel" /></label>
            <p class="muted">Un téléphone ou une adresse électronique est requis pour les visiteurs. Les membres authentifiés sont reconnus automatiquement.</p>
            <button class="primary" type="submit" [disabled]="saving">{{ saving ? 'Enregistrement…' : 'Confirmer mon inscription' }}</button>
          </form>
        </ng-container>
        <section class="confirmation" *ngIf="result">
          <h2>{{ result.status === 'CONFIRMED' ? 'Inscription confirmée' : result.status === 'WAITLISTED' ? 'Ajouté à la liste d’attente' : result.status === 'CANCELLED' ? 'Inscription annulée' : result.status === 'OFFERED' ? 'Une place vous est proposée' : 'Demande clôturée' }}</h2>
          <p *ngIf="result.status === 'CONFIRMED'">Présentez ce QR code à l’accueil. Le scan ne confirme pas lui-même votre présence.</p>
          <img *ngIf="qrDataUrl" [src]="qrDataUrl" alt="QR code individuel d’inscription" />
          <div class="qr-token" *ngIf="result.status === 'CONFIRMED' && result.verification_code">
            <p>Si le QR code ne peut pas être scanné, présentez ou saisissez ce code de secours :</p>
            <code>{{ result.verification_code }}</code>
            <button class="secondary" type="button" (click)="copyVerificationCode()">{{ verificationCodeCopied ? 'Code copié' : 'Copier le code' }}</button>
            <button class="primary" type="button" [disabled]="!qrDataUrl" (click)="downloadReceipt()">Télécharger mon reçu PDF</button>
          </div>
          <p *ngIf="result.status === 'WAITLISTED'">Une place vous sera proposée si elle se libère. Conservez le code de gestion pour répondre à l’offre.</p>
          <p class="secret" *ngIf="result.manage_token"><strong>Code privé de gestion :</strong> {{ result.manage_token }}<br/>Conservez-le pour annuler cette inscription ou répondre à une proposition. Il ne sera plus affiché.</p>
          <div class="actions" *ngIf="result.status === 'WAITLISTED' || result.status === 'OFFERED'">
            <button class="secondary" type="button" (click)="refreshRegistration()">Vérifier l’état de ma demande</button>
            <button class="primary" type="button" *ngIf="result.status === 'OFFERED'" (click)="respondToOffer(true)">Accepter la place</button>
            <button class="secondary" type="button" *ngIf="result.status === 'OFFERED'" (click)="respondToOffer(false)">Refuser</button>
          </div>
          <button class="danger" type="button" *ngIf="result.status === 'CONFIRMED' || result.status === 'WAITLISTED' || result.status === 'OFFERED'" (click)="cancelRegistration()">Annuler mon inscription</button>
        </section>
      </section>
    </main>
  `,
  styles: [`
    :host{display:block;color:#25323a}.page{max-width:700px;margin:30px auto;padding:0 14px 35px}.eyebrow{color:#148451;font-size:.75rem;font-weight:800}.card{padding:24px;background:#fff;border:1px solid #e0e6e6}.card h1{margin:0;font-size:1.6rem}.card>p{color:#5e6d72}.muted{color:#718087!important;font-size:.82rem}.card label{display:grid;gap:6px;margin:12px 0;color:#53615e;font-size:.82rem;font-weight:700}.card input,.card select{min-height:42px;padding:8px 10px;border:1px solid #cfd9d6;font:inherit}.primary,.secondary,.danger{min-height:42px;padding:9px 14px;border:1px solid #176b50;background:#176b50;color:#fff;font-weight:700;cursor:pointer}.secondary{background:#fff;color:#34434a;border-color:#d4dfdc}.danger{border-color:#bb4444;background:#fff;color:#a33434}.actions{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.primary:disabled{opacity:.55}.notice{padding:10px;background:#f3f8f5;color:#42534c;font-size:.83rem}.notice.error{background:#fff0ef;color:#a13333}.confirmation{margin-top:20px;padding-top:15px;border-top:1px solid #edf0f0}.confirmation img{display:block;width:230px;height:230px;margin:15px auto}.qr-token{display:grid;gap:8px;padding:12px;background:#f3f8f5}.qr-token p{margin:0;font-size:.85rem}.qr-token code{padding:8px;background:#fff;border:1px solid #dce4e2;overflow-wrap:anywhere;user-select:all}.qr-token button{justify-self:start}.secret{padding:12px;background:#fff7e8;overflow-wrap:anywhere}.empty{padding:20px;text-align:center}
  `],
})
export class PublicEventRegistrationComponent implements OnInit {
  eventId = '';
  event: PublicEventDetails | null = null;
  occurrenceId = '';
  result: EventRegistrationResult | null = null;
  qrDataUrl = '';
  verificationCodeCopied = false;
  guest = { first_name: '', last_name: '', email: '', phone: '' };
  loading = false;
  saving = false;
  errorMessage = '';

  constructor(private route: ActivatedRoute, private events: EventService) {}

  get selectedOccurrence(): EventOccurrence | undefined {
    return this.event?.occurrences.find((occurrence) => occurrence.id === this.occurrenceId);
  }

  ngOnInit(): void {
    this.eventId = this.route.snapshot.paramMap.get('eventId') || '';
    if (!this.eventId) return;
    this.loading = true;
    this.events.publicEvent(this.eventId).subscribe({
      next: (event) => { this.event = event; this.occurrenceId = event.occurrences[0]?.id || ''; this.loading = false; },
      error: (error) => { this.errorMessage = this.errorText(error); this.loading = false; },
    });
  }

  register(): void {
    if (!this.eventId || !this.occurrenceId) return;
    this.saving = true;
    this.events.register(this.eventId, this.occurrenceId, this.guest).subscribe({
      next: async (result) => {
        this.result = result;
        this.saving = false;
        if (result.qr_token) {
          try {
            await this.renderQr(result.qr_token);
          } catch (error) {
            this.errorMessage = this.errorText(error);
          }
        }
      },
      error: (error) => { this.errorMessage = this.errorText(error); this.saving = false; },
    });
  }

  refreshRegistration(): void {
    if (!this.result) return;
    this.events.registrationStatus(this.result.registration.id, this.result.manage_token || undefined).subscribe({
      next: (registration) => this.result = { ...this.result!, registration, status: registration.status },
      error: (error) => this.errorMessage = this.errorText(error),
    });
  }

  cancelRegistration(): void {
    if (!this.result || !window.confirm('Annuler cette inscription ?')) return;
    this.events.cancelRegistration(this.result.registration.id, this.result.manage_token || undefined).subscribe({
      next: (registration) => {
        this.result = { ...this.result!, registration, status: registration.status, qr_token: null };
        this.qrDataUrl = '';
      },
      error: (error) => this.errorMessage = this.errorText(error),
    });
  }

  respondToOffer(accept: boolean): void {
    if (!this.result) return;
    this.events.respondToOffer(this.result.registration.id, accept, this.result.manage_token || undefined).subscribe({
      next: async ({ registration, qr_token, verification_code }) => {
        this.result = { ...this.result!, registration, status: registration.status, qr_token, verification_code };
        this.qrDataUrl = '';
        this.verificationCodeCopied = false;
        if (qr_token) await this.renderQr(qr_token);
      },
      error: (error) => this.errorMessage = this.errorText(error),
    });
  }

  private async renderQr(token: string): Promise<void> {
    try {
      this.qrDataUrl = await QRCode.toDataURL(token, { width: 250, margin: 1 });
    } catch (error) {
      this.errorMessage = this.errorText(error);
    }
  }

  async copyVerificationCode(): Promise<void> {
    const code = this.result?.verification_code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      this.verificationCodeCopied = true;
      this.errorMessage = '';
    } catch (error: unknown) {
      this.errorMessage = error instanceof Error
        ? `La copie automatique a échoué : ${error.message}. Vous pouvez recopier le code affiché.`
        : 'La copie automatique a échoué. Vous pouvez recopier le code affiché.';
    }
  }

  downloadReceipt(): void {
    if (!this.event || !this.selectedOccurrence || !this.result?.qr_token || !this.result.verification_code || !this.qrDataUrl) return;
    try {
      const document = new jsPDF();
      const pageWidth = document.internal.pageSize.getWidth();
      const margin = 18;
      const lineWidth = pageWidth - margin * 2;
      let y = 20;
      const write = (text: string, size = 11, bold = false): void => {
        document.setFont('helvetica', bold ? 'bold' : 'normal');
        document.setFontSize(size);
        const lines = document.splitTextToSize(text, lineWidth);
        const height = lines.length * size * 0.48;
        if (y + height > 275) {
          document.addPage();
          y = 20;
        }
        document.text(lines, margin, y);
        y += height + 5;
      };
      const attendeeName = this.result.registration.attendee_name
        || `${this.guest.first_name} ${this.guest.last_name}`.trim();
      const occurrencePlace = this.selectedOccurrence.location || this.event.location || 'Non précisé';
      const scopeName = this.event.scope === 'CHURCH'
        ? `Église : ${this.event.church_name || 'Non précisée'}`
        : this.event.scope === 'CAMPUS'
          ? `Campus : ${this.event.campus_name || 'Non précisé'}`
          : 'Organisation';

      write('REÇU DE CONFIRMATION D’INSCRIPTION', 16, true);
      write(this.event.title, 14, true);
      write(`Périmètre : ${scopeName}`);
      if (this.event.category) write(`Catégorie : ${this.event.category}`);
      if (this.event.description) write(`Description : ${this.event.description}`);
      write(`Lieu : ${occurrencePlace}`);
      write(`Début : ${this.formatEventDate(this.selectedOccurrence.starts_at)}`);
      write(`Fin : ${this.formatEventDate(this.selectedOccurrence.ends_at)}`);
      write(`Fuseau horaire : ${this.event.timezone}`);
      write(`Inscription : ${this.selectedOccurrence.registration_mode === 'REQUIRED' ? 'Obligatoire' : 'Facultative'}`);
      write(`Pointage : ${
        this.selectedOccurrence.checkin_mode === 'REGISTRATION'
          ? 'QR ou code de secours'
          : this.selectedOccurrence.checkin_mode === 'SELF'
            ? 'Auto-pointage'
            : 'Non activé'
      }`);
      write(`Participant : ${attendeeName}`);
      if (this.result.registration.attendee_email || this.guest.email) {
        write(`Courriel : ${this.result.registration.attendee_email || this.guest.email}`);
      }
      if (this.result.registration.attendee_phone || this.guest.phone) {
        write(`Téléphone : ${this.result.registration.attendee_phone || this.guest.phone}`);
      }
      write(`Statut : Inscription confirmée`);
      write(`Code de secours : ${this.result.verification_code}`, 13, true);
      write(`Référence : ${this.result.registration.id}`);
      write(`Reçu généré le : ${new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: this.event.timezone,
      }).format(new Date())}`);
      if (y + 75 > 275) {
        document.addPage();
        y = 20;
      }
      document.addImage(this.qrDataUrl, 'PNG', margin, y + 3, 55, 55);
      document.setFontSize(9);
      document.text('Présentez ce QR ou le code de secours à l’accueil.', margin, y + 65);
      document.save(`recu-inscription-${this.event.id.slice(0, 8)}.pdf`);
    } catch (error: unknown) {
      this.errorMessage = this.errorText(error);
    }
  }

  private formatEventDate(value: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: this.event?.timezone || 'UTC',
    }).format(new Date(value));
  }

  private errorText(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as Record<string, unknown> | string | null;
      if (typeof body === 'string') return body;
      if (body && typeof body === 'object') {
        if (typeof body['detail'] === 'string') return body['detail'];
        return Object.entries(body).map(([key, value]) => `${key} : ${Array.isArray(value) ? value.join(', ') : value}`).join(' · ');
      }
      return `Erreur API (${error.status}).`;
    }
    return error instanceof Error ? error.message : 'Une erreur inattendue est survenue.';
  }
}
