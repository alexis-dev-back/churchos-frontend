import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { AttendanceAlert, AttendanceCampus, AttendanceChurch, AttendanceManagerContext, AttendanceMember, AttendancePolicy, AttendanceSession, AttendanceSessionType, AttendanceWeeklyReport, ExpectedParticipant, MemberAttendanceHistory } from '../../core/models/attendance';
import { ChurchStructure } from '../../core/models/ministry-tribe';
import { AttendanceService } from '../../core/services/attendance.service';
import { MinistryTribeService } from '../../core/services/ministry-tribe.service';

@Component({
  standalone: true,
  selector: 'app-attendance',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <main class="attendance-page">
      <header class="page-heading">
        <div><p class="eyebrow">SUIVI DES PARTICIPATIONS</p><h1>Présence et assiduité</h1><p>Planifiez les séances, pointez les participants et consultez les résultats.</p></div>
        <button class="primary" type="button" (click)="showCreate = !showCreate">{{ showCreate ? 'Fermer' : 'Nouvelle séance' }}</button>
      </header>
      <p class="message error" *ngIf="errorMessage" role="alert">{{ errorMessage }}</p>
      <p class="message success" *ngIf="successMessage" role="status">{{ successMessage }}</p>

      <section class="metrics" aria-label="Statistiques hebdomadaires">
        <article><span>Séances planifiées</span><strong>{{ report?.sessions?.planned ?? countStatus('PLANNED') }}</strong></article>
        <article><span>Séances réalisées</span><strong>{{ report?.sessions?.closed ?? countStatus('CLOSED') }}</strong></article>
        <article><span>Présences</span><strong>{{ report?.attendance?.present ?? '-' }}</strong></article>
        <article><span>Assiduité</span><strong>{{ report ? (report.attendance.attendance_rate + '%') : '-' }}</strong></article>
      </section>

      <nav class="attendance-tabs" aria-label="Sections de présence">
        <button type="button" [class.active]="activeView === 'sessions'" (click)="activeView = 'sessions'">Séances et pointage</button>
        <button type="button" [class.active]="activeView === 'reports'" (click)="activeView = 'reports'; loadReport()">Rapports</button>
        <button type="button" [class.active]="activeView === 'alerts'" (click)="activeView = 'alerts'; loadAlerts()">Alertes et règles</button>
      </nav>

      <ng-container *ngIf="activeView === 'sessions'">
      <section class="create-card" *ngIf="showCreate">
        <div class="section-heading"><h2>Créer une séance</h2><button class="secondary" *ngIf="isOrganizationAdmin" type="button" (click)="showTypeForm = !showTypeForm">{{ showTypeForm ? 'Fermer types' : 'Gérer les types' }}</button></div>
        <section class="type-create" *ngIf="showTypeForm">
          <h3>Nouveau type de séance</h3>
          <form [formGroup]="typeForm" (ngSubmit)="createType()">
            <div class="form-grid">
              <label>Nom du type<input formControlName="name" placeholder="Ex. Culte général" /></label>
              <label>Population par défaut<select formControlName="population_rule"><option value="ALL_MEMBERS">Tous les membres actifs</option><option value="MANUAL">Sélection manuelle</option><option *ngIf="isOrganizationAdmin" value="MINISTRY">Ministère</option><option *ngIf="isOrganizationAdmin" value="TRIBE">Tribu</option></select></label>
              <label>Tolérance par défaut (minutes)<input type="number" min="0" max="240" formControlName="tolerance_minutes" /></label>
            </div>
            <div class="form-actions"><button class="primary" type="submit" [disabled]="typeForm.invalid || saving">Enregistrer le type</button></div>
          </form>
        </section>
        <form [formGroup]="form" (ngSubmit)="createSession()">
          <div class="form-grid">
            <label>Intitulé<input formControlName="title" placeholder="Ex. Culte du dimanche" /></label>
            <label>Type de séance<select formControlName="session_type_id"><option value="">Séance ponctuelle</option><option *ngFor="let type of sessionTypes" [value]="type.id">{{ type.name }}</option></select></label>
            <label *ngIf="!churchSelectionFixed">Église<select formControlName="church_id"><option value="">Choisir une église</option><option *ngFor="let church of churches" [value]="church.church_id">{{ church.name }}</option></select></label>
            <label>Campus (facultatif)<select formControlName="campus_id"><option value="">Tous les campus</option><option *ngFor="let campus of selectedCampuses" [value]="campus.campus_id">{{ campus.name }}</option></select></label>
            <label>Début<input type="datetime-local" formControlName="starts_at" /></label>
            <label>Fin<input type="datetime-local" formControlName="ends_at" /></label>
            <label>Population attendue<select formControlName="population_rule"><option value="">Selon le type</option><option value="ALL_MEMBERS">Tous les membres actifs</option><option value="MANUAL">Sélection manuelle</option><option *ngIf="isOrganizationAdmin" value="MINISTRY">Ministère</option><option *ngIf="isOrganizationAdmin" value="TRIBE">Tribu</option></select></label>
            <label *ngIf="isOrganizationAdmin && effectivePopulationRule === 'MINISTRY'">Ministère<select formControlName="ministry_id"><option value="">Choisir</option><option *ngFor="let item of ministries" [value]="item.id">{{ item.name }}</option></select></label>
            <label *ngIf="isOrganizationAdmin && effectivePopulationRule === 'TRIBE'">Tribu<select formControlName="tribe_id"><option value="">Choisir</option><option *ngFor="let item of tribes" [value]="item.id">{{ item.name }}</option></select></label>
            <label>Tolérance (minutes)<input type="number" min="0" max="240" formControlName="tolerance_minutes" /></label>
            <label>Récurrence<select formControlName="recurrence_frequency"><option value="NONE">Aucune</option><option value="WEEKLY">Hebdomadaire (8 semaines)</option><option value="MONTHLY">Mensuelle (8 semaines)</option></select></label>
          </div>
          <fieldset *ngIf="effectivePopulationRule === 'MANUAL'"><legend>Membres attendus</legend><label class="member-choice" *ngFor="let member of churchMembers"><input type="checkbox" [checked]="selectedMemberIds.includes(member.id)" (change)="toggleMember(member.id, $event)" /> {{ member.first_name }} {{ member.last_name }}</label><p class="hint" *ngIf="!churchMembers.length">Choisissez d’abord une église ayant des membres actifs.</p></fieldset>
          <fieldset><legend>Méthodes de pointage</legend><label class="check"><input type="checkbox" [checked]="methods.includes('MANUAL')" (change)="toggleMethod('MANUAL', $event)" /> Manuel</label><label class="check"><input type="checkbox" [checked]="methods.includes('LIST')" (change)="toggleMethod('LIST', $event)" /> Sur liste</label><label class="check"><input type="checkbox" [checked]="methods.includes('QR')" (change)="toggleMethod('QR', $event)" /> QR Code</label><label class="check"><input type="checkbox" [checked]="methods.includes('SELF')" (change)="toggleMethod('SELF', $event)" /> Auto-pointage</label></fieldset>
          <p class="hint">La liste des membres éligibles est figée à la création. Les séances récurrentes sont générées avec une limite de huit semaines.</p>
          <div class="form-actions"><button class="secondary" type="button" (click)="showCreate = false">Annuler</button><button class="primary" type="submit" [disabled]="form.invalid || saving">Créer et figer la liste</button></div>
        </form>
      </section>

      <div class="workspace">
        <section class="session-list">
          <div class="section-heading"><h2>Séances</h2><label class="filter">Statut<select [(ngModel)]="statusFilter" [ngModelOptions]="{standalone:true}" (change)="loadSessions()"><option value="">Tous</option><option value="PLANNED">Planifiées</option><option value="IN_PROGRESS">En cours</option><option value="CLOSED">Clôturées</option><option value="CANCELLED">Annulées</option></select></label></div>
          <p class="muted" *ngIf="loading">Chargement…</p>
          <button class="session-row" type="button" *ngFor="let session of sessions" [class.selected]="selectedSession?.id === session.id" (click)="selectSession(session)">
            <span class="session-date">{{ session.starts_at | date:'dd' }}<small>{{ session.starts_at | date:'MMM' }}</small></span>
            <span class="session-summary"><strong>{{ session.title }}</strong><small>{{ session.starts_at | date:'EEE, dd MMM yyyy · HH:mm' }} · {{ session.church_name || 'Événement inter-églises' }}</small></span>
            <span class="status" [attr.data-status]="session.status">{{ statusLabel(session.status) }}</span>
          </button>
          <p class="empty" *ngIf="!loading && sessions.length === 0">Aucune séance ne correspond aux filtres.</p>
        </section>

        <section class="session-detail" *ngIf="selectedSession as session">
          <div class="detail-heading"><div><p class="eyebrow">{{ statusLabel(session.status) }}</p><h2>{{ session.title }}</h2><p>{{ session.starts_at | date:'fullDate' }} · {{ session.starts_at | date:'shortTime' }} – {{ session.ends_at | date:'shortTime' }}</p></div>
            <div class="actions" *ngIf="session.status !== 'CANCELLED' && !session.event_occurrence">
              <button class="primary" *ngIf="session.status === 'PLANNED'" (click)="transition(session, 'open')">Ouvrir le pointage</button>
              <button class="primary" *ngIf="session.status === 'IN_PROGRESS'" (click)="transition(session, 'close')">Clôturer</button>
              <button class="secondary" *ngIf="session.status === 'PLANNED' || session.status === 'IN_PROGRESS'" (click)="transition(session, 'cancel')">Annuler</button>
            </div>
          </div>
          <div class="roster-summary"><span><strong>{{ session.expected_count }}</strong> attendu(s)</span><span><strong>{{ session.present_count }}</strong> présent(s)</span><span>Tolérance <strong>{{ session.tolerance_minutes }} min</strong></span><span class="methods">Pointage : {{ session.allowed_methods.join(', ') }}</span></div>
          <form class="visitor-form" *ngIf="session.status === 'PLANNED' && !session.event_occurrence" [formGroup]="visitorForm" (ngSubmit)="addVisitor(session)">
            <strong>Ajouter un visiteur ponctuel ou réutilisable</strong>
            <input formControlName="first_name" placeholder="Prénom" aria-label="Prénom du visiteur" />
            <input formControlName="last_name" placeholder="Nom" aria-label="Nom du visiteur" />
            <input formControlName="phone" placeholder="Téléphone (facultatif)" aria-label="Téléphone du visiteur" />
            <label class="check"><input type="checkbox" formControlName="reusable" /> Fiche réutilisable</label>
            <button class="secondary" type="submit" [disabled]="visitorForm.invalid">Ajouter</button>
          </form>
          <div class="add-member" *ngIf="session.status === 'PLANNED' && !session.event_occurrence">
            <label>Ajouter un membre actif<select [(ngModel)]="memberToAdd" [ngModelOptions]="{standalone:true}"><option value="">Sélectionner un membre</option><option *ngFor="let member of availableMembers" [value]="member.id">{{ member.first_name }} {{ member.last_name }}</option></select></label>
            <button class="secondary" type="button" [disabled]="!memberToAdd" (click)="addExpectedMember(session)">Ajouter à la liste</button>
          </div>
          <div class="roster">
            <div class="roster-head"><span>Participant</span><span>État</span><span>Pointage</span></div>
            <div class="roster-row" *ngFor="let participant of participants">
              <span class="person"><span class="avatar">{{ initials(participant) }}</span><span><strong>{{ participant.first_name }} {{ participant.last_name }}</strong><small>{{ participant.is_visitor ? 'Visiteur' : 'Membre' }}</small></span></span>
              <span><span class="record-status" *ngIf="participant.attendance" [attr.data-status]="participant.attendance.status">{{ attendanceLabel(participant.attendance.status) }}</span><span class="muted" *ngIf="!participant.attendance">Non pointé</span></span>
              <button class="check-in" type="button" *ngIf="session.status === 'IN_PROGRESS' && !session.event_occurrence && !participant.attendance && participant.expected_for_absence" [disabled]="!canListCheckIn(session)" (click)="checkIn(session, participant)">Pointer</button>
              <span class="muted" *ngIf="participant.attendance">{{ participant.attendance.checked_in_at ? (participant.attendance.checked_in_at | date:'HH:mm:ss') : '—' }}</span>
              <span class="muted" *ngIf="!participant.expected_for_absence">Inscription annulée</span>
              <button class="remove-expected" type="button" *ngIf="session.status === 'PLANNED' && participant.expected_for_absence && participant.member_id && !session.event_occurrence" (click)="removeExpected(session, participant)">Retirer</button>
              <div class="participant-actions" *ngIf="participant.attendance && !session.event_occurrence">
                <button type="button" *ngIf="participant.attendance.status === 'ABSENT'" (click)="submitExcuse(participant)">Soumettre une justification</button>
                <ng-container *ngFor="let excuse of participant.attendance.excuses">
                  <span class="excuse-state" *ngIf="excuse.status !== 'PENDING'">{{ excuse.status === 'APPROVED' ? 'Justification approuvée' : 'Justification refusée' }}</span>
                  <button type="button" *ngIf="excuse.status === 'PENDING'" (click)="decideExcuse(excuse.id, true)">Valider</button>
                  <button type="button" *ngIf="excuse.status === 'PENDING'" (click)="decideExcuse(excuse.id, false)">Refuser</button>
                </ng-container>
                <button type="button" *ngIf="participant.attendance.status === 'PRESENT' || participant.attendance.status === 'LATE'" (click)="earlyDeparture(participant)">Départ anticipé</button>
                <button type="button" (click)="correctAttendance(participant)">Corriger</button>
              </div>
              <button class="history-button" type="button" *ngIf="participant.member_id" (click)="loadMemberHistory(participant)">Historique</button>
              <div class="history-list" *ngIf="historyMemberId === participant.member_id"><span *ngFor="let item of memberHistory">{{ item.starts_at | date:'dd/MM/yy' }} · {{ item.session_title }} · {{ item.attendance ? attendanceLabel(item.attendance.status) : 'Non pointé' }}</span></div>
            </div>
            <p class="empty" *ngIf="participants.length === 0">La liste attendue est vide.</p>
          </div>
          <p class="hint" *ngIf="session.event_occurrence">Cette séance est liée à une occurrence Événements ; le pointage événementiel reste sa source canonique.</p>
        </section>
        <section class="session-detail blank" *ngIf="!selectedSession"><div><span class="blank-mark">✓</span><h2>Choisissez une séance</h2><p>Le détail, les participants attendus et le pointage s’afficheront ici.</p></div></section>
      </div>
      </ng-container>

      <section class="report-panel" *ngIf="activeView === 'reports'">
        <div class="section-heading"><div><h2>Rapport de présence</h2><p>Calculé à partir des séances clôturées ; les absences excusées restent isolées.</p></div><div class="date-filters"><label *ngIf="churches.length && !churchSelectionFixed">Église<select [(ngModel)]="reportChurchId" [ngModelOptions]="{standalone:true}"><option *ngIf="isOrganizationAdmin" value="">Toutes les églises</option><option *ngFor="let church of churches" [value]="church.church_id">{{ church.name }}</option></select></label><label>Du<input type="date" [(ngModel)]="reportStart" [ngModelOptions]="{standalone:true}" /></label><label>Au<input type="date" [(ngModel)]="reportEnd" [ngModelOptions]="{standalone:true}" /></label><button class="primary" type="button" (click)="loadReport()" [disabled]="!isOrganizationAdmin && !reportChurchId">Afficher</button></div></div>
        <div class="report-grid" *ngIf="report"><article><span>Séances clôturées</span><strong>{{ report.sessions.closed }}</strong></article><article><span>Attendus</span><strong>{{ report.attendance.expected }}</strong></article><article><span>Présents</span><strong>{{ report.attendance.present }}</strong></article><article><span>Absents</span><strong>{{ report.attendance.absent }}</strong></article><article><span>Excusés</span><strong>{{ report.attendance.excused }}</strong></article><article><span>Retards</span><strong>{{ report.attendance.late }}</strong></article><article><span>Départs anticipés</span><strong>{{ report.attendance.early_departure }}</strong></article><article><span>Taux de présence</span><strong>{{ report.attendance.attendance_rate }}%</strong></article></div>
        <p class="hint">Le taux utilise présents, retards et départs anticipés rapportés aux présences attendues pour les séances clôturées. La période affichée exclut les séances annulées et en cours.</p>
      </section>

      <section class="report-panel" *ngIf="activeView === 'alerts'">
        <div class="section-heading"><div><h2>Alertes d’assiduité</h2><p>Les alertes sont des signaux de suivi pastoral, jamais des sanctions automatiques.</p></div><button class="secondary" type="button" (click)="loadAlerts()">Actualiser</button></div>
        <div class="alert-row" *ngFor="let alert of alerts"><div><strong>{{ alert.member_name }}</strong><small>{{ alertLabel(alert.rule_key) }} · {{ alert.created_at | date:'medium' }}</small><small *ngIf="alert.trigger_detail['rate'] !== undefined">Taux : {{ alert.trigger_detail['rate'] }}%</small><small *ngIf="alert.trigger_detail['count'] !== undefined">Absences consécutives : {{ alert.trigger_detail['count'] }}</small></div><span class="status" [attr.data-status]="alert.status">{{ alertStatusLabel(alert.status) }}</span><div class="actions"><button class="secondary" *ngIf="alert.status === 'NEW'" (click)="alertAction(alert, 'seen')">Marquer consultée</button><button class="secondary" *ngIf="alert.status === 'NEW' || alert.status === 'SEEN'" (click)="alertAction(alert, 'take')">Prendre en charge</button><button class="primary" *ngIf="alert.status !== 'RESOLVED'" (click)="resolveAlert(alert)">Résoudre / noter</button></div></div>
        <p class="empty" *ngIf="alerts.length === 0">Aucune alerte active ou résolue.</p>
        <section class="policy-card" *ngIf="isOrganizationAdmin">
          <h3>Règles par église</h3>
          <label *ngIf="!churchSelectionFixed">Église<select [(ngModel)]="policyChurchId" [ngModelOptions]="{standalone:true}" (change)="loadPolicy()"><option value="">Choisir une église</option><option *ngFor="let church of churches" [value]="church.church_id">{{ church.name }}</option></select></label>
          <div class="policy-fields" *ngIf="policyChurchId"><label>Absences consécutives<input type="number" min="1" [(ngModel)]="policy.consecutive_absences" [ngModelOptions]="{standalone:true}" /></label><label>Taux minimal (%)<input type="number" min="0" max="100" [(ngModel)]="policy.minimum_attendance_rate" [ngModelOptions]="{standalone:true}" /></label><label>Période (semaines)<input type="number" min="1" [(ngModel)]="policy.observation_weeks" [ngModelOptions]="{standalone:true}" /></label><label>Évaluation<select [(ngModel)]="policy.evaluation_frequency" [ngModelOptions]="{standalone:true}"><option value="DAILY">Quotidienne</option><option value="WEEKLY">Hebdomadaire</option></select></label><label class="check"><input type="checkbox" [(ngModel)]="policy.count_excused_absences" [ngModelOptions]="{standalone:true}" /> Inclure les absences excusées</label><button class="primary" type="button" (click)="savePolicy()">Enregistrer les règles</button></div>
          <p class="hint">Valeurs par défaut : 3 absences, 60 %, 8 semaines et exclusion des absences excusées. L’évaluation s’effectue à la consultation des alertes ou via la commande planifiée.</p>
        </section>
      </section>
    </main>
  `,
})
export class AttendanceComponent implements OnInit {
  sessions: AttendanceSession[] = [];
  participants: ExpectedParticipant[] = [];
  members: AttendanceMember[] = [];
  churchMembers: AttendanceMember[] = [];
  churches: AttendanceChurch[] = [];
  campuses: AttendanceCampus[] = [];
  ministries: ChurchStructure[] = [];
  tribes: ChurchStructure[] = [];
  sessionTypes: AttendanceSessionType[] = [];
  alerts: AttendanceAlert[] = [];
  memberHistory: MemberAttendanceHistory[] = [];
  historyMemberId: string | null = null;
  report: AttendanceWeeklyReport | null = null;
  selectedSession: AttendanceSession | null = null;
  selectedCampuses: AttendanceCampus[] = [];
  activeView: 'sessions' | 'reports' | 'alerts' = 'sessions';
  statusFilter = '';
  methods = ['MANUAL', 'LIST'];
  selectedMemberIds: string[] = [];
  memberToAdd = '';
  showCreate = false;
  showTypeForm = false;
  loading = false;
  saving = false;
  errorMessage = '';
  successMessage = '';
  form: FormGroup;
  typeForm: FormGroup;
  visitorForm: FormGroup;
  reportStart: string;
  reportEnd: string;
  policyChurchId = '';
  reportChurchId = '';
  isOrganizationAdmin = false;
  churchSelectionFixed = false;
  policy: Omit<AttendancePolicy, 'id' | 'church'> = {
    consecutive_absences: 3,
    minimum_attendance_rate: 60,
    observation_weeks: 8,
    evaluation_frequency: 'DAILY',
    count_excused_absences: false,
  };

  constructor(
    private fb: FormBuilder,
    private attendance: AttendanceService,
    private structures: MinistryTribeService,
  ) {
    const starts = new Date();
    starts.setHours(9, 0, 0, 0);
    const ends = new Date(starts.getTime() + 2 * 60 * 60 * 1000);
    this.form = this.fb.group({
      title: ['', Validators.required],
      church_id: ['', Validators.required],
      campus_id: [''],
      session_type_id: [''],
      ministry_id: [''],
      tribe_id: [''],
      starts_at: [this.toLocalInput(starts), Validators.required],
      ends_at: [this.toLocalInput(ends), Validators.required],
      population_rule: [''],
      tolerance_minutes: [15, [Validators.required, Validators.min(0), Validators.max(240)]],
      recurrence_frequency: ['NONE'],
    });
    this.typeForm = this.fb.group({
      name: ['', Validators.required],
      population_rule: ['ALL_MEMBERS', Validators.required],
      tolerance_minutes: [15, [Validators.required, Validators.min(0), Validators.max(240)]],
    });
    this.visitorForm = this.fb.group({
      first_name: ['', Validators.required],
      last_name: ['', Validators.required],
      phone: [''],
      reusable: [false],
    });
    const weekStart = new Date(starts);
    weekStart.setDate(starts.getDate() - starts.getDay() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    this.reportStart = this.dateKey(weekStart);
    this.reportEnd = this.dateKey(weekEnd);
  }

  ngOnInit(): void {
    this.form.controls['church_id'].valueChanges.subscribe((churchId) => {
      this.selectedCampuses = this.campuses.filter((campus) => campus.church === churchId);
      if (!this.selectedCampuses.some((campus) => campus.campus_id === this.form.controls['campus_id'].value)) {
        this.form.controls['campus_id'].setValue('');
      }
      this.selectedMemberIds = [];
      this.churchMembers = this.members.filter((member) => member.church_id === churchId);
      this.ministries = [];
      this.tribes = [];
      if (churchId && this.isOrganizationAdmin) {
        this.structures.list('ministries', churchId).subscribe({
          next: (items) => this.ministries = items,
          error: (error) => this.showError(error),
        });
        this.structures.list('tribes', churchId).subscribe({
          next: (items) => this.tribes = items,
          error: (error) => this.showError(error),
        });
      }
    });
    this.form.controls['session_type_id'].valueChanges.subscribe((id) => {
      const type = this.sessionTypes.find((item) => item.id === id);
      if (type) {
        this.form.controls['population_rule'].setValue('');
        this.form.controls['tolerance_minutes'].setValue(type.tolerance_minutes);
        this.methods = [...type.default_methods];
      }
    });
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay() + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    this.attendance.managerContext().subscribe({
      next: (context) => this.loadInitialData(context, start, end),
      error: (error) => this.showError(error),
    });
  }

  private loadInitialData(context: AttendanceManagerContext, start: Date, end: Date): void {
    this.isOrganizationAdmin = context.is_organization_admin;
    this.churchSelectionFixed = context.church_selection_fixed;
    forkJoin({
      sessions: this.attendance.listSessions(),
      members: this.attendance.listMembers(),
      types: this.attendance.listTypes(),
      policies: this.attendance.listPolicies(),
    }).subscribe({
      next: ({ sessions, members, types, policies }) => {
        this.churches = context.churches;
        this.campuses = context.campuses;
        this.sessions = sessions.results;
        this.members = members;
        this.sessionTypes = types.results;
        this.policyChurchId = context.default_church_id ?? this.churches[0]?.church_id ?? '';
        this.reportChurchId = this.churchSelectionFixed
          ? this.policyChurchId
          : this.isOrganizationAdmin ? '' : this.policyChurchId;
        if (context.default_church_id && this.churchSelectionFixed) {
          this.form.controls['church_id'].setValue(context.default_church_id);
        }
        const savedPolicy = policies.find((item) => item.church === this.policyChurchId);
        if (savedPolicy) this.policy = this.policyValues(savedPolicy);
        if (this.sessions.length) this.selectSession(this.sessions[0]);
        this.attendance.report(this.dateKey(start), this.dateKey(end), this.reportChurchId || undefined).subscribe({
          next: (report) => this.report = report,
          error: (error) => this.showError(error),
        });
      },
      error: (error) => this.showError(error),
    });
  }

  loadSessions(): void {
    this.loading = true;
    this.attendance.listSessions({ status: this.statusFilter || undefined }).pipe(
      finalize(() => this.loading = false),
    ).subscribe({
      next: (page) => {
        this.sessions = page.results;
        if (this.selectedSession) {
          this.selectedSession = this.sessions.find((session) => session.id === this.selectedSession?.id) ?? null;
        }
        if (this.selectedSession) this.selectSession(this.selectedSession);
        else this.participants = [];
      },
      error: (error) => this.showError(error),
    });
  }

  selectSession(session: AttendanceSession): void {
    this.selectedSession = session;
    this.attendance.expected(session.id).subscribe({
      next: (participants) => this.participants = participants,
      error: (error) => this.showError(error),
    });
  }

  createSession(): void {
    if (this.form.invalid || this.methods.length === 0) {
      this.form.markAllAsTouched();
      this.errorMessage = this.methods.length ? 'Vérifiez les champs obligatoires.' : 'Activez au moins une méthode de pointage.';
      return;
    }
    const value = this.form.getRawValue();
    const populationRule = value.population_rule || this.sessionTypes.find((item) => item.id === value.session_type_id)?.population_rule || 'ALL_MEMBERS';
    if (populationRule === 'MANUAL' && this.selectedMemberIds.length === 0) {
      this.errorMessage = 'Sélectionnez au moins un membre attendu.';
      return;
    }
    if (populationRule === 'MINISTRY' && !value.ministry_id) {
      this.errorMessage = 'Sélectionnez le ministère concerné.';
      return;
    }
    if (populationRule === 'TRIBE' && !value.tribe_id) {
      this.errorMessage = 'Sélectionnez la tribu concernée.';
      return;
    }
    this.saving = true;
    this.errorMessage = '';
    this.attendance.createSession({
      title: value.title!,
      church_id: value.church_id!,
      campus_id: value.campus_id || null,
      session_type_id: value.session_type_id || null,
      ministry_id: populationRule === 'MINISTRY' ? value.ministry_id : null,
      tribe_id: populationRule === 'TRIBE' ? value.tribe_id : null,
      member_ids: populationRule === 'MANUAL' ? this.selectedMemberIds : undefined,
      starts_at: new Date(value.starts_at!).toISOString(),
      ends_at: new Date(value.ends_at!).toISOString(),
      population_rule: populationRule as 'ALL_MEMBERS' | 'MINISTRY' | 'TRIBE' | 'MANUAL',
      allowed_methods: this.methods,
      tolerance_minutes: Number(value.tolerance_minutes),
      recurrence_frequency: value.recurrence_frequency as 'NONE' | 'WEEKLY' | 'MONTHLY',
    }).pipe(finalize(() => this.saving = false)).subscribe({
      next: (result) => {
        this.successMessage = result.generated_sessions.length > 1
          ? `${result.generated_sessions.length} séances ont été créées et leurs listes figées.`
          : 'La séance et sa liste attendue ont été créées.';
        this.showCreate = false;
        this.loadSessions();
        this.selectSession(result.session);
      },
      error: (error) => this.showError(error),
    });
  }

  get effectivePopulationRule(): string {
    const value = this.form.controls['population_rule'].value;
    return value || this.sessionTypes.find((item) => item.id === this.form.controls['session_type_id'].value)?.population_rule || 'ALL_MEMBERS';
  }

  createType(): void {
    this.typeForm.markAllAsTouched();
    if (this.typeForm.invalid) return;
    const value = this.typeForm.getRawValue();
    this.saving = true;
    this.attendance.createType({
      name: value.name!,
      population_rule: value.population_rule,
      default_methods: ['MANUAL', 'LIST'],
      tolerance_minutes: Number(value.tolerance_minutes),
    }).pipe(finalize(() => this.saving = false)).subscribe({
      next: (type) => {
        this.sessionTypes = [...this.sessionTypes, type].sort((a, b) => a.name.localeCompare(b.name));
        this.form.controls['session_type_id'].setValue(type.id);
        this.typeForm.reset({ name: '', population_rule: 'ALL_MEMBERS', tolerance_minutes: 15 });
        this.successMessage = 'Type de séance créé.';
      },
      error: (error) => this.showError(error),
    });
  }

  toggleMember(memberId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedMemberIds = checked
      ? [...this.selectedMemberIds, memberId]
      : this.selectedMemberIds.filter((id) => id !== memberId);
  }

  addVisitor(session: AttendanceSession): void {
    if (this.visitorForm.invalid) return;
    const value = this.visitorForm.getRawValue();
    this.attendance.addVisitor(session.id, {
      first_name: value.first_name!,
      last_name: value.last_name!,
      phone: value.phone || undefined,
      reusable: value.reusable,
    }).subscribe({
      next: () => {
        this.visitorForm.reset({ first_name: '', last_name: '', phone: '', reusable: false });
        this.successMessage = 'Visiteur ajouté à la liste attendue.';
        this.selectSession(session);
      },
      error: (error) => this.showError(error),
    });
  }

  get availableMembers(): AttendanceMember[] {
    const churchId = this.selectedSession?.church;
    if (!churchId) return [];
    const included = new Set(this.participants.filter((participant) => participant.expected_for_absence).map((participant) => participant.member_id));
    return this.members.filter((member) => member.church_id === churchId && !included.has(member.id));
  }

  addExpectedMember(session: AttendanceSession): void {
    if (!this.memberToAdd) return;
    const reason = prompt('Motif de l’ajout à la liste figée :');
    if (!reason?.trim()) return;
    this.attendance.addExpectedMember(session.id, this.memberToAdd, reason).subscribe({
      next: () => {
        this.memberToAdd = '';
        this.successMessage = 'Membre ajouté à la liste attendue avec un motif tracé.';
        this.selectSession(session);
        this.loadSessions();
      },
      error: (error) => this.showError(error),
    });
  }

  removeExpected(session: AttendanceSession, participant: ExpectedParticipant): void {
    const reason = prompt(`Motif du retrait de ${participant.first_name} ${participant.last_name} :`);
    if (!reason?.trim()) return;
    this.attendance.removeExpectedParticipant(session.id, participant.id, reason).subscribe({
      next: () => {
        this.successMessage = 'Membre retiré de la liste avec un motif tracé.';
        this.selectSession(session);
        this.loadSessions();
      },
      error: (error) => this.showError(error),
    });
  }

  submitExcuse(participant: ExpectedParticipant): void {
    if (!participant.attendance) return;
    const reason = prompt('Motif de l’absence :');
    if (!reason?.trim()) return;
    this.attendance.submitExcuse(participant.attendance.id, reason).subscribe({
      next: () => {
        this.successMessage = 'Justification transmise pour validation.';
        if (this.selectedSession) this.selectSession(this.selectedSession);
      },
      error: (error) => this.showError(error),
    });
  }

  decideExcuse(excuseId: string, approve: boolean): void {
    this.attendance.decideExcuse(excuseId, approve ? 'approve' : 'reject').subscribe({
      next: () => {
        this.successMessage = approve ? 'Justification approuvée.' : 'Justification refusée.';
        if (this.selectedSession) this.selectSession(this.selectedSession);
      },
      error: (error) => this.showError(error),
    });
  }

  earlyDeparture(participant: ExpectedParticipant): void {
    if (!participant.attendance) return;
    const reason = prompt('Motif du départ anticipé (facultatif) :') ?? '';
    this.attendance.earlyDeparture(participant.attendance.id, reason).subscribe({
      next: () => {
        this.successMessage = 'Départ anticipé enregistré.';
        if (this.selectedSession) this.selectSession(this.selectedSession);
      },
      error: (error) => this.showError(error),
    });
  }

  correctAttendance(participant: ExpectedParticipant): void {
    if (!participant.attendance) return;
    const nextStatus = prompt('Nouveau statut : PRESENT, ABSENT, LATE, EXCUSED ou EARLY_DEPARTURE', participant.attendance.status);
    if (!nextStatus || !['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'EARLY_DEPARTURE'].includes(nextStatus)) return;
    const reason = prompt('Motif obligatoire de la correction :');
    if (!reason?.trim()) return;
    this.attendance.correctAttendance(participant.attendance.id, nextStatus, reason).subscribe({
      next: () => {
        this.successMessage = 'Statut corrigé et historique conservé.';
        if (this.selectedSession) this.selectSession(this.selectedSession);
      },
      error: (error) => this.showError(error),
    });
  }

  loadMemberHistory(participant: ExpectedParticipant): void {
    if (!participant.member_id) return;
    this.attendance.attendanceHistory(participant.member_id).subscribe({
      next: (page) => {
        this.historyMemberId = participant.member_id;
        this.memberHistory = page.results;
      },
      error: (error) => this.showError(error),
    });
  }

  transition(session: AttendanceSession, action: 'open' | 'close' | 'cancel'): void {
    if (action === 'cancel' && !confirm('Annuler cette séance ? Elle ne sera pas comptée comme une absence.')) return;
    this.attendance.transition(session.id, action).subscribe({
      next: (updated) => {
        this.successMessage = action === 'close' ? 'La séance est clôturée et les absences ont été calculées.' : `Séance ${this.statusLabel(updated.status).toLowerCase()}.`;
        this.refreshSelected(updated);
      },
      error: (error) => this.showError(error),
    });
  }

  checkIn(session: AttendanceSession, participant: ExpectedParticipant): void {
    this.attendance.checkIn(session.id, participant.id, 'LIST').subscribe({
      next: () => {
        this.successMessage = `${participant.first_name} ${participant.last_name} a été pointé(e).`;
        this.selectSession(session);
        this.loadSessions();
      },
      error: (error) => this.showError(error),
    });
  }

  canListCheckIn(session: AttendanceSession): boolean {
    return session.allowed_methods.includes('LIST');
  }

  toggleMethod(method: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.methods = checked ? [...this.methods, method] : this.methods.filter((item) => item !== method);
  }

  countStatus(status: string): number {
    return this.sessions.filter((session) => session.status === status).length;
  }

  loadReport(): void {
    if (!this.reportStart || !this.reportEnd) return;
    if (!this.isOrganizationAdmin && !this.reportChurchId) {
      this.report = null;
      return;
    }
    this.attendance.report(this.reportStart, this.reportEnd, this.reportChurchId || undefined).subscribe({
      next: (report) => this.report = report,
      error: (error) => this.showError(error),
    });
  }

  loadAlerts(): void {
    forkJoin({ alerts: this.attendance.listAlerts(), policies: this.attendance.listPolicies() }).subscribe({
      next: ({ alerts, policies }) => {
        this.alerts = alerts;
        const selected = policies.find((item) => item.church === this.policyChurchId);
        if (selected) this.policy = this.policyValues(selected);
      },
      error: (error) => this.showError(error),
    });
  }

  loadPolicy(): void {
    this.attendance.listPolicies().subscribe({
      next: (policies) => {
        const saved = policies.find((item) => item.church === this.policyChurchId);
        this.policy = saved ? this.policyValues(saved) : {
          consecutive_absences: 3,
          minimum_attendance_rate: 60,
          observation_weeks: 8,
          evaluation_frequency: 'DAILY',
          count_excused_absences: false,
        };
      },
      error: (error) => this.showError(error),
    });
  }

  savePolicy(): void {
    if (!this.policyChurchId) return;
    this.attendance.savePolicy(this.policyChurchId, this.policy).subscribe({
      next: (policy) => {
        this.policy = this.policyValues(policy);
        this.successMessage = 'Règles d’assiduité enregistrées.';
      },
      error: (error) => this.showError(error),
    });
  }

  alertAction(alert: AttendanceAlert, action: 'seen' | 'take'): void {
    this.attendance.alertAction(alert.id, action).subscribe({
      next: ({ alert: updated }) => this.replaceAlert(updated),
      error: (error) => this.showError(error),
    });
  }

  resolveAlert(alert: AttendanceAlert): void {
    const note = prompt('Note de suivi ou prise de contact (facultatif) :') ?? '';
    this.attendance.alertAction(alert.id, 'resolve', note).subscribe({
      next: ({ alert: updated }) => this.replaceAlert(updated),
      error: (error) => this.showError(error),
    });
  }

  alertLabel(rule: string): string {
    return rule === 'CONSECUTIVE_ABSENCES' ? 'Absences consécutives' : 'Taux d’assiduité faible';
  }

  alertStatusLabel(status: string): string {
    return ({ NEW: 'Nouvelle', SEEN: 'Consultée', IN_PROGRESS: 'En traitement', RESOLVED: 'Résolue' } as Record<string, string>)[status] ?? status;
  }

  statusLabel(status: string): string {
    return ({ PLANNED: 'Planifiée', IN_PROGRESS: 'En cours', CLOSED: 'Clôturée', CANCELLED: 'Annulée' } as Record<string, string>)[status] ?? status;
  }

  attendanceLabel(status: string): string {
    return ({ PRESENT: 'Présent', ABSENT: 'Absent', LATE: 'En retard', EXCUSED: 'Excusé', EARLY_DEPARTURE: 'Départ anticipé' } as Record<string, string>)[status] ?? status;
  }

  initials(participant: ExpectedParticipant): string {
    return `${participant.first_name.charAt(0)}${participant.last_name.charAt(0)}`.toUpperCase();
  }

  private refreshSelected(session: AttendanceSession): void {
    this.selectedSession = session;
    this.loadSessions();
    this.selectSession(session);
  }

  private showError(error: { error?: { detail?: string; [key: string]: unknown } }): void {
    const data = error?.error;
    const message = data?.detail ?? Object.values(data ?? {}).find((value) => typeof value === 'string');
    this.errorMessage = typeof message === 'string' ? message : 'Une erreur empêche de terminer cette opération.';
    this.successMessage = '';
  }

  private toLocalInput(value: Date): string {
    const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  private dateKey(value: Date): string {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }

  private policyValues(policy: AttendancePolicy): Omit<AttendancePolicy, 'id' | 'church'> {
    return {
      consecutive_absences: policy.consecutive_absences,
      minimum_attendance_rate: Number(policy.minimum_attendance_rate),
      observation_weeks: policy.observation_weeks,
      evaluation_frequency: policy.evaluation_frequency,
      count_excused_absences: policy.count_excused_absences,
    };
  }

  private replaceAlert(alert: AttendanceAlert): void {
    this.alerts = this.alerts.map((item) => item.id === alert.id ? alert : item);
    this.successMessage = 'Alerte mise à jour.';
  }
}
