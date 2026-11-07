import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ConfigurationService } from '../../core/services/configuration.service';
import { PastoralAssigneeSuggestion, PastoralCase, PastoralInteraction, PastoralNote, PastoralService, PastoralTask } from '../../core/services/pastoral.service';

type DetailTab = 'overview' | 'interactions' | 'notes' | 'tasks' | 'history' | 'audit';

@Component({
  selector: 'app-pastoral-case-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <main class="detail-page">
      <a class="back-link" routerLink="/pastoral">← Retour au suivi pastoral</a>
      <p class="error" role="alert" *ngIf="errorMessage">{{ errorMessage }}</p>
      <p class="success" role="status" *ngIf="successMessage">{{ successMessage }}</p>
      <div class="loading" *ngIf="loading">Chargement du dossier…</div>

      <ng-container *ngIf="caseItem && !loading">
        <header class="profile-header">
          <div class="avatar">{{ initials }}</div>
          <div class="profile-main">
            <span class="eyebrow">DOSSIER PASTORAL · {{ caseItem.church_name }}</span>
            <h1>{{ caseItem.title }}</h1>
            <p>{{ caseItem.member_name || caseItem.person_name || 'Identité protégée' }} <span *ngIf="caseItem.campus_name">· {{ caseItem.campus_name }}</span></p>
            <div class="badges"><span>{{ caseItem.status }}</span><span>{{ caseItem.sensitivity }}</span><span>{{ caseItem.priority }}</span></div>
          </div>
          <div class="header-actions">
            <button *ngIf="can('pastoral.case.assign')" type="button" (click)="toggleAssign()">Attribuer</button>
            <button *ngIf="can('pastoral.case.share')" type="button" (click)="openShare()">Partager</button>
          </div>
        </header>

        <div class="modal-backdrop" *ngIf="showAssign && can('pastoral.case.assign')" (click)="showAssign = false">
          <form class="modal" (ngSubmit)="assignCase()" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
            <header class="modal-heading"><h2>Attribuer le dossier</h2><button type="button" (click)="showAssign = false">×</button></header>
            <div class="form-grid">
              <label class="wide">Responsable<select name="assignee" [(ngModel)]="assigneeId"><option [ngValue]="null">Non attribué</option><option *ngFor="let suggestion of assigneeSuggestions" [ngValue]="suggestion.id">{{ suggestion.username }} · {{ suggestion.active_case_count }} dossier(s) actif(s)</option></select></label>
              <label class="wide">Motif<input name="assignReason" [(ngModel)]="assignmentReason" required maxlength="500"></label>
            </div>
            <div class="actions end"><button class="primary" type="submit" [disabled]="saving">Confirmer l’attribution</button><button type="button" class="secondary" (click)="showAssign = false">Annuler</button></div>
          </form>
        </div>
        <div class="modal-backdrop" *ngIf="showShare && can('pastoral.case.share')" (click)="showShare = false">
          <form class="modal" (ngSubmit)="shareCase()" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
            <header class="modal-heading"><h2>Partager le dossier</h2><button type="button" (click)="showShare = false">×</button></header>
            <div class="form-grid">
              <label class="wide">Utilisateur *<select name="shareUser" [(ngModel)]="shareUserId" required><option [ngValue]="null">Sélectionner</option><option *ngFor="let suggestion of assigneeSuggestions" [ngValue]="suggestion.id">{{ suggestion.username }}</option></select></label>
              <label class="wide">Niveau d’accès<select name="accessLevel" [(ngModel)]="accessLevel"><option value="READ">Lecture</option><option value="EDIT">Modification</option></select></label>
            </div>
            <div class="actions end"><button class="primary" type="submit" [disabled]="saving">Partager</button><button type="button" class="secondary" (click)="showShare = false">Annuler</button></div>
          </form>
        </div>

        <nav class="tabs" aria-label="Sections du dossier">
          <button *ngFor="let item of visibleTabs" [class.active]="tab === item.id" type="button" (click)="openTab(item.id)">{{ item.label }}</button>
        </nav>

        <section class="panel" *ngIf="tab === 'overview'">
          <div class="panel-heading"><div><h2>Résumé du dossier</h2><p>Les informations et accès sont limités au périmètre pastoral autorisé.</p></div></div>
          <div class="info-grid">
            <div><span>Catégorie</span><strong>{{ caseItem.category || 'Non renseignée' }}</strong></div>
            <div><span>Responsable</span><strong>{{ caseItem.assigned_to_name || 'Non attribué' }}</strong></div>
            <div><span>Prochaine échéance</span><strong>{{ caseItem.next_due_at ? (caseItem.next_due_at | date:'medium') : 'Aucune' }}</strong></div>
            <div><span>Créé le</span><strong>{{ caseItem['created_at'] | date:'medium' }}</strong></div>
          </div>
          <div class="transition" *ngIf="can('pastoral.case.transition') && !caseItem.closed_at">
            <button class="primary" type="button" (click)="showTransition = true">Faire évoluer le dossier</button>
          </div>
          <div class="modal-backdrop" *ngIf="showTransition && can('pastoral.case.transition') && !caseItem.closed_at" (click)="showTransition = false">
            <form class="modal" (ngSubmit)="transitionCase()" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
              <header class="modal-heading"><h2>Faire évoluer le dossier</h2><button type="button" (click)="showTransition = false">×</button></header>
              <div class="form-grid">
                <label class="wide">Nouveau statut<input name="newStatus" [(ngModel)]="newStatus" required maxlength="40"></label>
                <label class="wide">Motif<input name="transitionReason" [(ngModel)]="transitionReason" required maxlength="500"></label>
              </div>
              <div class="actions end"><button class="primary" type="submit" [disabled]="saving">Mettre à jour</button><button type="button" class="secondary" (click)="showTransition = false">Annuler</button></div>
            </form>
          </div>
          <div class="transition lifecycle-actions" *ngIf="caseItem.closed_at && can('pastoral.case.reopen')">
            <button class="primary" type="button" (click)="reopenCase()">Réouvrir le dossier</button>
          </div>
          <div class="transition lifecycle-actions" *ngIf="!caseItem.closed_at && can('pastoral.case.close')">
            <button class="danger" type="button" (click)="closeCase()">Clôturer le dossier</button>
          </div>
        </section>

        <section class="panel" *ngIf="tab === 'interactions'">
          <div class="panel-heading"><div><h2>Interactions</h2><p>Rencontres, appels et suivis programmés.</p></div><button *ngIf="can('pastoral.interaction.create')" class="primary" type="button" (click)="showInteractionForm = true">Planifier</button></div>
          <div class="modal-backdrop" *ngIf="showInteractionForm" (click)="showInteractionForm = false">
            <form class="modal" (ngSubmit)="createInteraction()" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
              <header class="modal-heading"><h2>Planifier une interaction</h2><button type="button" (click)="showInteractionForm = false">×</button></header>
              <div class="form-grid">
                <label>Type<select name="kind" [(ngModel)]="interactionForm.kind"><option *ngFor="let kind of interactionKinds" [value]="kind.code">{{ kind.label }}</option></select></label>
                <label>Date et heure<input name="scheduledAt" type="datetime-local" [(ngModel)]="interactionForm.scheduled_at" required></label>
                <label class="wide">Objectif<input name="objective" [(ngModel)]="interactionForm.objective" maxlength="500"></label>
                <label>Lieu<input name="location" [(ngModel)]="interactionForm.location" maxlength="240"></label>
              </div>
              <div class="actions end"><button class="primary" type="submit" [disabled]="saving">Enregistrer</button><button type="button" class="secondary" (click)="showInteractionForm = false">Annuler</button></div>
            </form>
          </div>
          <div class="item-list">
            <article class="record" *ngFor="let interaction of interactions">
              <div class="record-heading"><div><strong>{{ interaction.kind }} · {{ interaction.scheduled_at | date:'medium' }}</strong><small>{{ interaction.location || 'Lieu non renseigné' }}</small></div><span class="chip">{{ interaction.status }}</span></div>
              <p>{{ interaction.objective || 'Aucun objectif précisé.' }}</p>
              <p *ngIf="interaction.can_read_outcome && interaction.outcome" class="private-note">{{ interaction.outcome }}</p>
              <div class="record-actions" *ngIf="can('pastoral.interaction.update') && ['PLANNED', 'CONFIRMED', 'RESCHEDULED'].includes(interaction.status)">
                <button type="button" (click)="updateInteractionStatus(interaction, 'COMPLETED')">Marquer réalisée</button>
                <button type="button" (click)="updateInteractionStatus(interaction, 'MISSED')">Marquer manquée</button>
                <button type="button" (click)="updateInteractionStatus(interaction, 'RESCHEDULED')">Reporter</button>
              </div>
            </article>
            <p class="empty" *ngIf="!interactions.length">Aucune interaction enregistrée.</p>
          </div>
        </section>

        <section class="panel" *ngIf="tab === 'notes'">
          <div class="panel-heading"><div><h2>Notes de suivi</h2><p>Les notes privées ne sont accessibles qu’à leur auteur tant qu’elles ne sont pas partagées.</p></div></div>
          <button *ngIf="can('pastoral.note.create')" class="primary" type="button" (click)="showNoteForm = true" style="margin-bottom:12px">Ajouter une note</button>
          <div class="modal-backdrop" *ngIf="showNoteForm && can('pastoral.note.create')" (click)="showNoteForm = false">
            <form class="modal" (ngSubmit)="createNote()" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
              <header class="modal-heading"><h2>Nouvelle note de suivi</h2><button type="button" (click)="showNoteForm = false">×</button></header>
              <div class="form-grid">
                <label class="wide">Note<textarea name="noteContent" [(ngModel)]="noteContent" required rows="4"></textarea></label>
                <label class="wide">Sensibilité<select name="noteSensitivity" [(ngModel)]="noteSensitivity"><option value="PRIVATE">Privée</option><option value="CASE_TEAM">Équipe du dossier</option><option value="RESTRICTED">Restreinte</option></select></label>
              </div>
              <div class="actions end"><button class="primary" type="submit" [disabled]="saving">Ajouter</button><button type="button" class="secondary" (click)="showNoteForm = false">Annuler</button></div>
            </form>
          </div>
          <div class="item-list">
            <article class="record note" *ngFor="let note of notes">
              <div class="record-heading"><div><strong>{{ note.author_name }}</strong><small>{{ note.created_at | date:'medium' }} · {{ note.sensitivity }}</small></div></div>
              <p class="private-note">{{ note.content }}</p>
              <div class="record-actions">
                <button *ngIf="note.can_edit" type="button" (click)="startNoteEdit(note)">Corriger</button>
                <button type="button" (click)="toggleNoteHistory(note)">Historique</button>
              </div>
              <form *ngIf="editingNoteId === note.id" class="form-grid" (ngSubmit)="saveNoteRevision(note)">
                <label class="wide">Contenu corrigé<textarea [name]="'edit-note-' + note.id" [(ngModel)]="noteEditContent" required rows="4"></textarea></label>
                <label class="wide">Motif de correction<input [name]="'reason-note-' + note.id" [(ngModel)]="noteEditReason" required maxlength="500"></label>
                <div class="wide form-actions"><button class="primary" type="submit" [disabled]="saving">Enregistrer la correction</button></div>
              </form>
              <div *ngIf="noteHistoryId === note.id" class="revision-list">
                <article *ngFor="let revision of noteRevisions"><small>{{ revision.actor }} · {{ revision.created_at | date:'medium' }} · {{ revision.reason }}</small><p>{{ revision.content }}</p></article>
                <p *ngIf="!noteRevisions.length">Aucune correction antérieure.</p>
              </div>
              <button *ngIf="can('pastoral.note.share') && note.author === currentUserId" type="button" class="share-button" (click)="shareNote(note)">Partager la note</button>
            </article>
            <p class="empty" *ngIf="!notes.length">Aucune note visible pour votre compte.</p>
          </div>
        </section>

        <section class="panel" *ngIf="tab === 'tasks'">
          <div class="panel-heading"><div><h2>Actions & tâches</h2><p>Chaque tâche est attribuée à un responsable autorisé.</p></div><button *ngIf="can('pastoral.task.create')" class="primary" type="button" (click)="showTaskForm = !showTaskForm">{{ showTaskForm ? 'Fermer' : 'Ajouter une tâche' }}</button></div>
          <button *ngIf="can('pastoral.task.create')" class="primary" type="button" (click)="openTaskForm()" style="margin-bottom:12px">{{ showTaskForm ? 'Fermer' : 'Ajouter une tâche' }}</button>
          <div class="modal-backdrop" *ngIf="showTaskForm && can('pastoral.task.create')" (click)="showTaskForm = false">
            <form class="modal" (ngSubmit)="createTask()" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
              <header class="modal-heading"><h2>Nouvelle tâche</h2><button type="button" (click)="showTaskForm = false">×</button></header>
              <div class="form-grid">
                <label class="wide">Action à réaliser<input name="taskTitle" [(ngModel)]="taskForm.title" maxlength="180" required></label>
                <label>Description<input name="taskDescription" [(ngModel)]="taskForm.description" maxlength="500"></label>
                <label>Échéance<input name="taskDueAt" type="datetime-local" [(ngModel)]="taskForm.due_at"></label>
                <label>Responsable *<select name="taskAssignee" [(ngModel)]="taskForm.assigned_to" required><option [ngValue]="null">Sélectionner</option><option *ngFor="let s of assigneeSuggestions" [ngValue]="s.id">{{ s.username }}</option></select></label>
                <label>Priorité<select name="taskPriority" [(ngModel)]="taskForm.priority"><option value="LOW">Faible</option><option value="NORMAL">Normale</option><option value="HIGH">Élevée</option><option value="URGENT">Urgente</option></select></label>
              </div>
              <div class="actions end"><button class="primary" type="submit" [disabled]="saving">Créer</button><button type="button" class="secondary" (click)="showTaskForm = false">Annuler</button></div>
            </form>
          </div>
          <div class="item-list">
            <article class="record" *ngFor="let task of tasks">
              <div class="record-heading"><div><strong>{{ task.title }}</strong><small>{{ task.assigned_to_name }} · {{ task.due_at ? (task.due_at | date:'medium') : 'Sans échéance' }}</small></div><span class="chip">{{ task.status }}</span></div>
              <p>{{ task.description || 'Aucune description.' }}</p>
              <button *ngIf="can('pastoral.task.manage') && task.status === 'OPEN'" type="button" (click)="completeTask(task)">Marquer terminée</button>
            </article>
            <p class="empty" *ngIf="!tasks.length">Aucune tâche enregistrée pour ce dossier.</p>
          </div>
        </section>

        <section class="panel" *ngIf="tab === 'history'">
          <div class="panel-heading"><div><h2>Historique du dossier</h2><p>Journal d’attribution, de statut et de rendez-vous.</p></div></div>
          <ng-container *ngFor="let group of historyGroups">
            <h3>{{ group.title }}</h3>
            <article class="record history-row" *ngFor="let item of group.items">
              <strong>{{ item['previous_status'] || item['previous_user'] || 'Création' }} → {{ item['new_status'] || item['new_user'] || '—' }}</strong>
              <small>{{ item['actor'] }} · {{ historyCreatedAt(item) | date:'medium' }}</small>
              <p>{{ item['reason'] }}</p>
            </article>
          </ng-container>
          <p class="empty" *ngIf="!historyGroups.length">Aucun événement historique.</p>
        </section>
        <section class="panel" *ngIf="tab === 'audit' && can('pastoral.audit.read')">
          <div class="panel-heading"><div><h2>Journal d’audit</h2><p>Événements sensibles sans contenu de notes ni de prières.</p></div></div>
          <article class="record history-row" *ngFor="let event of auditEvents">
            <strong>{{ event.action }} · {{ event.result }}</strong>
            <small>{{ event.actor || 'Compte supprimé' }} · {{ event.created_at | date:'medium' }}</small>
          </article>
          <p class="empty" *ngIf="!auditEvents.length">Aucun événement d’audit disponible.</p>
        </section>
      </ng-container>
    </main>
  `,
  styles: [`
    :host{display:block;color:#1F2E28}.detail-page{max-width:1240px;margin:0 auto;padding:28px 34px 48px}.back-link{display:inline-block;color:#2A8768;text-decoration:none;font-weight:650;margin:0 0 18px}.profile-header{display:flex;align-items:center;gap:18px;background:#fff;border:1px solid #E6ECE9;border-radius:14px;padding:23px;box-shadow:0 4px 16px #20334d08}.avatar{width:62px;height:62px;border-radius:18px;background:#eaf1fa;color:#2A8768;display:grid;place-items:center;font-weight:750;font-size:20px}.profile-main{flex:1}.eyebrow{font-size:11px;letter-spacing:.1em;color:#82918B;font-weight:700}.profile-main h1{margin:5px 0;font-size:25px}.profile-main p{margin:0;color:#69778b}.badges{display:flex;gap:7px;margin-top:12px;flex-wrap:wrap}.badges span,.chip{border-radius:20px;background:#eff3f8;color:#3c5f8b;padding:5px 9px;font-size:12px;font-weight:650}.header-actions{display:flex;gap:8px}.header-actions button,.record button{padding:8px 11px;border:1px solid #DFE7E3;border-radius:8px;background:#fff;color:#2A8768;font-weight:650;cursor:pointer}.tabs{display:flex;gap:5px;margin:22px 0;border-bottom:1px solid #e2e7ee;overflow-x:auto}.tabs button{background:none;border:0;padding:12px 14px;color:#738096;white-space:nowrap;cursor:pointer;border-bottom:2px solid transparent}.tabs button.active{color:#2A8768;border-color:#2A8768;font-weight:700}.panel{background:#fff;border:1px solid #E6ECE9;border-radius:13px;padding:22px;box-shadow:0 4px 16px #20334d08}.panel-heading{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-bottom:17px}.panel-heading h2{margin:0 0 4px;font-size:19px}.panel-heading p{margin:0;color:#7F8E88}.primary{border:0;border-radius:8px;background:#2A8768;color:white;padding:9px 14px;font-weight:650;cursor:pointer}.danger{border:0;border-radius:8px;background:#a43e3e;color:white;padding:9px 14px;font-weight:650;cursor:pointer}.info-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.info-grid div{border-radius:9px;background:#f7f9fc;padding:15px}.info-grid span,.info-grid strong{display:block}.info-grid span{font-size:12px;color:#82918B}.info-grid strong{margin-top:6px}.transition{margin-top:24px;padding-top:18px;border-top:1px solid #edf0f4}.transition h3{font-size:15px}.lifecycle-actions{display:flex;justify-content:flex-end}.inline-form,.form-grid{display:flex;align-items:end;gap:12px;flex-wrap:wrap;padding:14px;margin:14px 0;background:#f7f9fc;border-radius:9px}.inline-form label,.form-grid label{display:flex;flex-direction:column;gap:6px;min-width:180px;flex:1;color:#5F7068;font-size:12px;font-weight:650}.inline-form input,.inline-form select,.form-grid input,.form-grid select,.form-grid textarea{border:1px solid #DFE7E3;border-radius:8px;padding:9px 10px;font:inherit;color:#27364a;background:white}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:end}.form-grid .wide{grid-column:1/-1}.form-actions{display:flex;justify-content:flex-end}.record{padding:15px 2px;border-bottom:1px solid #edf0f4}.record-heading{display:flex;justify-content:space-between;gap:14px;align-items:center}.record-heading strong,.record-heading small{display:block}.record-heading small,.history-row small{color:#7d899a;margin-top:4px}.record p{margin:10px 0 0;color:#5A6B64;white-space:pre-wrap}.private-note{background:#f8f9fc;border-left:3px solid #b6c5d7;padding:10px 12px}.note{padding:16px;border:1px solid #edf0f4;border-radius:9px;margin:10px 0}.share-button{margin-top:12px}.record-actions{display:flex;gap:8px;margin-top:10px}.history-row{display:grid;gap:4px}.history-row p{margin:0;font-size:13px}.empty,.loading{text-align:center;padding:22px;color:#7c8899}.error,.success{padding:12px 14px;border-radius:8px;margin:12px 0}.error{background:#fff0ef;color:#9d2c2c}.success{background:#eff9f1;color:#286f3e}@media(max-width:700px){.detail-page{padding:20px 15px}.profile-header{align-items:flex-start;flex-wrap:wrap;padding:17px}.header-actions{width:100%}.profile-main h1{font-size:21px}.info-grid,.form-grid{grid-template-columns:1fr}.form-grid .wide{grid-column:auto}.inline-form label{min-width:100%}.panel{padding:16px}}
  `],
})
export class PastoralCaseDetailComponent implements OnInit {
  caseId = '';
  caseItem: (PastoralCase & { created_at?: string }) | null = null;
  interactions: PastoralInteraction[] = [];
  notes: PastoralNote[] = [];
  tasks: PastoralTask[] = [];
  history: Record<string, unknown[]> = {};
  auditEvents: Array<{ action: string; actor: string | null; result: string; metadata: Record<string, unknown>; created_at: string }> = [];
  interactionKinds: Array<{ code: string; label: string }> = [];
  permissions: string[] = [];
  currentUserId: number | null = null;
  assigneeSuggestions: PastoralAssigneeSuggestion[] = [];
  tab: DetailTab = 'overview';
  loading = true;
  saving = false;
  errorMessage = '';
  successMessage = '';
  showAssign = false;
  showShare = false;
  showInteractionForm = false;
  showTaskForm = false;
  showTransition = false;
  showNoteForm = false;
  assigneeId: number | null = null;
  shareUserId: number | null = null;
  accessLevel: 'READ' | 'EDIT' = 'READ';
  assignmentReason = '';
  transitionReason = '';
  newStatus = '';
  noteContent = '';
  noteSensitivity = 'PRIVATE';
  editingNoteId: string | null = null;
  noteEditContent = '';
  noteEditReason = '';
  noteHistoryId: string | null = null;
  noteRevisions: Array<{ content: string; actor: string; reason: string; created_at: string }> = [];
  interactionForm = { kind: 'MEETING', scheduled_at: '', objective: '', location: '' };
  taskForm = { title: '', description: '', due_at: '', assigned_to: null as number | null, priority: 'NORMAL' };
  tabs: Array<{ id: DetailTab; label: string }> = [
    { id: 'overview', label: 'Résumé' },
    { id: 'interactions', label: 'Interactions' },
    { id: 'notes', label: 'Notes' },
    { id: 'tasks', label: 'Tâches' },
    { id: 'history', label: 'Historique' },
    { id: 'audit', label: 'Audit' },
  ];

  constructor(
    private route: ActivatedRoute,
    private pastoral: PastoralService,
    private configuration: ConfigurationService,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.caseId = this.route.snapshot.paramMap.get('id') ?? '';
    this.configuration.getAccess().subscribe({
      next: (access) => {
        this.permissions = access.permission_codes;
        this.auth.me().subscribe({
          next: (user) => this.currentUserId = Number(user.id),
          error: (error: HttpErrorResponse) => this.setError(error),
        });
        this.loadCase();
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.describeError(error);
      },
    });
  }

  can(permission: string): boolean {
    return this.permissions.includes(permission);
  }

  toggleAssign(): void {
    this.showAssign = !this.showAssign;
    if (!this.showAssign || !this.caseId) return;
    this.loadAssigneeSuggestions();
  }
  openShare(): void {
    this.showShare = true;
    this.loadAssigneeSuggestions();
  }
  openTaskForm(): void {
    this.showTaskForm = !this.showTaskForm;
    if (this.showTaskForm) this.loadAssigneeSuggestions();
  }
  private loadAssigneeSuggestions(): void {
    if (!this.caseId) return;
    this.pastoral.assigneeSuggestions(this.caseId).subscribe({
      next: (suggestions) => this.assigneeSuggestions = suggestions,
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  get initials(): string {
    return (this.caseItem?.title ?? 'SP').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }

  get visibleTabs(): Array<{ id: DetailTab; label: string }> {
    return this.tabs.filter((item) => item.id !== 'audit' || this.can('pastoral.audit.read'));
  }

  historyCreatedAt(item: Record<string, unknown>): string | null {
    return typeof item['created_at'] === 'string' ? item['created_at'] : null;
  }

  get historyGroups(): Array<{ title: string; items: Array<Record<string, unknown>> }> {
    return Object.entries(this.history)
      .filter(([, rows]) => rows.length)
      .map(([key, rows]) => ({
        title: key === 'assignments' ? 'Attributions' : key === 'statuses' ? 'Changements de statut' : 'Interactions',
        items: rows as Array<Record<string, unknown>>,
      }));
  }

  openTab(tab: DetailTab): void {
    this.tab = tab;
    this.errorMessage = '';
    this.successMessage = '';
    switch (tab) {
      case 'interactions': this.loadInteractions(); break;
      case 'notes': this.loadNotes(); break;
      case 'tasks': this.loadTasks(); break;
      case 'history': this.loadHistory(); break;
      case 'audit': this.loadAudit(); break;
    }
  }

  assignCase(): void {
    if (!this.caseId) return;
    this.saving = true;
    this.pastoral.assignCase(this.caseId, { assigned_to: this.assigneeId, reason: this.assignmentReason.trim() }).subscribe({
      next: (result) => {
        this.caseItem = result;
        this.saving = false;
        this.showAssign = false;
        this.assignmentReason = '';
        this.successMessage = 'L’attribution a été mise à jour.';
      },
      error: (error: HttpErrorResponse) => this.fail(error),
    });
  }

  shareCase(): void {
    if (!this.caseId || this.shareUserId === null) return;
    this.saving = true;
    this.pastoral.shareCase(this.caseId, { user_id: this.shareUserId, access_level: this.accessLevel }).subscribe({
      next: () => {
        this.saving = false;
        this.showShare = false;
        this.shareUserId = null;
        this.successMessage = 'Le dossier a été partagé.';
      },
      error: (error: HttpErrorResponse) => this.fail(error),
    });
  }

  transitionCase(): void {
    if (!this.caseId) return;
    this.saving = true;
    this.pastoral.transitionCase(this.caseId, { status: this.newStatus.trim(), reason: this.transitionReason.trim() }).subscribe({
      next: (result) => {
        this.caseItem = result;
        this.saving = false;
        this.showTransition = false;
        this.transitionReason = '';
        this.newStatus = '';
        this.successMessage = 'Le statut du dossier a été mis à jour.';
        this.loadHistory();
      },
      error: (error: HttpErrorResponse) => this.fail(error),
    });
  }

  closeCase(): void {
    if (!this.caseId) return;
    const reason = window.prompt('Motif de clôture du dossier :');
    if (!reason?.trim()) return;
    this.saving = true;
    this.pastoral.closeCase(this.caseId, reason.trim()).subscribe({
      next: (result) => {
        this.caseItem = result;
        this.saving = false;
        this.successMessage = 'Le dossier a été clôturé.';
        this.loadHistory();
      },
      error: (error: HttpErrorResponse) => this.fail(error),
    });
  }

  reopenCase(): void {
    if (!this.caseId) return;
    const reason = window.prompt('Motif de réouverture :');
    if (!reason?.trim()) return;
    const dueAt = window.prompt('Nouvelle échéance (AAAA-MM-JJ HH:MM, heure locale) :');
    if (!dueAt?.trim()) return;
    const parsedDueAt = new Date(dueAt.replace(' ', 'T'));
    if (Number.isNaN(parsedDueAt.getTime())) {
      this.errorMessage = 'La nouvelle échéance n’est pas valide.';
      return;
    }
    this.saving = true;
    this.pastoral.reopenCase(this.caseId, reason.trim(), parsedDueAt.toISOString()).subscribe({
      next: (result) => {
        this.caseItem = result;
        this.saving = false;
        this.successMessage = 'Le dossier a été réouvert.';
        this.loadHistory();
      },
      error: (error: HttpErrorResponse) => this.fail(error),
    });
  }

  createInteraction(): void {
    if (!this.caseId) return;
    const scheduledAt = new Date(this.interactionForm.scheduled_at);
    if (Number.isNaN(scheduledAt.getTime())) {
      this.errorMessage = 'Veuillez renseigner une date valide.';
      return;
    }
    this.saving = true;
    this.pastoral.createInteraction(this.caseId, {
      kind: this.interactionForm.kind,
      scheduled_at: scheduledAt.toISOString(),
      objective: this.interactionForm.objective.trim(),
      location: this.interactionForm.location.trim(),
    }).subscribe({
      next: () => {
        this.saving = false;
        this.showInteractionForm = false;
        this.interactionForm = { kind: 'MEETING', scheduled_at: '', objective: '', location: '' };
        this.successMessage = 'L’interaction a été planifiée.';
        this.loadInteractions();
      },
      error: (error: HttpErrorResponse) => this.fail(error),
    });
  }

  createNote(): void {
    if (!this.caseId) return;
    this.saving = true;
    this.pastoral.createNote(this.caseId, { content: this.noteContent.trim(), sensitivity: this.noteSensitivity }).subscribe({
      next: () => {
        this.saving = false;
        this.showNoteForm = false;
        this.noteContent = '';
        this.successMessage = 'La note a été ajoutée.';
        this.loadNotes();
      },
      error: (error: HttpErrorResponse) => this.fail(error),
    });
  }

  createTask(): void {
    if (!this.caseId || this.taskForm.assigned_to === null) return;
    const payload: Record<string, unknown> = {
      title: this.taskForm.title.trim(),
      description: this.taskForm.description.trim(),
      assigned_to: this.taskForm.assigned_to,
      priority: this.taskForm.priority,
    };
    if (this.taskForm.due_at) {
      const dueAt = new Date(this.taskForm.due_at);
      if (Number.isNaN(dueAt.getTime())) {
        this.errorMessage = 'Veuillez renseigner une échéance valide.';
        return;
      }
      payload['due_at'] = dueAt.toISOString();
    }
    this.saving = true;
    this.pastoral.createTask(this.caseId, payload).subscribe({
      next: () => {
        this.saving = false;
        this.showTaskForm = false;
        this.taskForm = { title: '', description: '', due_at: '', assigned_to: null, priority: 'NORMAL' };
        this.successMessage = 'La tâche a été créée.';
        this.loadTasks();
      },
      error: (error: HttpErrorResponse) => this.fail(error),
    });
  }

  updateInteractionStatus(interaction: PastoralInteraction, status: string): void {
    if (!this.caseId) return;
    const reason = window.prompt('Motif de mise à jour :');
    if (!reason?.trim()) return;
    const payload: Record<string, unknown> = { status, reason: reason.trim() };
    if (status === 'RESCHEDULED') {
      const scheduledAt = window.prompt('Nouvelle date et heure (AAAA-MM-JJ HH:MM, heure locale) :');
      if (!scheduledAt?.trim()) return;
      const parsed = new Date(scheduledAt.replace(' ', 'T'));
      if (Number.isNaN(parsed.getTime())) {
        this.errorMessage = 'La nouvelle date et heure n’est pas valide.';
        return;
      }
      payload['scheduled_at'] = parsed.toISOString();
    }
    this.pastoral.updateInteraction(this.caseId, interaction.id, payload).subscribe({
      next: () => {
        this.successMessage = 'Le statut de l’interaction a été mis à jour.';
        this.loadInteractions();
        this.loadHistory();
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  shareNote(note: PastoralNote): void {
    if (!this.caseId) return;
    const userId = Number(window.prompt('Identifiant de l’utilisateur autorisé :'));
    if (!Number.isInteger(userId) || userId <= 0) {
      this.errorMessage = 'Identifiant utilisateur invalide.';
      return;
    }
    this.pastoral.shareNote(this.caseId, note.id, userId).subscribe({
      next: () => this.successMessage = 'La note a été partagée.',
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  startNoteEdit(note: PastoralNote): void {
    this.editingNoteId = note.id;
    this.noteEditContent = note.content;
    this.noteEditReason = '';
  }

  saveNoteRevision(note: PastoralNote): void {
    if (!this.caseId) return;
    this.saving = true;
    this.pastoral.reviseNote(this.caseId, note.id, {
      content: this.noteEditContent.trim(),
      reason: this.noteEditReason.trim(),
    }).subscribe({
      next: () => {
        this.saving = false;
        this.editingNoteId = null;
        this.noteEditContent = '';
        this.noteEditReason = '';
        this.successMessage = 'La correction a été enregistrée.';
        this.loadNotes();
      },
      error: (error: HttpErrorResponse) => this.fail(error),
    });
  }

  toggleNoteHistory(note: PastoralNote): void {
    if (this.noteHistoryId === note.id) {
      this.noteHistoryId = null;
      this.noteRevisions = [];
      return;
    }
    if (!this.caseId) return;
    this.pastoral.noteHistory(this.caseId, note.id).subscribe({
      next: (history) => {
        this.noteHistoryId = note.id;
        this.noteRevisions = history;
      },
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  completeTask(task: PastoralTask): void {
    const reason = window.prompt('Motif de clôture de la tâche :');
    if (!reason?.trim()) return;
    this.pastoral.updateTask(task.id, { status: 'DONE', reason: reason.trim() }).subscribe({
      next: () => {
        this.successMessage = 'La tâche a été marquée comme terminée.';
        this.loadTasks();
      },
      error: (error: HttpErrorResponse) => this.fail(error),
    });
  }

  private loadCase(): void {
    this.loading = true;
    this.pastoral.caseDetail(this.caseId).subscribe({
      next: (result) => {
        this.caseItem = result;
        this.newStatus = result.status;
        this.loading = false;
        this.pastoral.interactionKinds(this.caseId).subscribe({
          next: (kinds) => this.interactionKinds = kinds,
          error: (error: HttpErrorResponse) => this.setError(error),
        });
        this.loadAssigneeSuggestions();
      },
      error: (error: HttpErrorResponse) => this.fail(error),
    });
  }

  private loadInteractions(): void {
    this.pastoral.interactions(this.caseId).subscribe({
      next: (result) => this.interactions = result,
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  private loadNotes(): void {
    this.pastoral.notes(this.caseId).subscribe({
      next: (result) => this.notes = result,
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  private loadTasks(): void {
    this.pastoral.tasks(this.caseId).subscribe({
      next: (result) => this.tasks = result,
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  private loadHistory(): void {
    this.pastoral.caseHistory(this.caseId).subscribe({
      next: (result) => this.history = result,
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  private loadAudit(): void {
    this.pastoral.caseAudit(this.caseId).subscribe({
      next: (result) => this.auditEvents = result,
      error: (error: HttpErrorResponse) => this.setError(error),
    });
  }

  private fail(error: HttpErrorResponse): void {
    this.saving = false;
    this.setError(error);
  }

  private setError(error: HttpErrorResponse): void {
    const detail = error.error?.detail;
    this.errorMessage = typeof detail === 'string'
      ? detail
      : error.error && typeof error.error === 'object'
        ? Object.values(error.error).flat().join(' ')
        : error.message || 'Une erreur est survenue lors de la requête pastorale.';
  }

  private describeError(error: HttpErrorResponse): string {
    const detail = error.error?.detail;
    return typeof detail === 'string' ? detail : error.message || 'Impossible de charger les autorisations.';
  }
}
