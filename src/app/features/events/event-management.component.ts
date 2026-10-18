import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import * as QRCode from 'qrcode';
import { Church, Campus } from '../../core/models/tenant';
import { ChurchEvent, EventAttendance, EventManagerAccess, EventOccurrence, EventRegistration, EventScanResult, EventWriteRequest } from '../../core/models/event';
import { EventService } from '../../core/services/event.service';
import { TenantService } from '../../core/services/tenant.service';

interface EventCalendarEntry {
  event: ChurchEvent;
  occurrence: EventOccurrence;
}

interface EventCalendarCell {
  day: number | null;
  entries: EventCalendarEntry[];
}

@Component({
  selector: 'app-event-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <main class="page">
      <ng-container *ngIf="!eventId; else eventDetail">
        <header class="heading"><div><p class="eyebrow">VIE DE L’ÉGLISE</p><h1>Événements</h1><p>Organisez les événements, inscriptions et présences.</p></div><button class="primary" type="button" (click)="showCreate = !showCreate">Nouvel événement</button></header>
        <p class="notice error" *ngIf="errorMessage" role="alert">{{ errorMessage }}</p>
        <nav class="view-tabs" aria-label="Affichage des événements">
          <button type="button" [class.active]="!calendarView" (click)="setCalendarView(false)">Liste</button>
          <button type="button" [class.active]="calendarView" (click)="setCalendarView(true)">Calendrier</button>
        </nav>
        <div class="toolbar"><input aria-label="Rechercher" placeholder="Rechercher un événement" [value]="search" (input)="search = valueOf($event); loadEvents()" /><input aria-label="Catégorie" placeholder="Catégorie" [value]="categoryFilter" (input)="categoryFilter = valueOf($event); loadEvents()" /><select aria-label="Filtrer par périmètre" [value]="scopeFilter" (change)="scopeFilter = valueOf($event); loadEvents()"><option value="">Tous les périmètres</option><option value="ORGANIZATION">Organisation</option><option value="CHURCH">Église</option><option value="CAMPUS">Campus</option></select><ng-container *ngIf="!calendarView"><select aria-label="Filtrer par statut" [value]="statusFilter" (change)="statusFilter = valueOf($event); loadEvents()"><option value="">Tous les statuts</option><option value="DRAFT">Brouillons</option><option value="PUBLISHED">Publiés</option><option value="IN_PROGRESS">En cours</option><option value="COMPLETED">Terminés</option><option value="CANCELLED">Annulés</option><option value="ARCHIVED">Archivés</option></select><input aria-label="À partir du" type="date" [value]="startsAfter" (change)="startsAfter = valueOf($event); loadEvents()" /><input aria-label="Jusqu’au" type="date" [value]="startsBefore" (change)="startsBefore = valueOf($event); loadEvents()" /></ng-container></div>
        <nav class="status-tabs" *ngIf="!calendarView" aria-label="Filtrer les événements par statut">
          <button type="button" [class.active]="statusFilter === ''" (click)="setStatusFilter('')">Tous</button>
          <button type="button" [class.active]="statusFilter === 'PUBLISHED'" (click)="setStatusFilter('PUBLISHED')">Publiés</button>
          <button type="button" [class.active]="statusFilter === 'IN_PROGRESS'" (click)="setStatusFilter('IN_PROGRESS')">En cours</button>
          <button type="button" [class.active]="statusFilter === 'CANCELLED'" (click)="setStatusFilter('CANCELLED')">Annulés</button>
          <button type="button" [class.active]="statusFilter === 'ARCHIVED'" (click)="setStatusFilter('ARCHIVED')">Archivés</button>
        </nav>
        <section class="calendar-panel" *ngIf="calendarView">
          <header class="calendar-toolbar">
            <div class="calendar-navigation"><button class="secondary" type="button" aria-label="Mois précédent" (click)="shiftCalendarMonth(-1)">←</button><button class="secondary" type="button" (click)="goToCurrentMonth()">Aujourd’hui</button><button class="secondary" type="button" aria-label="Mois suivant" (click)="shiftCalendarMonth(1)">→</button></div>
            <h2>{{ calendarMonthLabel }} {{ calendarYear }}</h2>
            <div class="calendar-filters"><label>Mois<select aria-label="Filtrer par mois" [value]="calendarMonth" (change)="setCalendarMonth(valueOf($event))"><option *ngFor="let month of calendarMonths" [value]="month.value">{{ month.label }}</option></select></label><label>Année<select aria-label="Filtrer par année" [value]="calendarYear" (change)="setCalendarYear(valueOf($event))"><option *ngFor="let year of calendarYears" [value]="year">{{ year }}</option></select></label></div>
          </header>
          <p class="calendar-caption">Tous les événements et toutes leurs séances pour le mois sélectionné.</p>
          <p class="empty" *ngIf="loading">Chargement des événements…</p>
          <div class="calendar-grid" *ngIf="!loading">
            <div class="weekday" *ngFor="let weekday of weekdays">{{ weekday }}</div>
            <div class="calendar-cell" *ngFor="let cell of calendarCells; trackBy: trackByCalendarCell" [class.outside]="cell.day === null">
              <span class="day-number" *ngIf="cell.day !== null">{{ cell.day }}</span>
              <a class="calendar-event" *ngFor="let entry of cell.entries; trackBy: trackByCalendarEntry" [routerLink]="['/events', entry.event.id]" [title]="entry.event.title">
                <time>{{ entry.occurrence.starts_at | date:'HH:mm':entry.event.timezone }}</time><span>{{ entry.event.title }}</span><small>{{ entry.event.church_name || entry.event.campus_name || 'Organisation' }}</small>
              </a>
            </div>
          </div>
          <p class="empty" *ngIf="!loading && !calendarEntriesForMonth.length">Aucun événement ce mois-ci.</p>
        </section>
        <section class="create-panel" *ngIf="showCreate">
          <h2>Créer un événement</h2>
          <form [formGroup]="eventForm" (ngSubmit)="createEvent()">
            <div class="form-grid">
              <label>Titre *<input formControlName="title" /></label>
              <label>Catégorie<input formControlName="category" /></label>
              <label *ngIf="access?.is_organization_admin && !churchSelectionFixed">Périmètre<select formControlName="scope"><option value="CHURCH">Église</option><option value="CAMPUS">Campus</option><option value="ORGANIZATION">Organisation</option></select></label>
              <label *ngIf="eventForm.controls.scope.value === 'CHURCH' && !churchSelectionFixed">Église<select formControlName="church_id"><option value="">Choisir une église</option><option *ngFor="let church of churches" [value]="church.church_id">{{ church.name }}</option></select></label>
              <label *ngIf="eventForm.controls.scope.value === 'CAMPUS'">Campus<select formControlName="campus_id"><option value="">Choisir un campus</option><option *ngFor="let campus of availableCampuses" [value]="campus.campus_id">{{ campus.name }}</option></select></label>
              <label *ngIf="eventForm.controls.scope.value === 'ORGANIZATION' && !churchSelectionFixed">Églises concernées (vide = toute l’organisation)<select multiple (change)="selectChurchIds($event)"><option *ngFor="let church of churches" [value]="church.church_id" [selected]="includedChurchIds.includes(church.church_id)">{{ church.name }}</option></select></label>
              <label>Lieu<input formControlName="location" /></label>
              <label>Début *<input type="datetime-local" formControlName="starts_at" /></label>
              <label>Fin *<input type="datetime-local" formControlName="ends_at" /></label>
              <label>Fuseau horaire<input formControlName="timezone" /></label>
              <label>Inscription<select formControlName="registration_mode"><option value="DISABLED">Désactivée</option><option value="OPTIONAL">Facultative</option><option value="REQUIRED">Obligatoire</option></select></label>
              <label>Capacité<input type="number" min="1" formControlName="capacity" placeholder="Sans limite" /></label>
              <label>Pointage<select formControlName="checkin_mode"><option value="DISABLED">Désactivé</option><option value="REGISTRATION">Avec inscription</option><option value="SELF">Autonome par QR code</option></select></label>
              <label>Récurrence<select formControlName="recurrence_frequency"><option value="NONE">Aucune</option><option value="DAILY">Quotidienne</option><option value="WEEKLY">Hebdomadaire</option><option value="MONTHLY">Mensuelle</option></select></label>
              <label *ngIf="eventForm.controls.recurrence_frequency.value !== 'NONE'">Répéter tous les<input type="number" min="1" max="52" formControlName="recurrence_interval" /></label>
              <label *ngIf="eventForm.controls.recurrence_frequency.value !== 'NONE'">Jusqu’au<input type="date" formControlName="recurrence_until" /></label>
            </div>
            <label>Description<textarea rows="3" formControlName="description"></textarea></label>
            <label class="check"><input type="checkbox" formControlName="waitlist_enabled" /> Activer la liste d’attente</label>
            <div class="actions"><button class="primary" type="submit" [disabled]="eventForm.invalid || saving">{{ saving ? 'Enregistrement…' : 'Créer le brouillon' }}</button><button class="secondary" type="button" (click)="showCreate = false">Annuler</button></div>
          </form>
        </section>
        <p class="empty" *ngIf="loading">Chargement des événements…</p>
        <section class="cards" *ngIf="!loading && !calendarView"><article class="card" *ngFor="let event of events"><div class="card-head"><div><h2>{{ event.title }}</h2><small>{{ event.scope === 'CAMPUS' ? event.campus_name : event.church_name || 'Organisation' }} · {{ event.category || 'Sans catégorie' }}</small></div><span class="status" [attr.data-status]="event.status">{{ statusLabel(event.status) }}</span></div><p>{{ event.description || 'Aucune description.' }}</p><small>{{ event.occurrences.length ? (event.occurrences[0].starts_at | date:'dd/MM/yyyy HH:mm':event.timezone) : 'Séance à planifier' }} · {{ event.occurrences.length }} séance(s)</small><a [routerLink]="['/events', event.id]">Ouvrir le dossier →</a></article><p class="empty" *ngIf="!events.length">Aucun événement à afficher.</p></section>
      </ng-container>

      <ng-template #eventDetail>
        <a class="back" routerLink="/events">← Retour aux événements</a>
        <p class="notice error" *ngIf="errorMessage" role="alert">{{ errorMessage }}</p>
        <p class="notice success" *ngIf="successMessage" role="status">{{ successMessage }}</p>
        <p class="empty" *ngIf="loading">Chargement…</p>
        <ng-container *ngIf="event as item">
          <header class="heading"><div><p class="eyebrow">{{ item.scope }} · {{ item.category || 'Événement' }}</p><h1>{{ item.title }}</h1><p>{{ item.description }}</p></div><span class="status" [attr.data-status]="item.status">{{ statusLabel(item.status) }}</span></header>
          <section class="panel" *ngIf="item.status !== 'ARCHIVED' && item.status !== 'CANCELLED'"><button class="secondary" type="button" (click)="openSeriesEditor()">Modifier la série</button><form *ngIf="showSeriesEdit" class="edit-form" [formGroup]="seriesForm" (ngSubmit)="saveSeries()"><h2>Modifier l’événement et ses prochaines séances</h2><div class="form-grid"><label>Titre<input formControlName="title" /></label><label>Lieu de l’événement<input formControlName="location" /></label><label>Catégorie<input formControlName="category" /></label><label>Début de la prochaine séance<input type="datetime-local" formControlName="starts_at" /></label><label>Fin de la prochaine séance<input type="datetime-local" formControlName="ends_at" /></label><label>Lieu de la séance<input formControlName="occurrence_location" /></label></div><label>Description<textarea rows="3" formControlName="description"></textarea></label><div class="actions"><button class="primary" type="submit" [disabled]="saving">Enregistrer les changements futurs</button><button class="secondary" type="button" (click)="showSeriesEdit = false">Annuler</button></div></form></section>
          <section class="status-actions"><button class="primary" *ngIf="item.status === 'DRAFT'" (click)="changeEventStatus('PUBLISHED')">Publier</button><button class="secondary" *ngIf="item.status === 'PUBLISHED'" (click)="changeEventStatus('IN_PROGRESS')">Démarrer</button><button class="secondary" *ngIf="item.status === 'IN_PROGRESS' || item.status === 'PUBLISHED'" (click)="changeEventStatus('COMPLETED')">Terminer</button><button class="danger" *ngIf="item.status === 'DRAFT' || item.status === 'PUBLISHED' || item.status === 'IN_PROGRESS'" (click)="changeEventStatus('CANCELLED', true)">Annuler la série</button><button class="secondary" *ngIf="item.status === 'COMPLETED' || item.status === 'CANCELLED'" (click)="changeEventStatus('ARCHIVED')">Archiver</button><button class="secondary" *ngIf="item.recurrence_frequency !== 'NONE'" (click)="generateOccurrences()">Générer les prochaines séances</button><button class="secondary" (click)="loadStatistics()">Statistiques</button><a class="secondary public-link" *ngIf="item.status === 'PUBLISHED'" [href]="'/event-registration/' + item.id" target="_blank" rel="noopener">Lien d’inscription public</a></section>
          <section class="panel" *ngIf="statistics"><header class="panel-head"><h2>Indicateurs par séance</h2><button class="quiet" (click)="statistics = null">Fermer</button></header><div class="record" *ngFor="let row of statistics.occurrences"><div><strong>{{ row.starts_at | date:'dd/MM/yyyy HH:mm':item.timezone }}</strong><small>{{ row.confirmed }} confirmés · {{ row.offered }} offres · {{ row.waitlisted }} en attente · {{ row.attendance }} présences</small></div><span>{{ row.remaining === null ? 'Sans limite' : row.remaining + ' places restantes' }}</span></div></section>
          <section class="panel">
            <header class="panel-head"><div><h2>Séances</h2><p>Les inscriptions et présences sont propres à chaque séance.</p></div></header>
            <div class="occurrence-list"><button *ngFor="let occurrence of item.occurrences" type="button" class="occurrence" [class.selected]="occurrence.id === selectedOccurrence?.id" (click)="selectOccurrence(occurrence)"><strong>{{ occurrence.starts_at | date:'EEE d MMM y, HH:mm':item.timezone }}</strong><span>{{ statusLabel(occurrence.status) }} · {{ occurrence.registration_count }} inscrits · {{ occurrence.attendance_count }} présences</span><small>{{ occurrence.capacity === null ? 'Sans limite de places' : ((occurrence.registration_count + occurrence.offered_count) + '/' + occurrence.capacity + ' places réservées') }}</small></button></div>
            <button class="secondary" *ngIf="selectedOccurrence && selectedOccurrence.status !== 'CANCELLED' && selectedOccurrence.status !== 'COMPLETED' && selectedOccurrence.status !== 'ARCHIVED'" type="button" (click)="openOccurrenceEditor()">Modifier uniquement cette séance</button>
            <form *ngIf="showOccurrenceEdit && selectedOccurrence" class="edit-form" [formGroup]="occurrenceForm" (ngSubmit)="saveOccurrence()"><div class="form-grid"><label>Début<input type="datetime-local" formControlName="starts_at" /></label><label>Fin<input type="datetime-local" formControlName="ends_at" /></label><label>Lieu<input formControlName="location" /></label></div><div class="actions"><button class="primary" type="submit" [disabled]="saving">Enregistrer cette séance</button><button class="secondary" type="button" (click)="showOccurrenceEdit = false">Annuler</button></div></form>
            <button class="quiet" *ngIf="selectedOccurrence && selectedOccurrence.status !== 'CANCELLED' && selectedOccurrence.status !== 'COMPLETED'" (click)="cancelOccurrence()">Annuler cette séance uniquement</button>
          </section>
          <section class="detail-grid" *ngIf="selectedOccurrence">
            <section class="panel"><header class="panel-head"><div><h2>Inscriptions</h2><p>{{ selectedOccurrence.registration_mode }} · {{ selectedOccurrence.waitlist_count }} en attente · {{ selectedOccurrence.offered_count }} place(s) proposée(s)</p></div></header><div class="record" *ngFor="let registration of registrations"><div><strong>{{ registration.attendee_name }}</strong><small>{{ registration.attendee_email || registration.attendee_phone }} · {{ registration.created_at | date:'dd/MM/yyyy HH:mm':event.timezone }}</small></div><span class="status" [attr.data-status]="registration.status">{{ registrationLabel(registration.status) }}</span><button class="quiet" type="button" *ngIf="registration.status === 'CONFIRMED' || registration.status === 'WAITLISTED' || registration.status === 'OFFERED'" (click)="cancelAttendee(registration)">Annuler</button></div><p class="empty" *ngIf="!registrations.length">Aucune inscription pour cette séance.</p></section>
            <section class="panel"><header class="panel-head"><div><h2>Présences</h2><p>Le scan ne confirme pas la présence; confirmez après vérification.</p></div><button class="secondary" *ngIf="selectedOccurrence.checkin_mode === 'SELF'" (click)="makeSelfCheckinQr()">QR d’auto-pointage</button></header>
              <div class="scan-tools" *ngIf="selectedOccurrence.checkin_mode === 'REGISTRATION'"><button class="secondary" type="button" (click)="toggleScanner()">{{ scannerOpen ? 'Fermer le scanner' : 'Scanner un QR' }}</button><video #video *ngIf="scannerOpen" class="camera" muted playsinline></video><form class="scan-form" (ngSubmit)="scanCodeValue()"><input name="scanCode" [(ngModel)]="scanCode" placeholder="QR ou code de secours à 5 chiffres" aria-label="QR ou code de secours" /><button class="quiet" type="submit">Vérifier</button></form><article class="scan-result" *ngIf="scanResult" [attr.data-result]="scanResult.result"><strong>{{ scanResult.detail }}</strong><p *ngIf="scanResult.attendee">{{ scanResult.attendee.name }} · {{ scanResult.attendee.phone || 'Téléphone non renseigné' }}<br/>Inscription : {{ scanResult.attendee.registered_at | date:'dd/MM/yyyy HH:mm':event.timezone }}</p><button class="primary" *ngIf="scanResult.result === 'VALID' && scanResult.registration_id" (click)="confirmAttendance(scanResult.registration_id)">Confirmer la présence</button></article></div>
              <img *ngIf="selfCheckinQr" class="qr" [src]="selfCheckinQr" alt="QR code d’auto-pointage" />
              <div class="record" *ngFor="let attendance of attendances"><div><strong>{{ attendance.attendee_name }}</strong><small>{{ attendance.checked_in_at | date:'dd/MM/yyyy HH:mm':event.timezone }} · {{ attendance.source }}</small></div><span class="status" [attr.data-status]="attendance.state">{{ attendance.state === 'PRESENT' ? 'Présent' : 'Correction' }}</span><button class="quiet" type="button" *ngIf="attendance.state === 'PRESENT'" (click)="correctAttendance(attendance)">Corriger</button></div><p class="empty" *ngIf="!attendances.length">Aucune présence enregistrée.</p>
            </section>
          </section>
        </ng-container>
      </ng-template>
    </main>
  `,
  styles: [`
    :host{display:block;color:#25323a}.page{max-width:1320px;margin:0 auto;padding-bottom:32px}.heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 18px}.eyebrow{margin:0 0 6px;color:#148451;font-size:.72rem;font-weight:800}.heading h1{margin:0;font-size:1.7rem}.heading p:not(.eyebrow){margin:5px 0 0;color:#718087}.primary,.secondary,.quiet,.danger{min-height:38px;padding:8px 12px;border:1px solid #176b50;background:#176b50;color:#fff;font-weight:700;cursor:pointer}.secondary,.quiet{border-color:#d4dfdc;background:#fff;color:#34434a}.danger{border-color:#bb4444;background:#fff;color:#a33434}.primary:disabled{opacity:.55;cursor:not-allowed}.toolbar,.status-actions{display:flex;gap:10px;align-items:center;margin-bottom:15px;padding:13px;background:#fff;border:1px solid #e0e6e6}.toolbar input,.toolbar select,.form-grid input,.form-grid select,textarea,.scan-form input{min-height:38px;padding:8px 10px;border:1px solid #cfd9d6;background:#fff;color:#25323a;font:inherit}.toolbar input{flex:1}.create-panel,.panel,.card{padding:17px;background:#fff;border:1px solid #e0e6e6}.create-panel,.edit-form{margin:0 0 16px}.create-panel h2,.panel h2,.edit-form h2{margin:0;font-size:1rem}.create-panel form,.edit-form{display:grid;gap:12px;margin-top:13px}.form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.form-grid label,.create-panel form>label,.edit-form>label{display:grid;gap:5px;color:#53615e;font-size:.8rem;font-weight:700}.actions{display:flex;gap:8px;justify-content:flex-end}.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:13px}.card{display:grid;gap:9px}.card-head{display:flex;justify-content:space-between;gap:8px}.card p{margin:0;color:#68777c;font-size:.85rem}.card small,.occurrence span,.occurrence small,.record small{color:#748188;font-size:.75rem}.card a,.back{color:#176b50;text-decoration:none;font-weight:700;font-size:.83rem}.status{height:max-content;padding:5px 8px;background:#e6f3e9;color:#256844;font-size:.68rem;font-weight:800;white-space:nowrap}.status[data-status=DRAFT],.status[data-status=WAITLISTED],.status[data-status=OFFERED]{background:#fff2d8;color:#8a5a0a}.status[data-status=CANCELLED],.status[data-status=REVOKED],.status[data-status=EXPIRED]{background:#f1e9e9;color:#834747}.empty{padding:18px;color:#748188;text-align:center}.notice{padding:10px 12px;margin:0 0 12px}.notice.error{background:#fff0ef;color:#a13333}.notice.success{background:#e9f5ed;color:#23613a}.back{display:inline-block;margin-bottom:14px}.panel{margin-bottom:14px}.panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #edf0f0}.occurrence-list{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:11px}.occurrence{display:grid;gap:4px;padding:10px;border:1px solid #dce4e2;background:#fff;text-align:left;cursor:pointer}.occurrence.selected{border-color:#176b50;background:#eff8f2}.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.record{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 0;border-top:1px solid #edf0f0}.record>div{display:grid;gap:4px}.scan-tools{display:grid;gap:9px;margin-bottom:12px}.camera{width:min(100%,420px);max-height:300px;background:#172624}.scan-form{display:flex;gap:8px}.scan-form input{flex:1;min-width:0}.scan-result{padding:12px;border:1px solid #d7e2df;background:#f8fbf9}.scan-result[data-result=CANCELLED],.scan-result[data-result=INVALID],.scan-result[data-result=INELIGIBLE],.scan-result[data-result=WRONG_OCCURRENCE]{border-color:#eac4c4;background:#fff6f6;color:#863535}.qr{display:block;width:180px;height:180px;margin:12px auto}@media(max-width:800px){.form-grid,.detail-grid{grid-template-columns:1fr}.heading{align-items:flex-start;flex-direction:column}.toolbar{align-items:stretch;flex-direction:column}.panel-head{align-items:flex-start;flex-direction:column}.record{align-items:flex-start}.status-actions{flex-wrap:wrap}}
  `],
})
export class EventManagementComponent implements OnInit, OnDestroy {
  @ViewChild('video') video?: ElementRef<HTMLVideoElement>;

  eventId: string | null = null;
  events: ChurchEvent[] = [];
  access: EventManagerAccess | null = null;
  churchSelectionFixed = false;
  event: ChurchEvent | null = null;
  churches: Church[] = [];
  campuses: Campus[] = [];
  selectedOccurrence: EventOccurrence | null = null;
  registrations: EventRegistration[] = [];
  attendances: EventAttendance[] = [];
  scanCode = '';
  scanResult: EventScanResult | null = null;
  search = '';
  statusFilter = '';
  scopeFilter = '';
  categoryFilter = '';
  startsAfter = '';
  startsBefore = '';
  calendarView = false;
  calendarMonth = new Date().getMonth();
  calendarYear = new Date().getFullYear();
  private calendarEntriesCache: EventCalendarEntry[] = [];
  private calendarEntriesCacheEvents: ChurchEvent[] | null = null;
  private calendarEntriesCacheMonth = -1;
  private calendarEntriesCacheYear = -1;
  private calendarCellsCache: EventCalendarCell[] = [];
  private calendarCellsCacheEntries: EventCalendarEntry[] | null = null;
  private calendarCellsCacheMonth = -1;
  private calendarCellsCacheYear = -1;
  readonly weekdays = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'];
  readonly calendarMonths = [
    { value: 0, label: 'Janvier' }, { value: 1, label: 'Février' }, { value: 2, label: 'Mars' },
    { value: 3, label: 'Avril' }, { value: 4, label: 'Mai' }, { value: 5, label: 'Juin' },
    { value: 6, label: 'Juillet' }, { value: 7, label: 'Août' }, { value: 8, label: 'Septembre' },
    { value: 9, label: 'Octobre' }, { value: 10, label: 'Novembre' }, { value: 11, label: 'Décembre' },
  ];
  statistics: import('../../core/models/event').EventStatistics | null = null;
  showCreate = false;
  scannerOpen = false;
  loading = false;
  saving = false;
  showSeriesEdit = false;
  showOccurrenceEdit = false;
  errorMessage = '';
  successMessage = '';
  selfCheckinQr = '';
  private scannerControls?: IScannerControls;
  private reader = new BrowserMultiFormatReader();

  get availableCampuses(): Campus[] {
    if (!this.churchSelectionFixed) return this.campuses;
    const churchId = this.eventForm.controls.church_id.value;
    return this.campuses.filter((campus) => campus.church === churchId);
  }

  eventForm = this.fb.group({
    title: ['', Validators.required],
    description: [''],
    category: [''],
    scope: ['CHURCH' as 'CHURCH' | 'CAMPUS' | 'ORGANIZATION', Validators.required],
    church_id: [''],
    campus_id: [''],
    included_church_ids: [[] as string[]],
    location: [''],
    timezone: [Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', Validators.required],
    starts_at: ['', Validators.required],
    ends_at: ['', Validators.required],
    registration_mode: ['DISABLED' as 'DISABLED' | 'OPTIONAL' | 'REQUIRED', Validators.required],
    capacity: [''],
    waitlist_enabled: [false],
    checkin_mode: ['DISABLED' as 'DISABLED' | 'REGISTRATION' | 'SELF', Validators.required],
    checkin_opens_at: [''],
    checkin_closes_at: [''],
    recurrence_frequency: ['NONE' as 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY', Validators.required],
    recurrence_interval: [1, Validators.required],
    recurrence_until: [''],
  });
  seriesForm = this.fb.group({
    title: ['', Validators.required],
    description: [''],
    category: [''],
    location: [''],
    starts_at: [''],
    ends_at: [''],
    occurrence_location: [''],
  });
  occurrenceForm = this.fb.group({
    starts_at: ['', Validators.required],
    ends_at: ['', Validators.required],
    location: [''],
  });

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private eventsApi: EventService,
    private tenant: TenantService,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.eventId = params.get('id');
      if (this.eventId) this.loadEvent();
      else this.loadEvents();
    });
    this.eventsApi.managerAccess().subscribe({
      next: (access) => {
        this.access = access;
        if (!access.is_organization_admin) {
          this.eventForm.controls.scope.setValue('CHURCH');
        }
        this.tenant.churchContext().subscribe({
          next: (context) => {
            const allowedChurchIds = new Set(access.churches.map((church) => church.church_id));
            this.churches = context.churches.filter((church) => allowedChurchIds.has(church.church_id));
            this.campuses = context.campuses.filter((campus) => allowedChurchIds.has(campus.church ?? ''));
            this.churchSelectionFixed = context.church_selection_fixed;
            if (context.default_church_id && this.churchSelectionFixed) {
              this.eventForm.controls.church_id.setValue(context.default_church_id);
            }
          },
          error: (error) => this.errorMessage = this.errorText(error),
        });
      },
      error: (error) => this.errorMessage = this.errorText(error),
    });
  }

  ngOnDestroy(): void {
    this.scannerControls?.stop();
  }

  loadEvents(): void {
    this.loading = true;
    this.eventsApi.list({
      search: this.search,
      status: this.calendarView ? '' : this.statusFilter,
      scope: this.scopeFilter,
      category: this.categoryFilter,
      starts_after: this.calendarView ? '' : this.startsAfter,
      starts_before: this.calendarView ? '' : this.startsBefore,
    }).subscribe({
      next: (items) => { this.events = items; this.loading = false; },
      error: (error) => { this.errorMessage = this.errorText(error); this.loading = false; },
    });
  }

  setCalendarView(enabled: boolean): void {
    if (this.calendarView === enabled) return;
    this.calendarView = enabled;
    this.loadEvents();
  }

  setStatusFilter(status: string): void {
    this.statusFilter = status;
    this.loadEvents();
  }

  get calendarMonthLabel(): string {
    return this.calendarMonths[this.calendarMonth]?.label || '';
  }

  get calendarYears(): number[] {
    const years = new Set<number>();
    const currentYear = new Date().getFullYear();
    for (let year = currentYear - 5; year <= currentYear + 5; year += 1) years.add(year);
    years.add(this.calendarYear);
    this.events.forEach((event) => event.occurrences.forEach((occurrence) => {
      years.add(Number(this.dateKeyInTimezone(occurrence.starts_at, event.timezone).slice(0, 4)));
    }));
    return Array.from(years).filter(Number.isFinite).sort((left, right) => right - left);
  }

  get calendarEntriesForMonth(): EventCalendarEntry[] {
    if (
      this.calendarEntriesCacheEvents !== this.events ||
      this.calendarEntriesCacheMonth !== this.calendarMonth ||
      this.calendarEntriesCacheYear !== this.calendarYear
    ) {
      this.calendarEntriesCache = this.events
        .flatMap((event) => event.occurrences
          .filter((occurrence) => {
            const dateKey = this.dateKeyInTimezone(occurrence.starts_at, event.timezone);
            const [year, month] = dateKey.split('-').map(Number);
            return year === this.calendarYear && month === this.calendarMonth + 1;
          })
          .map((occurrence) => ({ event, occurrence })))
        .sort((left, right) => left.occurrence.starts_at.localeCompare(right.occurrence.starts_at));
      this.calendarEntriesCacheEvents = this.events;
      this.calendarEntriesCacheMonth = this.calendarMonth;
      this.calendarEntriesCacheYear = this.calendarYear;
    }
    return this.calendarEntriesCache;
  }

  get calendarCells(): EventCalendarCell[] {
    const entries = this.calendarEntriesForMonth;
    if (
      this.calendarCellsCacheEntries === entries &&
      this.calendarCellsCacheMonth === this.calendarMonth &&
      this.calendarCellsCacheYear === this.calendarYear
    ) return this.calendarCellsCache;

    const firstWeekday = (new Date(Date.UTC(this.calendarYear, this.calendarMonth, 1)).getUTCDay() + 6) % 7;
    const dayCount = new Date(Date.UTC(this.calendarYear, this.calendarMonth + 1, 0)).getUTCDate();
    const cells: EventCalendarCell[] = Array.from({ length: firstWeekday }, () => ({ day: null, entries: [] }));
    const entriesByDate = new Map<string, EventCalendarEntry[]>();
    entries.forEach((entry) => {
      const dateKey = this.dateKeyInTimezone(entry.occurrence.starts_at, entry.event.timezone);
      const dateEntries = entriesByDate.get(dateKey) || [];
      dateEntries.push(entry);
      entriesByDate.set(dateKey, dateEntries);
    });
    for (let day = 1; day <= dayCount; day += 1) {
      const dateKey = `${this.calendarYear}-${String(this.calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({ day, entries: entriesByDate.get(dateKey) || [] });
    }
    while (cells.length % 7 !== 0) cells.push({ day: null, entries: [] });
    this.calendarCellsCache = cells;
    this.calendarCellsCacheEntries = entries;
    this.calendarCellsCacheMonth = this.calendarMonth;
    this.calendarCellsCacheYear = this.calendarYear;
    return this.calendarCellsCache;
  }

  trackByCalendarCell(index: number): number { return index; }
  trackByCalendarEntry(_index: number, entry: EventCalendarEntry): string { return `${entry.event.id}:${entry.occurrence.id}`; }

  setCalendarMonth(value: string): void {
    const month = Number(value);
    if (Number.isInteger(month) && month >= 0 && month <= 11) this.calendarMonth = month;
  }

  setCalendarYear(value: string): void {
    const year = Number(value);
    if (Number.isInteger(year)) this.calendarYear = year;
  }

  shiftCalendarMonth(amount: number): void {
    const shifted = new Date(Date.UTC(this.calendarYear, this.calendarMonth + amount, 1));
    this.calendarMonth = shifted.getUTCMonth();
    this.calendarYear = shifted.getUTCFullYear();
  }

  goToCurrentMonth(): void {
    const now = new Date();
    this.calendarMonth = now.getMonth();
    this.calendarYear = now.getFullYear();
  }

  private dateKeyInTimezone(value: string, timezone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(value));
    const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  createEvent(): void {
    if (this.eventForm.invalid) return;
    const form = this.eventForm.getRawValue();
    if (form.scope === 'CHURCH' && !form.church_id) {
      this.errorMessage = 'Aucune église active n’est associée à votre compte.';
      return;
    }
    if (form.scope === 'CAMPUS' && !form.campus_id) {
      this.errorMessage = 'Sélectionnez un campus pour cet événement.';
      return;
    }
    const payload: EventWriteRequest = {
      scope: form.scope!,
      ...(form.scope === 'CHURCH' ? { church_id: form.church_id! } : {}),
      ...(form.scope === 'CAMPUS' ? { campus_id: form.campus_id! } : {}),
      ...(form.scope === 'ORGANIZATION' ? { included_church_ids: form.included_church_ids || [] } : {}),
      title: form.title!,
      description: form.description || '',
      category: form.category || '',
      location: form.location || '',
      timezone: form.timezone || 'UTC',
      starts_at: form.starts_at!,
      ends_at: form.ends_at!,
      occurrence_location: form.location || '',
      registration_mode: form.registration_mode!,
      capacity: form.capacity ? Number(form.capacity) : null,
      waitlist_enabled: form.waitlist_enabled || false,
      checkin_mode: form.checkin_mode!,
      checkin_opens_at: form.checkin_opens_at || null,
      checkin_closes_at: form.checkin_closes_at || null,
      recurrence_frequency: form.recurrence_frequency!,
      recurrence_interval: Number(form.recurrence_interval),
      recurrence_until: form.recurrence_until || null,
    };
    this.saving = true;
    this.eventsApi.create(payload).subscribe({
      next: () => { this.saving = false; this.showCreate = false; this.successMessage = 'Événement créé en brouillon.'; this.loadEvents(); },
      error: (error) => { this.saving = false; this.errorMessage = this.errorText(error); },
    });
  }

  loadEvent(): void {
    if (!this.eventId) return;
    this.loading = true;
    this.statistics = null;
    this.registrations = [];
    this.attendances = [];
    this.eventsApi.get(this.eventId).subscribe({
      next: (event) => {
        this.event = event;
        this.loading = false;
        if (this.selectedOccurrence) {
          this.selectedOccurrence = event.occurrences.find((item) => item.id === this.selectedOccurrence?.id) || null;
        }
        this.selectedOccurrence = this.selectedOccurrence || event.occurrences[0] || null;
        if (this.selectedOccurrence) this.loadOccurrenceData();
      },
      error: (error) => { this.errorMessage = this.errorText(error); this.loading = false; },
    });
  }

  selectOccurrence(occurrence: EventOccurrence): void {
    this.selectedOccurrence = occurrence;
    this.scanResult = null;
    this.selfCheckinQr = '';
    this.showOccurrenceEdit = false;
    this.loadOccurrenceData();
  }

  openSeriesEditor(): void {
    if (!this.event) return;
    const upcoming = this.event.occurrences.find((item) => item.status === 'DRAFT' || item.status === 'PUBLISHED');
    this.seriesForm.reset({
      title: this.event.title,
      description: this.event.description,
      category: this.event.category,
      location: this.event.location,
      starts_at: upcoming ? this.toLocalInput(upcoming.starts_at, this.event.timezone) : '',
      ends_at: upcoming ? this.toLocalInput(upcoming.ends_at, this.event.timezone) : '',
      occurrence_location: upcoming?.location || '',
    });
    this.showSeriesEdit = true;
  }

  saveSeries(): void {
    if (!this.eventId || this.seriesForm.invalid) return;
    const futureCount = this.event?.occurrences.filter((item) => item.starts_at >= new Date().toISOString() && (item.status === 'DRAFT' || item.status === 'PUBLISHED')).length || 0;
    if (!window.confirm(`Appliquer ces changements aux ${futureCount} occurrence(s) future(s) ?`)) return;
    const form = this.seriesForm.getRawValue();
    const eventChanges: Partial<ChurchEvent> = {
      title: form.title!,
      description: form.description || '',
      category: form.category || '',
      location: form.location || '',
    };
    const occurrenceChanges = form.starts_at && form.ends_at ? {
      starts_at: form.starts_at,
      ends_at: form.ends_at,
      location: form.occurrence_location || '',
    } : undefined;
    this.saving = true;
    this.eventsApi.updateSeries(this.eventId, {
      confirm_future: true,
      event: eventChanges,
      ...(occurrenceChanges ? { occurrence: occurrenceChanges } : {}),
    }).subscribe({
      next: ({ occurrences_updated }) => {
        this.saving = false;
        this.showSeriesEdit = false;
        this.successMessage = `Série mise à jour (${occurrences_updated} séance(s) modifiée(s)).`;
        this.loadEvent();
      },
      error: (error) => { this.saving = false; this.errorMessage = this.errorText(error); },
    });
  }

  openOccurrenceEditor(): void {
    if (!this.selectedOccurrence) return;
    this.occurrenceForm.reset({
      starts_at: this.toLocalInput(this.selectedOccurrence.starts_at, this.event?.timezone),
      ends_at: this.toLocalInput(this.selectedOccurrence.ends_at, this.event?.timezone),
      location: this.selectedOccurrence.location,
    });
    this.showOccurrenceEdit = true;
  }

  saveOccurrence(): void {
    if (!this.eventId || !this.selectedOccurrence || this.occurrenceForm.invalid) return;
    const form = this.occurrenceForm.getRawValue();
    this.saving = true;
    this.eventsApi.updateOccurrence(this.eventId, this.selectedOccurrence.id, {
      starts_at: form.starts_at!,
      ends_at: form.ends_at!,
      location: form.location || '',
    }).subscribe({
      next: () => {
        this.saving = false;
        this.showOccurrenceEdit = false;
        this.successMessage = 'Occurrence modifiée sans altérer les autres séances.';
        this.loadEvent();
      },
      error: (error) => { this.saving = false; this.errorMessage = this.errorText(error); },
    });
  }

  loadOccurrenceData(): void {
    if (!this.eventId || !this.selectedOccurrence) return;
    this.eventsApi.listRegistrations(this.eventId, this.selectedOccurrence.id).subscribe({
      next: (items) => this.registrations = items,
      error: (error) => this.errorMessage = this.errorText(error),
    });
    this.eventsApi.listAttendances(this.eventId, this.selectedOccurrence.id).subscribe({
      next: (items) => this.attendances = items,
      error: (error) => this.errorMessage = this.errorText(error),
    });
  }

  cancelAttendee(registration: EventRegistration): void {
    if (!window.confirm(`Annuler l’inscription de ${registration.attendee_name} ?`)) return;
    this.eventsApi.cancelRegistration(registration.id).subscribe({
      next: () => { this.successMessage = 'Inscription annulée; l’historique est conservé.'; this.loadOccurrenceData(); this.loadEvent(); },
      error: (error) => this.errorMessage = this.errorText(error),
    });
  }

  correctAttendance(attendance: EventAttendance): void {
    const reason = window.prompt(`Motif obligatoire pour corriger la présence de ${attendance.attendee_name} :`);
    if (!reason?.trim()) return;
    this.eventsApi.correctAttendance(attendance.id, 'REVOKED', reason.trim()).subscribe({
      next: () => { this.successMessage = 'Correction enregistrée avec son motif.'; this.loadOccurrenceData(); },
      error: (error) => this.errorMessage = this.errorText(error),
    });
  }

  loadStatistics(): void {
    if (!this.eventId) return;
    this.eventsApi.statistics(this.eventId).subscribe({
      next: (data) => this.statistics = data,
      error: (error) => this.errorMessage = this.errorText(error),
    });
  }

  changeEventStatus(status: string, confirm = false): void {
    if (!this.eventId) return;
    if (confirm && !window.confirm('Annuler la série ? Les inscriptions et présences existantes seront conservées.')) return;
    this.eventsApi.changeStatus(this.eventId, status, confirm).subscribe({
      next: () => { this.successMessage = 'Statut de l’événement mis à jour.'; this.loadEvent(); },
      error: (error) => this.errorMessage = this.errorText(error),
    });
  }

  cancelOccurrence(): void {
    if (!this.eventId || !this.selectedOccurrence || !window.confirm('Annuler uniquement cette séance ?')) return;
    this.eventsApi.changeOccurrenceStatus(this.eventId, this.selectedOccurrence.id, 'CANCELLED', true).subscribe({
      next: () => { this.successMessage = 'Séance annulée; son historique est conservé.'; this.loadEvent(); },
      error: (error) => this.errorMessage = this.errorText(error),
    });
  }

  generateOccurrences(): void {
    if (!this.eventId || !window.confirm('Générer au maximum 50 prochaines séances ?')) return;
    this.eventsApi.generateOccurrences(this.eventId, 50).subscribe({
      next: (items) => { this.successMessage = `${items.length} séance(s) générée(s).`; this.loadEvent(); },
      error: (error) => this.errorMessage = this.errorText(error),
    });
  }

  toggleScanner(): void {
    if (this.scannerOpen) {
      this.scannerControls?.stop();
      this.scannerOpen = false;
      return;
    }
    this.scannerOpen = true;
    this.scanResult = null;
    window.setTimeout(() => {
      if (!this.video) return;
      this.reader.decodeFromVideoDevice(undefined, this.video.nativeElement, (result) => {
        if (!result) return;
        this.scanCode = result.getText();
        this.scannerControls?.stop();
        this.scannerOpen = false;
        this.scanCodeValue();
      }).then((controls) => {
        this.scannerControls = controls;
      }).catch((error: unknown) => {
        this.scannerOpen = false;
        this.errorMessage = this.errorText(error);
      });
    });
  }

  scanCodeValue(): void {
    if (!this.scanCode.trim()) return;
    if (!this.selectedOccurrence) return;
    this.eventsApi.scan(this.scanCode.trim(), this.selectedOccurrence.id).subscribe({
      next: (result) => { this.scanResult = result; this.errorMessage = ''; },
      error: (error) => { this.scanResult = null; this.errorMessage = this.errorText(error); },
    });
  }

  confirmAttendance(registrationId: string): void {
    const reason = window.prompt('Motif obligatoire si le pointage est hors fenêtre. Laissez vide sinon :') || '';
    this.eventsApi.confirmCheckIn(registrationId, this.scanCode.trim(), reason).subscribe({
      next: (result) => { this.successMessage = result.detail; this.scanResult = null; this.loadOccurrenceData(); },
      error: (error) => this.errorMessage = this.errorText(error),
    });
  }

  makeSelfCheckinQr(): void {
    if (!this.eventId || !this.selectedOccurrence) return;
    this.eventsApi.createSelfCheckInQr(this.eventId, this.selectedOccurrence.id).subscribe({
      next: async ({ token }) => {
        if (!this.eventId || !this.selectedOccurrence) return;
        const target = `${window.location.origin}/event-self-checkin/${this.eventId}/${this.selectedOccurrence.id}?token=${encodeURIComponent(token)}`;
        try {
          this.selfCheckinQr = await QRCode.toDataURL(target, { width: 240, margin: 1 });
        } catch (error) {
          this.errorMessage = this.errorText(error);
        }
      },
      error: (error) => this.errorMessage = this.errorText(error),
    });
  }

  statusLabel(status: string): string {
    return ({ DRAFT: 'Brouillon', PUBLISHED: 'Publié', IN_PROGRESS: 'En cours', COMPLETED: 'Terminé', CANCELLED: 'Annulé', ARCHIVED: 'Archivé' } as Record<string, string>)[status] || status;
  }

  registrationLabel(status: string): string {
    return ({ CONFIRMED: 'Confirmée', WAITLISTED: 'Liste d’attente', OFFERED: 'Place proposée', CANCELLED: 'Annulée', DECLINED: 'Refusée', EXPIRED: 'Expirée' } as Record<string, string>)[status] || status;
  }

  valueOf(event: Event): string { return (event.target as HTMLInputElement).value; }
  get includedChurchIds(): string[] { return this.eventForm.controls.included_church_ids.value || []; }
  selectChurchIds(event: Event): void {
    const selected = Array.from((event.target as HTMLSelectElement).selectedOptions).map((option) => option.value);
    this.eventForm.controls.included_church_ids.setValue(selected);
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

  private toLocalInput(value: string, timezone = 'UTC'): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(value));
    const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
    return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
  }
}
