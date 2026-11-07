import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Campus, Church } from '../../core/models/tenant';
import { Member } from '../../core/models/member';
import { Person } from '../../core/models/person';
import { ConfigurationService } from '../../core/services/configuration.service';
import { MemberService } from '../../core/services/member.service';
import { PersonService } from '../../core/services/person.service';
import { TenantService } from '../../core/services/tenant.service';
import { forkJoin } from 'rxjs';
import {
  Page,
  PastoralCase,
  PastoralDashboard,
  PastoralNotification,
  PastoralPrayerRequest,
  PastoralService,
  PastoralTask,
} from '../../core/services/pastoral.service';

type PastoralTab = 'dashboard' | 'cases' | 'prayers' | 'tasks' | 'workflow';

@Component({
  selector: 'app-pastoral',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <main class="pastoral-page">
      <header class="page-header">
        <div>
          <span class="eyebrow">ACCOMPAGNEMENT & CONFIDENTIALITÉ</span>
          <h1>Suivi pastoral</h1>
          <p>Des dossiers confidentiels, un accompagnement suivi et des actions traçables.</p>
        </div>
        <div class="header-actions">
          <button *ngIf="tab === 'dashboard' && can('pastoral.export')" class="refresh-button" type="button" (click)="downloadReport()">Exporter CSV</button>
          <button class="refresh-button" type="button" (click)="loadActiveTab()">Actualiser</button>
        </div>
      </header>

      <nav class="tabs" aria-label="Navigation du suivi pastoral">
        <button *ngIf="can('pastoral.report.read')" [class.active]="tab === 'dashboard'" type="button" (click)="openTab('dashboard')">Vue d’ensemble</button>
        <button *ngIf="can('pastoral.case.read') || can('pastoral.case.create')" [class.active]="tab === 'cases'" type="button" (click)="openTab('cases')">Dossiers</button>
        <button *ngIf="can('pastoral.prayer.read') || can('pastoral.prayer.create')" [class.active]="tab === 'prayers'" type="button" (click)="openTab('prayers')">Demandes de prière</button>
        <button *ngIf="can('pastoral.task.create') || can('pastoral.task.manage')" [class.active]="tab === 'tasks'" type="button" (click)="openTab('tasks')">Mes tâches</button>
        <button *ngIf="can('pastoral.workflow.read') || can('pastoral.workflow.manage')" [class.active]="tab === 'workflow'" type="button" (click)="openTab('workflow')">Workflow & conservation</button>
      </nav>

      <p class="error" role="alert" *ngIf="errorMessage">{{ errorMessage }}</p>
      <p class="success" role="status" *ngIf="successMessage">{{ successMessage }}</p>
      <div class="loading" *ngIf="loading">Chargement…</div>
      <section class="notification-panel" *ngIf="notifications.length">
        <h2>Rappels pastoraux</h2>
        <article *ngFor="let notification of notifications">
          <div><strong>{{ notification.message }}</strong><small>{{ notification.created_at | date:'medium' }}</small></div>
          <a *ngIf="notification.case_id" [routerLink]="['/pastoral/cases', notification.case_id]">Ouvrir le dossier</a>
          <button *ngIf="!notification.read_at" type="button" (click)="markRead(notification)">Marquer comme lu</button>
        </article>
      </section>

      <section *ngIf="tab === 'dashboard' && dashboard && !loading">
        <div class="report-period" *ngIf="can('pastoral.export')">
          <label>Du <input type="date" [(ngModel)]="reportFrom"></label>
          <label>Au <input type="date" [(ngModel)]="reportTo"></label>
        </div>
        <div class="stat-grid">
          <article><span>Dossiers ouverts</span><strong>{{ dashboard.open_cases }}</strong></article>
          <article><span>En attente</span><strong>{{ dashboard.waiting_cases }}</strong></article>
          <article><span>À attribuer · alertes {{ dashboard.unassigned_alerts }}</span><strong>{{ dashboard.unassigned_cases }}</strong></article>
          <article><span>Tâches en retard</span><strong>{{ dashboard.overdue_tasks }}</strong></article>
          <article><span>Prières suivies</span><strong>{{ dashboard.prayer_requests_followed }}</strong></article>
        </div>
        <div class="panel">
          <div class="panel-heading"><div><h2>Répartition des dossiers</h2><p>Statuts visibles selon vos autorisations.</p></div></div>
          <div class="status-list">
            <div *ngFor="let row of dashboard.cases_by_status"><span>{{ row.status }}</span><strong>{{ row.total }}</strong></div>
          </div>
          <div class="secondary-stats">
            <span>Rencontres réalisées <b>{{ dashboard.interactions_completed }}</b></span>
            <span>Rencontres manquées <b>{{ dashboard.interactions_missed }}</b></span>
            <span>Dossiers clôturés <b>{{ dashboard.closed_cases }}</b></span>
          </div>
        </div>
      </section>

      <section *ngIf="tab === 'cases'">
        <div class="panel">
          <div class="panel-heading">
            <div><h2>Dossiers pastoraux</h2><p>Uniquement les dossiers auxquels votre rôle et votre partage vous donnent accès.</p></div>
            <button *ngIf="can('pastoral.case.create')" class="primary" type="button" (click)="showCaseForm = true">Nouveau dossier</button>
          </div>
          <p class="duplicate-warning" *ngIf="possibleDuplicateCases.length">Des dossiers ouverts ou en cours existent déjà pour cette personne : {{ possibleDuplicateTitles }}.</p>
          <div class="empty" *ngIf="!can('pastoral.case.read')">Votre rôle ne permet pas de consulter la liste des dossiers.</div>
          <div class="table-wrap" *ngIf="can('pastoral.case.read')">
            <table>
              <thead><tr><th>Dossier</th><th>Personne</th><th>Église</th><th>Statut</th><th>Responsable</th><th></th></tr></thead>
              <tbody>
                <tr *ngFor="let item of casePage?.results">
                  <td><strong>{{ item.title }}</strong><small>{{ item.category || 'Sans catégorie' }}</small></td>
                  <td>{{ item.member_name || item.person_name || '—' }}</td>
                  <td>{{ item.church_name }}</td>
                  <td><span class="status-chip">{{ item.status }}</span></td>
                  <td>{{ item.assigned_to_name || 'Non attribué' }}</td>
                  <td><a [routerLink]="['/pastoral/cases', item.id]">Ouvrir</a></td>
                </tr>
                <tr *ngIf="!casePage?.results?.length"><td colspan="6" class="empty">Aucun dossier accessible.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section *ngIf="tab === 'prayers'">
        <div class="panel">
          <div class="panel-heading">
            <div><h2>Demandes de prière</h2><p>Les demandes anonymes ne sont liées à aucune identité.</p></div>
            <button *ngIf="can('pastoral.prayer.create')" class="primary" type="button" (click)="showPrayerForm = true">Nouvelle demande</button>
          </div>
          <div class="table-wrap">
            <table><thead><tr><th>Date</th><th>Personne</th><th>Église</th><th>Catégorie</th><th>Statut</th><th>Demande</th></tr></thead>
              <tbody>
                <tr *ngFor="let prayer of prayers"><td>{{ prayer.created_at | date:'short' }}</td><td>{{ prayer.is_anonymous ? 'Anonyme' : prayer.subject_name || '—' }}</td><td>{{ prayer.church_name }}</td><td>{{ prayer.category || '—' }}</td><td><span class="status-chip">{{ prayer.status }}</span><button *ngIf="can('pastoral.prayer.update')" class="text-button" type="button" (click)="advancePrayer(prayer)">Changer le statut</button><button *ngIf="can('pastoral.prayer.share')" class="text-button" type="button" (click)="sharePrayer(prayer)">Partager</button></td><td class="prayer-content">{{ prayer.content }}</td></tr>
                <tr *ngIf="!prayers.length"><td colspan="6" class="empty">Aucune demande de prière accessible.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section *ngIf="tab === 'tasks'">
        <div class="panel">
          <div class="panel-heading"><div><h2>Mes tâches</h2><p>Actions de suivi qui vous sont attribuées.</p></div></div>
          <div class="table-wrap">
            <table><thead><tr><th>Action</th><th>Dossier</th><th>Échéance</th><th>Priorité</th><th>Statut</th></tr></thead>
              <tbody>
                <tr *ngFor="let task of tasks"><td><strong>{{ task.title }}</strong><small>{{ task.description }}</small></td><td><a [routerLink]="['/pastoral/cases', task.case]">Ouvrir le dossier</a></td><td>{{ task.due_at ? (task.due_at | date:'short') : '—' }}</td><td>{{ task.priority }}</td><td><span class="status-chip">{{ task.status }}</span></td></tr>
                <tr *ngIf="!tasks.length"><td colspan="5" class="empty">Aucune tâche attribuée.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section *ngIf="tab === 'workflow' && workflow">
        <div class="panel">
          <div class="panel-heading"><div><h2>Workflow & conservation</h2><p>Les durées sont indicatives et ne déclenchent pas de suppression automatique.</p></div></div>
          <form class="form-grid" (ngSubmit)="saveWorkflow()">
            <label class="wide">Statuts (JSON)<textarea name="statuses" [(ngModel)]="workflowStatuses" rows="5" [readonly]="!can('pastoral.workflow.manage')"></textarea></label>
            <label class="wide">Transitions autorisées (une paire « source&gt;cible » par ligne)<textarea name="transitions" [(ngModel)]="workflowTransitions" rows="4" [readonly]="!can('pastoral.workflow.manage')"></textarea></label>
            <label class="wide">Types d’interaction (JSON)<textarea name="interactionKinds" [(ngModel)]="workflowInteractionKinds" rows="4" [readonly]="!can('pastoral.workflow.manage')"></textarea></label>
            <label>Conservation (jours)<input name="retention" type="number" min="1" [(ngModel)]="retentionDays" [readonly]="!can('pastoral.workflow.manage')"></label>
            <label>Archivage après clôture (jours)<input name="archiveAfter" type="number" min="1" [(ngModel)]="archiveAfterDays" [readonly]="!can('pastoral.workflow.manage')"></label>
            <label>Seuil d’alerte dossiers non attribués (jours)<input name="unassignedAfter" type="number" min="1" [(ngModel)]="unassignedAlertAfterDays" [readonly]="!can('pastoral.workflow.manage')"></label>
            <label class="check wide"><input type="checkbox" name="blockClose" [(ngModel)]="blockCloseWithOpenItems" [disabled]="!can('pastoral.workflow.manage')"> Bloquer la clôture s’il reste des actions ouvertes</label>
            <div class="wide form-actions" *ngIf="can('pastoral.workflow.manage')"><button class="primary" type="submit" [disabled]="saving">Enregistrer le workflow</button></div>
          </form>
        </div>
      </section>

      <div class="modal-backdrop" *ngIf="showCaseForm" (click)="showCaseForm = false">
        <form class="modal" (ngSubmit)="createCase()" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <header class="modal-heading"><h2>Nouveau dossier pastoral</h2><button type="button" (click)="showCaseForm = false">×</button></header>
          <div class="form-grid">
            <label class="wide">Titre *<input name="title" [(ngModel)]="caseForm.title" required /></label>
            <label>Église *<select name="church" [(ngModel)]="caseForm.church_id" required><option value="">Sélectionner</option><option *ngFor="let c of churches" [value]="c.church_id">{{ c.name }}</option></select></label>
            <label>Type de sujet<select name="subjectType" [(ngModel)]="caseForm.subjectType"><option value="member">Membre</option><option value="person">Personne</option></select></label>
            <label>Sujet *<select name="subject" [(ngModel)]="caseForm.subject_id" required><option value="">Sélectionner</option><option *ngFor="let m of subjectOptions" [value]="m.id">{{ subjectName(m) }}</option></select></label>
            <label>Catégorie<input name="category" [(ngModel)]="caseForm.category" /></label>
            <label>Sensibilité<select name="sensitivity" [(ngModel)]="caseForm.sensitivity"><option value="STANDARD">Standard</option><option value="SENSITIVE">Sensible</option><option value="HIGHLY_SENSITIVE">Très sensible</option></select></label>
          </div>
          <div class="actions end"><button class="primary" type="submit" [disabled]="saving">{{ saving ? 'Enregistrement…' : 'Créer le dossier' }}</button><button type="button" class="secondary" (click)="showCaseForm = false">Annuler</button></div>
        </form>
      </div>

      <div class="modal-backdrop" *ngIf="showPrayerForm" (click)="showPrayerForm = false">
        <form class="modal" (ngSubmit)="createPrayer()" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <header class="modal-heading"><h2>Nouvelle demande de prière</h2><button type="button" (click)="showPrayerForm = false">×</button></header>
          <div class="form-grid">
            <label>Église *<select name="church" [(ngModel)]="prayerForm.church_id" required><option value="">Sélectionner</option><option *ngFor="let c of churches" [value]="c.church_id">{{ c.name }}</option></select></label>
            <label class="check"><input type="checkbox" name="anonymous" [(ngModel)]="prayerForm.is_anonymous" /> Demande anonyme</label>
            <label *ngIf="!prayerForm.is_anonymous">Type de sujet<select name="subjectType" [(ngModel)]="prayerForm.subjectType"><option value="member">Membre</option><option value="person">Personne</option></select></label>
            <label *ngIf="!prayerForm.is_anonymous">Sujet *<select name="subject" [(ngModel)]="prayerForm.subject_id" required><option value="">Sélectionner</option><option *ngFor="let m of prayerSubjectOptions" [value]="m.id">{{ subjectName(m) }}</option></select></label>
            <label>Catégorie<input name="category" [(ngModel)]="prayerForm.category" /></label>
            <label class="wide">Demande *<textarea name="content" [(ngModel)]="prayerForm.content" rows="4" required></textarea></label>
          </div>
          <div class="actions end"><button class="primary" type="submit" [disabled]="saving">{{ saving ? 'Enregistrement…' : 'Enregistrer' }}</button><button type="button" class="secondary" (click)="showPrayerForm = false">Annuler</button></div>
        </form>
      </div>
    </main>
  `,
  styles: [`
    :host{display:block;color:#1F2E28}.pastoral-page{max-width:1440px;margin:0 auto;padding:30px 36px 48px}.page-header,.panel-heading{display:flex;align-items:center;justify-content:space-between;gap:20px}.header-actions{display:flex;gap:8px}.eyebrow{font-size:11px;letter-spacing:.13em;font-weight:700;color:#738198}.page-header h1{margin:8px 0 6px;font-size:30px}.page-header p,.panel-heading p{margin:0;color:#7A8A84}.refresh-button,.primary{border:0;border-radius:9px;padding:10px 16px;font-weight:650;cursor:pointer}.refresh-button{background:#fff;border:1px solid #DFE7E3;color:#344054}.primary{background:#2A8768;color:white}.primary:disabled{opacity:.6;cursor:default}.report-period{display:flex;gap:12px;justify-content:flex-end;margin:0 0 14px}.report-period label{display:flex;align-items:center;gap:7px;color:#7A8A84;font-size:12px}.report-period input{border:1px solid #DFE7E3;border-radius:7px;padding:7px;color:#2A3B35}.notification-panel{background:#fff;border:1px solid #E7ECE9;border-radius:12px;padding:16px 20px;margin:0 0 18px}.notification-panel h2{margin:0 0 8px;font-size:16px}.notification-panel article{display:flex;align-items:center;gap:14px;padding:10px 0;border-top:1px solid #edf0f4}.notification-panel article div{flex:1}.notification-panel small{display:block;color:#82918B;margin-top:4px}.notification-panel a,.notification-panel button{border:0;background:none;color:#2A8768;text-decoration:none;font-weight:650;cursor:pointer}.tabs{display:flex;gap:8px;margin:26px 0 20px;border-bottom:1px solid #E6ECE9;overflow-x:auto}.tabs button{border:0;background:none;color:#758197;padding:12px 14px;white-space:nowrap;cursor:pointer;border-bottom:2px solid transparent}.tabs button.active{color:#2A8768;font-weight:700;border-color:#2A8768}.stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:18px}.stat-grid article,.panel{background:white;border:1px solid #E7ECE9;border-radius:13px;box-shadow:0 4px 16px #20334d08}.stat-grid article{padding:19px}.stat-grid span{display:block;color:#7A8A84;font-size:13px}.stat-grid strong{display:block;margin-top:11px;font-size:28px;color:#2A3B35}.panel{padding:22px;margin-bottom:18px}.panel-heading{margin-bottom:18px}.panel-heading h2{margin:0 0 5px;font-size:19px}.status-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.status-list div,.secondary-stats span{display:flex;justify-content:space-between;gap:12px;background:#f7f9fc;border-radius:9px;padding:13px;color:#5F7068}.secondary-stats{display:flex;gap:12px;margin-top:14px;flex-wrap:wrap}.secondary-stats span{flex:1;min-width:190px}.secondary-stats b{color:#2A3B35}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left}th{color:#788499;font-size:12px;text-transform:uppercase;letter-spacing:.04em;font-weight:650;background:#fafbfd}th,td{padding:13px 12px;border-bottom:1px solid #edf0f4;vertical-align:top}td{font-size:14px}td strong,td small{display:block}td small{margin-top:4px;color:#8290a4}.status-chip{display:inline-block;padding:5px 9px;border-radius:20px;background:#eef3f9;color:#33473F;font-size:12px;font-weight:650}.table-wrap a{color:#2A8768;font-weight:650;text-decoration:none}.text-button{display:block;border:0;background:none;color:#2A8768;padding:5px 0;cursor:pointer}.empty{padding:20px;color:#82918B;text-align:center}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;padding:18px;margin:0 0 20px;background:#F8F9FA;border-radius:10px}.form-grid label{display:flex;flex-direction:column;gap:6px;color:#5F7068;font-size:13px;font-weight:600}.form-grid input,.form-grid select,.form-grid textarea{border:1px solid #DFE7E3;border-radius:8px;padding:10px 11px;font:inherit;color:#2A3B35;background:white}.form-grid .wide{grid-column:1/-1}.form-grid .check{flex-direction:row;align-items:center}.form-grid .check input{width:auto}.form-help{margin:0;color:#7a8799;font-size:12px}.form-actions{display:flex;justify-content:flex-end}.prayer-content{min-width:240px;max-width:400px;white-space:pre-wrap}.duplicate-warning{padding:12px 14px;margin:0 0 14px;border-radius:8px;background:#fff7e8;color:#805817}.error,.success{padding:12px 15px;border-radius:8px}.error{background:#fff1f0;color:#a32929}.success{background:#effaf2;color:#267341}.loading{padding:24px;text-align:center;color:#7A8A84}@media(max-width:760px){.pastoral-page{padding:22px 16px}.page-header{align-items:flex-start}.page-header h1{font-size:25px}.stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.status-list{grid-template-columns:repeat(2,minmax(0,1fr))}.panel{padding:16px}.panel-heading{align-items:flex-start}.form-grid{grid-template-columns:1fr;padding:14px}.form-grid .wide{grid-column:auto}}@media(max-width:480px){.stat-grid{grid-template-columns:1fr 1fr}.refresh-button{padding:8px 10px}.secondary-stats span{min-width:100%}}
  `],
})
export class PastoralComponent implements OnInit {
  permissions: string[] = [];
  tab: PastoralTab = 'dashboard';
  loading = false;
  saving = false;
  errorMessage = '';
  successMessage = '';
  dashboard: PastoralDashboard | null = null;
  casePage: Page<PastoralCase> | null = null;
  possibleDuplicateCases: Array<{ id: string; title: string; status: string; church_name: string }> = [];
  prayers: PastoralPrayerRequest[] = [];
  tasks: PastoralTask[] = [];
  notifications: PastoralNotification[] = [];
  workflow: Record<string, unknown> | null = null;
  showCaseForm = false;
  showPrayerForm = false;
  caseForm = { title: '', church_id: '', subjectType: 'member', subject_id: '', category: '', sensitivity: 'STANDARD' };
  prayerForm = { church_id: '', category: '', content: '', is_anonymous: false, subjectType: 'member', subject_id: '' };
  churches: Church[] = [];
  campuses: Campus[] = [];
  members: Member[] = [];
  persons: Person[] = [];
  workflowStatuses = '[]';
  workflowTransitions = '';
  workflowInteractionKinds = '[]';
  retentionDays: number | null = null;
  archiveAfterDays: number | null = null;
  unassignedAlertAfterDays: number | null = null;
  blockCloseWithOpenItems = true;
  reportFrom = '';
  reportTo = '';

  constructor(private pastoral: PastoralService, private configuration: ConfigurationService, private tenantService: TenantService, private memberService: MemberService, private personService: PersonService) {}

  ngOnInit(): void {
    this.loading = true;
    this.configuration.getAccess().subscribe({
      next: (access) => {
        this.permissions = access.permission_codes;
        const firstTab = this.availableTabs()[0] ?? 'dashboard';
        this.tab = firstTab;
        forkJoin({
          context: this.tenantService.churchContext(),
          members: this.memberService.getMembers(),
          persons: this.personService.listPersons(),
        }).subscribe({
          next: ({ context, members, persons }) => {
            this.churches = context.churches || [];
            this.campuses = context.campuses || [];
            this.members = members || [];
            this.persons = persons || [];
            if (!this.churches.length) {
              this.errorMessage = 'Aucune église disponible. Vérifiez votre organisation active.';
            }
          },
          error: (error: HttpErrorResponse) => {
            this.errorMessage = this.describeError(error);
          },
        });
        this.loading = false;
        if (this.can('pastoral.task.create') || this.can('pastoral.task.manage')) {
          this.pastoral.notifications().subscribe({
            next: (items) => this.notifications = items,
            error: (error: HttpErrorResponse) => this.errorMessage = this.describeError(error),
          });
        }
        this.loadActiveTab();
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.describeError(error);
      },
    });
  }

  markRead(notification: PastoralNotification): void {
    this.pastoral.markNotificationRead(notification.id).subscribe({
      next: () => {
        this.notifications = this.notifications.map((item) =>
          item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item,
        );
      },
      error: (error: HttpErrorResponse) => this.errorMessage = this.describeError(error),
    });
  }

  advancePrayer(prayer: PastoralPrayerRequest): void {
    const nextStatus = window.prompt('Nouveau statut (NEW, IN_PROGRESS, ANSWERED ou CLOSED) :', prayer.status);
    if (!nextStatus || nextStatus === prayer.status) return;
    const reason = window.prompt('Motif du changement de statut :');
    if (!reason?.trim()) return;
    this.pastoral.updatePrayerRequest(prayer.id, { status: nextStatus, reason: reason.trim() }).subscribe({
      next: (updated) => {
        this.prayers = this.prayers.map((item) => item.id === updated.id ? { ...item, status: updated.status } : item);
        this.successMessage = 'Le statut de la demande a été mis à jour.';
      },
      error: (error: HttpErrorResponse) => this.errorMessage = this.describeError(error),
    });
  }

  sharePrayer(prayer: PastoralPrayerRequest): void {
    const userId = Number(window.prompt('Identifiant de l’utilisateur autorisé :'));
    if (!Number.isInteger(userId) || userId <= 0) {
      this.errorMessage = 'Identifiant utilisateur invalide.';
      return;
    }
    this.pastoral.sharePrayerRequest(prayer.id, userId).subscribe({
      next: () => this.successMessage = 'La demande a été partagée.',
      error: (error: HttpErrorResponse) => this.errorMessage = this.describeError(error),
    });
  }

  downloadReport(): void {
    this.pastoral.exportReport(this.reportFrom || undefined, this.reportTo || undefined).subscribe({
      next: (file) => {
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'pastoral-report.csv';
        link.click();
        URL.revokeObjectURL(url);
      },
      error: (error: HttpErrorResponse) => this.errorMessage = this.describeError(error),
    });
  }

  can(permission: string): boolean {
    return this.permissions.includes(permission);
  }

  get possibleDuplicateTitles(): string {
    return this.possibleDuplicateCases.map((item) => item.title).join(', ');
  }
  get campusesForCase(): Campus[] {
    return this.caseForm.church_id ? this.campuses.filter((c) => c.church === this.caseForm.church_id) : this.campuses;
  }
  get subjectOptions(): (Member | Person)[] {
    if (this.caseForm.subjectType === 'member') {
      return this.caseForm.church_id
        ? this.members.filter((m) => this.relationId(m.church) === this.caseForm.church_id)
        : this.members;
    }
    return this.persons;
  }
  get prayerSubjectOptions(): (Member | Person)[] {
    if (this.prayerForm.subjectType === 'member') {
      return this.prayerForm.church_id
        ? this.members.filter((m) => this.relationId(m.church) === this.prayerForm.church_id)
        : this.members;
    }
    return this.persons;
  }
  private relationId(value: Member['church']): string {
    if (typeof value === 'string') return value;
    return (value as { church_id?: string } | null)?.church_id ?? '';
  }
  subjectName(item: Member | Person): string {
    return `${(item as Member).first_name ?? (item as Person).first_name} ${(item as Member).last_name ?? (item as Person).last_name}`.trim();
  }

  openTab(tab: PastoralTab): void {
    this.tab = tab;
    this.errorMessage = '';
    this.successMessage = '';
    this.loadActiveTab();
  }

  loadActiveTab(): void {
    this.loading = true;
    this.errorMessage = '';
    const handleError = (error: HttpErrorResponse) => {
      this.loading = false;
      this.errorMessage = this.describeError(error);
    };
    switch (this.tab) {
      case 'dashboard':
        this.pastoral.dashboard().subscribe({
          next: (result) => { this.dashboard = result; this.loading = false; },
          error: handleError,
        });
        break;
      case 'cases':
        if (!this.can('pastoral.case.read')) { this.loading = false; return; }
        this.pastoral.cases().subscribe({
          next: (result) => { this.casePage = result; this.loading = false; },
          error: handleError,
        });
        break;
      case 'prayers':
        if (!this.can('pastoral.prayer.read')) { this.loading = false; return; }
        this.pastoral.prayerRequests().subscribe({
          next: (result) => { this.prayers = result.results; this.loading = false; },
          error: handleError,
        });
        break;
      case 'tasks':
        this.pastoral.tasks().subscribe({
          next: (result) => { this.tasks = result; this.loading = false; },
          error: handleError,
        });
        break;
      case 'workflow':
        if (!this.can('pastoral.workflow.read') && !this.can('pastoral.workflow.manage')) { this.loading = false; return; }
        this.pastoral.workflow().subscribe({
          next: (result) => { this.setWorkflow(result); this.loading = false; },
          error: handleError,
        });
        break;
    }
  }

  createCase(): void {
    const subjectKey = this.caseForm.subjectType === 'member' ? 'member_id' : 'person_id';
    const payload: Record<string, unknown> = {
      title: this.caseForm.title.trim(),
      church_id: this.caseForm.church_id.trim(),
      sensitivity: this.caseForm.sensitivity,
      category: this.caseForm.category.trim(),
    };
    payload[subjectKey] = this.caseForm.subject_id.trim();
    this.saving = true;
    this.pastoral.potentialDuplicates({
      church_id: this.caseForm.church_id.trim(),
      [subjectKey]: this.caseForm.subject_id.trim(),
    }).subscribe({
      next: (duplicates) => {
        this.possibleDuplicateCases = duplicates;
        if (duplicates.length && !window.confirm(`Un dossier existe déjà pour cette personne : ${duplicates.map((item) => item.title).join(', ')}. Créer tout de même un nouveau dossier ?`)) {
          this.saving = false;
          return;
        }
        this.submitCase(payload);
      },
      error: (error: HttpErrorResponse) => { this.saving = false; this.errorMessage = this.describeError(error); },
    });
  }

  private submitCase(payload: Record<string, unknown>): void {
    this.pastoral.createCase(payload).subscribe({
      next: () => {
        this.saving = false;
        this.showCaseForm = false;
        this.caseForm = { title: '', church_id: '', subjectType: 'member', subject_id: '', category: '', sensitivity: 'STANDARD' };
        this.successMessage = 'Le dossier a été créé.';
        this.loadCases();
      },
      error: (error: HttpErrorResponse) => { this.saving = false; this.errorMessage = this.describeError(error); },
    });
  }

  createPrayer(): void {
    const payload: Record<string, unknown> = {
      church_id: this.prayerForm.church_id.trim(),
      category: this.prayerForm.category.trim(),
      content: this.prayerForm.content.trim(),
      is_anonymous: this.prayerForm.is_anonymous,
    };
    if (!this.prayerForm.is_anonymous) {
      payload[this.prayerForm.subjectType === 'member' ? 'member_id' : 'person_id'] = this.prayerForm.subject_id.trim();
    }
    this.saving = true;
    this.pastoral.createPrayerRequest(payload).subscribe({
      next: () => {
        this.saving = false;
        this.showPrayerForm = false;
        this.prayerForm = { church_id: '', category: '', content: '', is_anonymous: false, subjectType: 'member', subject_id: '' };
        this.successMessage = 'La demande de prière a été enregistrée.';
        this.loadPrayers();
      },
      error: (error: HttpErrorResponse) => { this.saving = false; this.errorMessage = this.describeError(error); },
    });
  }

  saveWorkflow(): void {
    if (!this.can('pastoral.workflow.manage')) return;
    let statuses: unknown;
    let interactionKinds: unknown;
    try {
      statuses = JSON.parse(this.workflowStatuses);
      interactionKinds = JSON.parse(this.workflowInteractionKinds);
    } catch {
      this.errorMessage = 'Les statuts et types d’interaction doivent contenir un JSON valide.';
      return;
    }
    const payload = {
      statuses,
      interaction_kinds: interactionKinds,
      transitions: this.workflowTransitions.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
      retention_days: this.retentionDays,
      archive_after_days: this.archiveAfterDays,
      unassigned_alert_after_days: this.unassignedAlertAfterDays,
      block_close_with_open_items: this.blockCloseWithOpenItems,
    };
    this.saving = true;
    this.pastoral.updateWorkflow(payload).subscribe({
      next: (result) => {
        this.saving = false;
        this.setWorkflow(result);
        this.successMessage = 'Le workflow a été enregistré.';
      },
      error: (error: HttpErrorResponse) => { this.saving = false; this.errorMessage = this.describeError(error); },
    });
  }

  private loadCases(): void {
    if (!this.can('pastoral.case.read')) return;
    this.pastoral.cases().subscribe({
      next: (result) => this.casePage = result,
      error: (error: HttpErrorResponse) => this.errorMessage = this.describeError(error),
    });
  }

  private loadPrayers(): void {
    if (!this.can('pastoral.prayer.read')) return;
    this.pastoral.prayerRequests().subscribe({
      next: (result) => this.prayers = result.results,
      error: (error: HttpErrorResponse) => this.errorMessage = this.describeError(error),
    });
  }

  private setWorkflow(result: Record<string, unknown>): void {
    this.workflow = result;
    this.workflowStatuses = JSON.stringify(result['statuses'] ?? [], null, 2);
    this.workflowInteractionKinds = JSON.stringify(result['interaction_kinds'] ?? [], null, 2);
    this.workflowTransitions = Array.isArray(result['transitions']) ? (result['transitions'] as string[]).join('\n') : '';
    this.retentionDays = typeof result['retention_days'] === 'number' ? result['retention_days'] : null;
    this.archiveAfterDays = typeof result['archive_after_days'] === 'number' ? result['archive_after_days'] : null;
    this.unassignedAlertAfterDays = typeof result['unassigned_alert_after_days'] === 'number'
      ? result['unassigned_alert_after_days']
      : null;
    this.blockCloseWithOpenItems = result['block_close_with_open_items'] !== false;
  }

  private availableTabs(): PastoralTab[] {
    const tabs: PastoralTab[] = [];
    if (this.can('pastoral.report.read')) tabs.push('dashboard');
    if (this.can('pastoral.case.read') || this.can('pastoral.case.create')) tabs.push('cases');
    if (this.can('pastoral.prayer.read') || this.can('pastoral.prayer.create')) tabs.push('prayers');
    if (this.can('pastoral.task.create') || this.can('pastoral.task.manage')) tabs.push('tasks');
    if (this.can('pastoral.workflow.read') || this.can('pastoral.workflow.manage')) tabs.push('workflow');
    return tabs;
  }

  private describeError(error: HttpErrorResponse): string {
    const detail = error.error?.detail;
    if (typeof detail === 'string') return detail;
    if (error.error && typeof error.error === 'object') return Object.values(error.error).flat().join(' ');
    return error.message || 'Une erreur est survenue lors du chargement des données pastorales.';
  }
}
