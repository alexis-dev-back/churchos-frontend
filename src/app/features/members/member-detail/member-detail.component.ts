import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Member, MemberHistoryEntry, MemberHistoryPayload } from '../../../core/models/member';
import { Campus, Church } from '../../../core/models/tenant';
import { AuthService } from '../../../core/services/auth.service';
import { MemberService } from '../../../core/services/member.service';
import { TenantService } from '../../../core/services/tenant.service';
import { ConfigurationService } from '../../../core/services/configuration.service';

type MemberDetailTab = 'information' | 'family' | 'ministries' | 'attendance' | 'finance' | 'history';

@Component({
  selector: 'app-member-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="detail-page" *ngIf="member as item; else loadingState">
      <nav class="breadcrumb" aria-label="Fil d’Ariane">
        <a routerLink="/dashboard">ChurchOS</a><span>/</span><strong>Membre</strong>
      </nav>

      <header class="page-heading">
        <div>
          <a class="back-link" routerLink="/members">← Retour aux membres</a>
          <h1>{{ item.first_name }} {{ item.last_name }}</h1>
          <p>Profil membre</p>
        </div>
        <div class="heading-actions" *ngIf="canManage">
          <button type="button" class="button secondary" (click)="editMember()">Modifier</button>
          <button *ngIf="item.status === 'PENDING'" type="button" class="button primary" (click)="sendInvitation()">Envoyer une invitation</button>
          <button *ngIf="item.status === 'ACTIVE'" type="button" class="button danger" (click)="confirmSuspend = true">Suspendre l’accès</button>
        </div>
      </header>

      <p *ngIf="feedback" class="notice" [class.error]="feedbackIsError" role="status">{{ feedback }}</p>
      <p *ngIf="invitationToken" class="token">Code d’invitation (5 chiffres) : <code>{{ invitationToken }}</code></p>

      <section class="profile-card" aria-label="Résumé du membre">
        <img *ngIf="item.photo" class="profile-avatar profile-photo" [src]="item.photo" alt="Photo de profil" /><span *ngIf="!item.photo" class="profile-avatar">{{ initials(item) }}</span>
        <div class="profile-identity">
          <h2>{{ item.first_name }} {{ item.last_name }}</h2>
          <p>{{ item.email || 'Adresse e-mail non renseignée' }}<span class="summary-separator">·</span>Membre depuis {{ memberSince(item.member_since) }}</p>
          <div class="profile-badges">
            <span class="badge status-badge" [attr.data-status]="item.status"><span class="status-dot"></span>{{ statusLabel(item.status) }}</span>
            <span class="badge">{{ genderLabel(item.gender) }}</span>
            <span class="badge">{{ maritalLabel(item.marital_status) }}</span>
            <span class="badge church-badge">{{ churchName(item.church) }}</span>
          </div>
        </div>
        <div class="last-login">
          <span>Dernière connexion</span>
          <strong>Non renseignée</strong>
        </div>
      </section>

      <nav class="detail-tabs" aria-label="Détails du membre" role="tablist">
        <button type="button" role="tab" id="tab-information" aria-controls="panel-information"
          [attr.aria-selected]="activeTab === 'information'" [class.active]="activeTab === 'information'"
          (click)="activeTab = 'information'">Informations</button>
        <button type="button" role="tab" id="tab-family" aria-controls="panel-family"
          [attr.aria-selected]="activeTab === 'family'" [class.active]="activeTab === 'family'"
          (click)="activeTab = 'family'">Famille</button>
        <button type="button" role="tab" id="tab-ministries" aria-controls="panel-ministries"
          [attr.aria-selected]="activeTab === 'ministries'" [class.active]="activeTab === 'ministries'"
          (click)="activeTab = 'ministries'">Ministères</button>
        <button type="button" role="tab" id="tab-attendance" aria-controls="panel-attendance"
          [attr.aria-selected]="activeTab === 'attendance'" [class.active]="activeTab === 'attendance'"
          (click)="activeTab = 'attendance'">Présence</button>
        <button type="button" role="tab" id="tab-finance" aria-controls="panel-finance"
          [attr.aria-selected]="activeTab === 'finance'" [class.active]="activeTab === 'finance'"
          (click)="activeTab = 'finance'">Finances</button>
        <button type="button" role="tab" id="tab-history" aria-controls="panel-history"
          [attr.aria-selected]="activeTab === 'history'" [class.active]="activeTab === 'history'"
          (click)="activeTab = 'history'">Parcours</button>
      </nav>

      <section *ngIf="activeTab === 'information'" class="information-grid" id="panel-information"
        role="tabpanel" aria-labelledby="tab-information">
        <article class="info-card"><span>Prénom</span><strong>{{ item.first_name }}</strong></article>
        <article class="info-card"><span>Nom</span><strong>{{ item.last_name }}</strong></article>
        <article class="info-card"><span>Email</span><strong>{{ item.email || 'Non renseigné' }}</strong></article>
        <article class="info-card"><span>Téléphone</span><strong>{{ item.phone || 'Non renseigné' }}</strong></article>
        <article class="info-card"><span>Date de naissance</span><strong>{{ formatDate(item.date_of_birth) }}</strong></article>
        <article class="info-card"><span>Genre</span><strong>{{ genderLabel(item.gender) }}</strong></article>
        <article class="info-card"><span>Statut marital</span><strong>{{ maritalLabel(item.marital_status) }}</strong></article>
        <article class="info-card"><span>Nationalité</span><strong>{{ item.nationality || 'Non renseignée' }}</strong></article>
        <article class="info-card"><span>Profession</span><strong>{{ item.profession || 'Non renseignée' }}</strong></article>
        <article class="info-card"><span>Niveau d’étude</span><strong>{{ item.education_level || 'Non renseigné' }}</strong></article>
        <article class="info-card"><span>Situation baptismale</span><strong>{{ baptismLabel(item.baptism_status) }}<span *ngIf="item.baptism_date"> · {{ formatDate(item.baptism_date) }}</span></strong></article>
        <article class="info-card"><span>Contact d’urgence</span><strong>{{ item.emergency_contact_name || 'Non renseigné' }}<span *ngIf="item.emergency_contact_phone"> · {{ item.emergency_contact_phone }}</span></strong></article>
        <article class="info-card"><span>Adresse</span><strong>{{ item.address || 'Non renseignée' }}</strong></article>
        <article class="info-card"><span>Église</span><strong>{{ churchName(item.church) }}</strong></article>
        <article class="info-card"><span>Campus</span><strong>{{ campusName(item.campus) }}</strong></article>
      </section>

      <section *ngIf="activeTab !== 'information'" class="tab-panel" [id]="'panel-' + activeTab"
        role="tabpanel" [attr.aria-labelledby]="'tab-' + activeTab">
        <ng-container [ngSwitch]="activeTab">
          <div *ngSwitchCase="'family'">
            <h2>Informations familiales</h2>
            <p>{{ maritalLabel(item.marital_status) }}<span *ngIf="item.address"> · {{ item.address }}</span></p>
            <p class="tab-note">Les liens familiaux détaillés ne sont pas disponibles dans ce profil.</p>
            <a class="tab-link" routerLink="/families">Ouvrir le répertoire Familles</a>
          </div>
          <div *ngSwitchCase="'ministries'">
            <h2>Ministères</h2>
            <p class="tab-note">Les affectations de ministère ne sont pas disponibles dans ce profil.</p>
            <a class="tab-link" routerLink="/ministries">Ouvrir les Ministères</a>
          </div>
          <div *ngSwitchCase="'attendance'">
            <h2>Présence</h2>
            <p class="tab-note">L’historique de présence n’est pas disponible dans ce profil.</p>
            <a class="tab-link" routerLink="/attendance">Ouvrir le module Présence</a>
          </div>
          <div *ngSwitchCase="'finance'">
            <h2>Finances</h2>
            <p class="tab-note">Les informations financières individuelles ne sont pas disponibles dans ce profil.</p>
            <a class="tab-link" routerLink="/finance">Ouvrir le module Finances</a>
          </div>
          <div *ngSwitchCase="'history'">
            <h2>Historique du parcours</h2>
            <p class="tab-note">Baptêmes, mariages, formations et fonctions exercées.</p>
            <form *ngIf="canManage" class="history-form" (ngSubmit)="addHistory()">
              <label>Événement<select name="event_type" [(ngModel)]="historyDraft.event_type"><option value="BAPTISM">Baptême</option><option value="MARRIAGE">Mariage</option><option value="TRAINING">Formation</option><option value="FUNCTION">Fonction</option><option value="OTHER">Autre</option></select></label>
              <label>Intitulé<input name="title" [(ngModel)]="historyDraft.title" required maxlength="180" /></label>
              <label>Date<input name="event_date" type="date" [(ngModel)]="historyDraft.event_date" /></label>
              <label class="history-description">Détails<textarea name="description" [(ngModel)]="historyDraft.description" rows="2"></textarea></label>
              <button type="submit" class="button primary" [disabled]="savingHistory || !historyDraft.title.trim()">{{ savingHistory ? 'Enregistrement…' : 'Ajouter à l’historique' }}</button>
            </form>
            <p *ngIf="!history.length && !loadingHistory" class="tab-note">Aucun événement de parcours enregistré.</p>
            <ol class="history-list"><li *ngFor="let event of history"><div><strong>{{ event.title }}</strong><span>{{ event.event_type_label }}<span *ngIf="event.event_date"> · {{ formatDate(event.event_date) }}</span></span><p *ngIf="event.description">{{ event.description }}</p></div></li></ol>
          </div>
        </ng-container>
      </section>

      <div class="modal-backdrop" *ngIf="confirmSuspend" (click)="confirmSuspend = false">
        <section class="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="suspend-title" (click)="$event.stopPropagation()">
          <span class="warning-mark">!</span>
          <h2 id="suspend-title">Suspendre les accès ?</h2>
          <p>{{ item.first_name }} {{ item.last_name }} ne pourra plus se connecter jusqu’à réactivation.</p>
          <div class="form-actions confirm-actions">
            <button type="button" class="button danger" (click)="suspend()">Confirmer la suspension</button>
            <button type="button" class="button secondary" (click)="confirmSuspend = false">Annuler</button>
          </div>
        </section>
      </div>
    </section>
    <ng-template #loadingState><p class="loading-state">{{ loading ? 'Chargement de la fiche…' : errorMessage }}</p></ng-template>
  `,
  styles: [`
    :host{display:block;color:#1B2A24}
    .detail-page{max-width:1440px;margin:0 auto;padding:4px 0 32px}
    .breadcrumb{display:flex;align-items:center;gap:9px;margin:0 0 22px;color:#7A8A84;font-size:.82rem}
    .breadcrumb a{color:#6B7D75;text-decoration:none}.breadcrumb strong{color:#1B2A24;font-weight:700}
    .page-heading{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:20px}
    .back-link{display:inline-block;margin-bottom:9px;color:#2A8768;font-size:.88rem;text-decoration:none}
    .page-heading h1{margin:0;font-size:1.42rem;font-weight:750;letter-spacing:-.025em}
    .page-heading p{margin:3px 0 0;color:#7A8A84;font-size:.9rem}
    .heading-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}
    .button{min-height:37px;padding:8px 13px;border:1px solid #E1E8E4;border-radius:8px;background:#fff;color:#1B2A24;font-size:.84rem;font-weight:650;text-decoration:none;cursor:pointer}
    .button.primary{border-color:#2A8768;background:#2A8768;color:#fff}.button.danger{border-color:#dc2626;background:#dc2626;color:#fff}
    .profile-card{display:flex;align-items:center;gap:20px;min-height:122px;padding:20px 26px;border:1px solid #E3EAE6;border-radius:13px;background:#fff;box-shadow:0 2px 4px #1B2A240a}
    .profile-avatar{display:grid;place-items:center;flex:0 0 72px;width:72px;height:72px;border-radius:13px;background:#2A8768;color:#fff;font-size:1.45rem;font-weight:800}
    .profile-avatar.profile-photo{object-fit:cover}
    .profile-identity{min-width:0;flex:1}.profile-identity h2{margin:0 0 3px;font-size:1.22rem;font-weight:750}
    .profile-identity>p{margin:0 0 10px;color:#7A8A84;font-size:.9rem}.summary-separator{margin:0 6px}
    .profile-badges{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
    .badge{display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border:1px solid #E3EAE6;border-radius:6px;background:#F8F9FA;color:#3F5049;font-size:.78rem;line-height:1.2}
    .status-badge{border-color:transparent;background:#ecfdf3;color:#159447}.status-badge[data-status="PENDING"]{background:#fff7e6;color:#b7791f}.status-badge[data-status="SUSPENDED"],.status-badge[data-status="ARCHIVED"]{background:#fff0f0;color:#c53030}
    .status-dot{width:7px;height:7px;border-radius:50%;background:currentColor}.church-badge{border-color:#E5F1EB;background:#F0F7F3;color:#2A8768}
    .last-login{display:grid;gap:3px;min-width:175px;margin-left:auto;text-align:right;color:#7A8A84;font-size:.82rem}
    .last-login strong{color:#1B2A24;font-size:.88rem;font-weight:650}
    .detail-tabs{display:flex;justify-content:flex-start;gap:2px;margin:12px 0 17px;border-bottom:1px solid #E3E9E5;overflow-x:auto}
    .detail-tabs button{position:relative;flex:0 0 auto;padding:13px 10px 12px;border:0;background:transparent;color:#6F8079;font-size:.91rem;cursor:pointer}
    .detail-tabs button.active{color:#2A8768}.detail-tabs button.active:after{position:absolute;right:0;bottom:-1px;left:0;height:3px;background:#2A8768;content:""}
    .information-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .info-card{display:grid;align-content:center;gap:4px;min-height:67px;padding:12px 16px;border:1px solid #E3EAE6;border-radius:9px;background:#F8F9FA}
    .info-card span{color:#7A8A84;font-size:.77rem;font-weight:650;text-transform:uppercase;letter-spacing:.025em}
    .info-card strong{color:#1B2A24;font-size:.93rem;font-weight:550;overflow-wrap:anywhere}
    .tab-panel{padding:16px;border:1px solid #E3EAE6;border-radius:9px}.tab-panel h2{margin:0 0 10px}.tab-note{color:#7A8A84}.tab-link{color:#2A8768;text-decoration:none}
    .notice,.token{padding:10px 12px;margin:0 0 14px;border-radius:8px;background:#e7f3eb;color:#16834b;font-size:.84rem}
    .notice.error{background:#fff0ef;color:#dc2626}.token{background:#fff6df;color:#725314;overflow-wrap:anywhere}
    .loading-state{padding:30px;color:#7A8A84}
    .history-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:14px 0;padding:14px;border:1px solid #E3EAE6;border-radius:8px;background:#F8FAF9}
    .history-form label{display:grid;gap:5px;color:#6F8079;font-size:.78rem;font-weight:650}
    .history-form input,.history-form select,.history-form textarea{min-height:36px;padding:7px 9px;border:1px solid #E3EAE6;border-radius:6px;background:#fff;font:inherit}
    .history-description{grid-column:1/-1}
    .history-list{display:grid;gap:9px;margin:14px 0;padding:0;list-style:none}
    .history-list li{padding:12px;border-left:3px solid #2A8768;border-radius:5px;background:#F8FAF9}
    .history-list li div{display:grid;gap:4px}.history-list strong{font-size:.9rem}.history-list span,.history-list p{margin:0;color:#7A8A84;font-size:.8rem}
    @media(max-width:760px){.page-heading{align-items:flex-start;flex-direction:column}.heading-actions{justify-content:flex-start}.profile-card{align-items:flex-start;gap:14px;padding:16px}.profile-avatar{flex-basis:58px;width:58px;height:58px}.last-login{min-width:0}.information-grid{grid-template-columns:1fr}.history-form{grid-template-columns:1fr}.history-description{grid-column:auto}.detail-tabs button{padding-right:8px;padding-left:8px}}
  `],
})
export class MemberDetailComponent implements OnInit {
  member: Member | null = null;
  churches: Church[] = [];
  campuses: Campus[] = [];
  loading = true;
  canManage = false;
  confirmSuspend = false;
  errorMessage = '';
  feedback = '';
  feedbackIsError = false;
  invitationToken = '';
  activeTab: MemberDetailTab = 'information';
  history: MemberHistoryEntry[] = [];
  loadingHistory = false;
  savingHistory = false;
  historyDraft: MemberHistoryPayload = { event_type: 'BAPTISM', title: '', event_date: '', description: '' };

  constructor(private route: ActivatedRoute, private router: Router, private memberService: MemberService, private tenantService: TenantService, private authService: AuthService, private configurationService: ConfigurationService) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.errorMessage = 'Identifiant membre absent.'; this.loading = false; return; }
    forkJoin({ member: this.memberService.getMember(id), churches: this.tenantService.listChurches(), campuses: this.tenantService.listCampuses(), user: this.authService.me(), access: this.configurationService.getAccess() }).subscribe({
      next: ({ member, churches, campuses, user, access }) => {
        this.member = member; this.churches = churches; this.campuses = campuses;
        const role = user.organizations.find((organization) => organization.tenant_id === user.active_organization?.tenant_id)?.role;
        this.canManage = role === 'owner' || role === 'admin' || access.permission_codes.includes('members.update'); this.loading = false;
        this.loadHistory(member.id);
      },
      error: (error) => { this.errorMessage = this.describeError(error); this.loading = false; },
    });
  }

  initials(member: Member): string { return `${member.first_name.slice(0, 1)}${member.last_name.slice(0, 1)}`.toUpperCase(); }
  churchName(value: Member['church']): string { const id = typeof value === 'string' ? value : value?.church_id; return this.churches.find((church) => church.church_id === id)?.name ?? (typeof value === 'object' && value ? value.name ?? '—' : '—'); }
  campusName(value: Member['campus']): string { const id = typeof value === 'string' ? value : value?.campus_id; return this.campuses.find((campus) => campus.campus_id === id)?.name ?? (typeof value === 'object' && value ? value.name ?? '—' : '—'); }
  statusLabel(status?: string): string { return ({ NEW: 'Nouveau membre', ACTIVE: 'Membre actif', INACTIVE: 'Membre inactif', TRANSFERRED: 'Transféré', DECEASED: 'Décédé', PENDING: 'Invitation en attente', SUSPENDED: 'Accès suspendu', ARCHIVED: 'Archivé' } as Record<string, string>)[status ?? ''] ?? status ?? 'Inconnu'; }
  genderLabel(gender?: string): string { return gender === 'M' ? 'Homme' : gender === 'F' ? 'Femme' : 'Non renseigné'; }
  baptismLabel(value?: string): string { return ({ UNKNOWN: 'Non renseignée', NOT_BAPTIZED: 'Non baptisé(e)', IN_PREPARATION: 'En préparation', BAPTIZED: 'Baptisé(e)' } as Record<string, string>)[value ?? ''] ?? 'Non renseignée'; }
  maritalLabel(value?: string): string { return ({ single: 'Célibataire', married: 'Marié(e)', divorced: 'Divorcé(e)', widowed: 'Veuf/veuve' } as Record<string, string>)[value ?? ''] ?? value ?? 'Non renseigné'; }

  memberSince(value?: string): string {
    if (!value) return 'date non renseignée';
    return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00`));
  }

  formatDate(value?: string): string {
    if (!value) return 'Non renseignée';
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00`));
  }

  editMember(): void {
    if (this.member) this.router.navigate(['/members'], { queryParams: { edit: this.member.id } });
  }

  sendInvitation(): void {
    if (!this.member) return;
    this.memberService.resendInvitation(this.member.id).subscribe({
      next: (response) => { this.invitationToken = response.invitation_token; this.feedback = 'Nouvelle invitation créée. Transmettez le code à 5 chiffres au membre.'; this.feedbackIsError = false; },
      error: (error) => { this.feedback = this.describeError(error); this.feedbackIsError = true; },
    });
  }

  suspend(): void {
    if (!this.member) return;
    this.memberService.suspendMember(this.member.id).subscribe({
      next: () => { if (this.member) this.member = { ...this.member, status: 'SUSPENDED' }; this.feedback = 'Accès suspendus.'; this.feedbackIsError = false; this.confirmSuspend = false; },
      error: (error) => { this.feedback = this.describeError(error); this.feedbackIsError = true; this.confirmSuspend = false; },
    });
  }

  addHistory(): void {
    if (!this.member || !this.historyDraft.title.trim() || this.savingHistory) return;
    this.savingHistory = true;
    this.memberService.addHistory(this.member.id, {
      ...this.historyDraft,
      title: this.historyDraft.title.trim(),
      event_date: this.historyDraft.event_date || null,
    }).subscribe({
      next: (entry) => {
        this.history = [entry, ...this.history].sort((a, b) => (b.event_date || b.created_at).localeCompare(a.event_date || a.created_at));
        this.historyDraft = { event_type: 'BAPTISM', title: '', event_date: '', description: '' };
        this.feedback = 'Événement ajouté à l’historique.';
        this.feedbackIsError = false;
        this.savingHistory = false;
      },
      error: (error) => { this.feedback = this.describeError(error); this.feedbackIsError = true; this.savingHistory = false; },
    });
  }

  private loadHistory(memberId: string): void {
    this.loadingHistory = true;
    this.memberService.getHistory(memberId).subscribe({
      next: (history) => { this.history = history; this.loadingHistory = false; },
      error: (error) => { this.feedback = this.describeError(error); this.feedbackIsError = true; this.loadingHistory = false; },
    });
  }

  private describeError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as Record<string, unknown> | string | null;
      if (typeof body === 'string') return body;
      if (body && typeof body === 'object') { const detail = body['detail']; if (typeof detail === 'string') return detail; return Object.entries(body).map(([key, value]) => `${key} : ${Array.isArray(value) ? value.join(', ') : value}`).join(' · '); }
      return `Erreur API (${error.status}).`;
    }
    return 'Une erreur inattendue est survenue.';
  }
}
