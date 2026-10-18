import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { Campus, Church } from '../../../core/models/tenant';
import { Member, MemberCreateRequest } from '../../../core/models/member';
import { MemberService } from '../../../core/services/member.service';
import { TenantService } from '../../../core/services/tenant.service';
import { FamilyService } from '../../../core/services/family.service';

@Component({
  selector: 'app-member-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="page members-page">
      <nav class="directory-breadcrumb"><a routerLink="/dashboard">Accueil</a><span>›</span><strong>Membres</strong></nav>
      <header class="directory-heading"><div class="directory-title"><span class="directory-title-icon" aria-hidden="true">♟</span><div><h1>Membres</h1><p>Gérez les membres de votre église, leurs informations et leur parcours spirituel.</p></div></div><div class="directory-actions"><button class="primary" type="button" (click)="openCreate()">＋ Ajouter un membre</button><button class="directory-more" type="button" aria-label="Actualiser la liste" (click)="reload()">···</button></div></header>
      <p *ngIf="errorMessage" class="notice error" role="alert">{{ errorMessage }}</p>
      <p *ngIf="successMessage" class="notice success" role="status">{{ successMessage }}</p>
      <p *ngIf="invitationToken" class="token-box">Code d’invitation à 5 chiffres à transmettre au membre : <code>{{ invitationToken }}</code></p>

      <div class="summary-strip">
        <article class="summary-tile"><span class="summary-mark blue">♟</span><div><strong>{{ members.length }}</strong><span>Total des membres</span><small>Profils enregistrés</small></div></article>
        <article class="summary-tile"><span class="summary-mark green">♟</span><div><strong>{{ familiesAvailable ? familyCount : '—' }}</strong><span>Familles</span><small>Foyers enregistrés</small></div></article>
        <article class="summary-tile"><span class="summary-mark purple">♙</span><div><strong>{{ newMembersThisMonth }}</strong><span>Nouveaux ce mois</span><small>Récemment inscrits</small></div></article>
        <article class="summary-tile"><span class="summary-mark orange">◉</span><div><strong>{{ inactiveMembersCount }}</strong><span>Membres inactifs</span><small>À accompagner</small></div></article>
      </div>

      <div class="modal-backdrop" *ngIf="formOpen" (click)="closeForm()"><form class="editor modal" [formGroup]="form" (ngSubmit)="save()" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="member-form-title">
        <div class="editor-heading"><h2 id="member-form-title">{{ editingId ? 'Modifier le profil' : 'Nouveau membre' }}</h2><button type="button" class="icon-close" aria-label="Fermer le formulaire" (click)="closeForm()">×</button></div>
        <div class="form-grid">
          <label>Prénom *<input formControlName="first_name" autocomplete="given-name" /></label>
          <label>Nom *<input formControlName="last_name" autocomplete="family-name" /></label>
          <label>Email *<input type="email" formControlName="email" autocomplete="email" /></label>
          <label>Téléphone<input formControlName="phone" autocomplete="tel" /></label>
          <label>Genre<select formControlName="gender"><option value="">Non renseigné</option><option value="M">Homme</option><option value="F">Femme</option></select></label>
          <label>Date de naissance<input type="date" formControlName="date_of_birth" /></label>
          <label *ngIf="!churchSelectionFixed">Église *<select formControlName="church" (change)="filterCampuses()"><option value="">Sélectionner</option><option *ngFor="let church of churches" [value]="church.church_id">{{ church.name }}</option></select></label>
          <label>Campus (facultatif)<select formControlName="campus" (change)="rememberCampus()"><option value="">Aucun campus</option><option *ngFor="let campus of visibleCampuses" [value]="campus.campus_id">{{ campus.name }}</option></select></label>
          <label>Situation matrimoniale<select formControlName="marital_status"><option value="">Non renseignée</option><option value="single">Célibataire</option><option value="married">Marié(e)</option><option value="divorced">Divorcé(e)</option><option value="widowed">Veuf/Veuve</option></select></label>
          <label class="wide">Adresse<textarea formControlName="address"></textarea></label>
        </div>
        <div class="form-actions"><button class="primary" type="submit" [disabled]="form.invalid || saving || !churches.length">{{ saving ? 'Enregistrement…' : editingId ? 'Enregistrer les changements' : 'Créer le membre et générer une invitation' }}</button><button type="button" class="quiet" (click)="closeForm()">Annuler</button></div>
      </form></div>

      <div class="members-workspace"><section class="table-panel member-directory-table">
        <div class="member-filters"><label class="member-search"><span aria-hidden="true">⌕</span><input class="search" type="search" placeholder="Rechercher un membre..." aria-label="Rechercher un membre" [(value)]="search" (input)="onSearch($event)" /></label><select aria-label="Filtrer par statut" [value]="statusFilter" (change)="filterStatus($event)"><option value="ALL">Tous les statuts</option><option value="ACTIVE">Actifs</option><option value="PENDING">Invitation en attente</option><option value="SUSPENDED">Suspendus</option><option value="ARCHIVED">Archivés</option></select><select aria-label="Filtrer par église" [value]="churchFilter" (change)="setChurchFilter($event)"><option value="ALL">Toutes les églises</option><option *ngFor="let church of churches" [value]="church.church_id">{{ church.name }}</option></select><select aria-label="Filtrer par campus" [value]="campusFilter" (change)="setCampusFilter($event)"><option value="ALL">Tous les campus</option><option *ngFor="let campus of filteredCampuses" [value]="campus.campus_id">{{ campus.name }}</option></select><button class="member-filter-button" type="button" (click)="resetFilters()">☷ Filtres</button></div>
        <div class="table-wrap"><table><thead><tr><th><input type="checkbox" aria-label="Sélectionner tous les membres affichés" [checked]="allVisibleSelected" (change)="toggleVisibleSelection($event)" /></th><th>Photo</th><th>Nom complet</th><th>Coordonnées</th><th>Église / campus</th><th>Statut</th><th>Actions</th></tr></thead><tbody>
          <tr *ngFor="let member of filteredMembers; trackBy: trackById" (click)="selectMember(member)" [class.selected-row]="selectedMember?.id === member.id">
            <td><input type="checkbox" [attr.aria-label]="'Sélectionner ' + member.first_name + ' ' + member.last_name" [checked]="selectedMemberIds.has(member.id)" (click)="$event.stopPropagation()" (change)="toggleMemberSelection(member.id, $event)" /></td>
            <td><span class="member-row-avatar">{{ initials(member) }}</span></td>
            <td><strong>{{ member.first_name }} {{ member.last_name }}</strong><small>{{ member.status === 'ACTIVE' ? 'Membre actif' : statusLabel(member.status) }}</small></td>
            <td>{{ member.phone || '—' }}<small>{{ member.email }}</small></td>
            <td>{{ churchName(member.church) }}<small>{{ campusName(member.campus) }}</small></td>
            <td><span class="member-status" [attr.data-status]="member.status">{{ member.status === 'ACTIVE' ? 'Actif' : statusLabel(member.status) }}</span></td>
            <td><div class="context-wrap"><button type="button" class="context-trigger" aria-label="Actions du membre" (click)="toggleMenu(member.id, $event)">⋮</button><div class="context-menu" *ngIf="openMenuId === member.id"><button type="button" (click)="viewDetails(member)">Voir détail</button><button type="button" *ngIf="canManage" (click)="edit(member)">Modifier</button><button type="button" *ngIf="canManage && member.status === 'PENDING'" (click)="invite(member)">Renvoyer l’invitation</button><button type="button" *ngIf="canManage && member.status === 'ACTIVE'" (click)="askSuspend(member)">Suspendre les accès</button><button type="button" *ngIf="canManage && member.status !== 'ARCHIVED'" class="danger" (click)="askArchive(member)">Archiver</button></div></div></td>
          </tr>
          <tr *ngIf="!pagedMembers.length"><td colspan="7" class="empty">{{ loading ? 'Chargement…' : members.length ? 'Aucun résultat.' : 'Aucun membre dans cette organisation.' }}</td></tr>
        </tbody></table></div>
        <footer class="member-table-footer"><span>Affichage de {{ rangeStart }} à {{ rangeEnd }} sur {{ filteredMembers.length }} membres</span><div class="member-pagination"><button type="button" aria-label="Page précédente" [disabled]="pageIndex === 0" (click)="changePage(-1)">‹</button><button *ngFor="let page of visiblePages" type="button" [class.current-page]="page === pageIndex" (click)="goToPage(page)">{{ page + 1 }}</button><span *ngIf="pageCount > 5">…</span><button *ngIf="pageCount > 5" type="button" [class.current-page]="pageIndex === pageCount - 1" (click)="goToPage(pageCount - 1)">{{ pageCount }}</button><button type="button" aria-label="Page suivante" [disabled]="pageIndex + 1 >= pageCount" (click)="changePage(1)">›</button></div></footer>
      </section>
      <aside class="member-preview" *ngIf="selectedMember as member"><div class="member-preview-heading"><div class="member-preview-cover"></div><button type="button" class="member-preview-menu" aria-label="Actions du membre" (click)="toggleMenu(member.id, $event)">···</button></div><div class="member-preview-summary"><span class="member-preview-avatar">{{ initials(member) }}</span><div><h2>{{ member.first_name }} {{ member.last_name }}</h2><span class="member-status" [attr.data-status]="member.status">{{ member.status === 'ACTIVE' ? 'Membre actif' : statusLabel(member.status) }}</span><small>Membre depuis {{ member.member_since | date:'d MMM, y' }}</small></div></div><nav class="member-preview-tabs" aria-label="Informations du membre"><button type="button" [class.active]="memberTab === 'profile'" (click)="memberTab = 'profile'">Profil</button><button type="button" [class.active]="memberTab === 'family'" (click)="memberTab = 'family'">Famille</button><button type="button" [class.active]="memberTab === 'activities'" (click)="memberTab = 'activities'">Activités</button><button type="button" [class.active]="memberTab === 'history'" (click)="memberTab = 'history'">Historique</button></nav>
        <div class="member-preview-content" *ngIf="memberTab === 'profile'"><h3>Informations personnelles</h3><div class="member-preview-row"><span>☎</span><div><small>Téléphone</small><strong>{{ member.phone || 'Non renseigné' }}</strong></div></div><div class="member-preview-row"><span>✉</span><div><small>Email</small><strong>{{ member.email || 'Non renseigné' }}</strong></div></div><div class="member-preview-row"><span>▦</span><div><small>Date de naissance</small><strong>{{ member.date_of_birth ? (member.date_of_birth | date:'d MMMM y') : 'Non renseignée' }}</strong></div></div><div class="member-preview-row"><span>♙</span><div><small>Genre</small><strong>{{ genderLabel(member.gender) }}</strong></div></div><div class="member-preview-row"><span>⌖</span><div><small>Adresse</small><strong>{{ member.address || 'Non renseignée' }}</strong></div></div><div class="member-preview-row"><span>▣</span><div><small>Église / campus</small><strong>{{ churchName(member.church) }}<ng-container *ngIf="campusName(member.campus) !== '—'"> · {{ campusName(member.campus) }}</ng-container></strong></div></div><h3 class="member-preview-section-heading">Situation familiale</h3><div class="member-preview-row"><span>♥</span><div><small>État civil</small><strong>{{ maritalStatusLabel(member.marital_status) }}</strong></div></div></div>
        <div class="member-preview-content" *ngIf="memberTab === 'family'"><h3>Informations familiales</h3><div class="member-preview-row"><span>♥</span><div><small>Situation matrimoniale</small><strong>{{ maritalStatusLabel(member.marital_status) }}</strong></div></div><div class="member-preview-row"><span>⌖</span><div><small>Adresse du membre</small><strong>{{ member.address || 'Non renseignée' }}</strong></div></div><p class="member-preview-empty">Les liens avec une famille et les autres membres du foyer se consultent dans le répertoire Familles.</p><a class="member-preview-link" routerLink="/families">Ouvrir le répertoire Familles</a></div>
        <div class="member-preview-content empty-preview" *ngIf="memberTab === 'activities'"><h3>Activités</h3><p>Aucune activité récente n’est disponible dans ce dossier.</p></div>
        <div class="member-preview-content" *ngIf="memberTab === 'history'"><h3>Historique du profil</h3><div class="member-preview-row"><span>＋</span><div><small>Inscription comme membre</small><strong>{{ member.member_since ? (member.member_since | date:'d MMMM y') : 'Date non renseignée' }}</strong></div></div><div class="member-preview-row"><span>◷</span><div><small>Dernière mise à jour</small><strong>{{ member.updated_at ? (member.updated_at | date:'d MMMM y') : 'Aucun historique disponible' }}</strong></div></div></div>
        <div class="member-preview-actions"><button type="button" class="edit-member-button" *ngIf="canManage" (click)="edit(member)">✎ Modifier</button><button type="button" class="disable-member-button" *ngIf="canManage && member.status === 'ACTIVE'" (click)="askSuspend(member)">⊘ Désactiver</button><button type="button" class="disable-member-button" *ngIf="canManage && member.status === 'PENDING'" (click)="invite(member)">Renvoyer l’invitation</button></div>
      </aside>
      </div>
      <div class="modal-backdrop" *ngIf="detailMember" (click)="detailMember = null"><section class="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="member-detail-title" (click)="$event.stopPropagation()"><div class="editor-heading"><h2 id="member-detail-title">{{ detailMember.first_name }} {{ detailMember.last_name }}</h2><button type="button" class="icon-close" aria-label="Fermer" (click)="detailMember = null">×</button></div><dl class="detail-grid"><dt>Email</dt><dd>{{ detailMember.email }}</dd><dt>Téléphone</dt><dd>{{ detailMember.phone || '—' }}</dd><dt>Statut</dt><dd>{{ statusLabel(detailMember.status) }}</dd><dt>Église</dt><dd>{{ churchName(detailMember.church) }}</dd><dt>Campus</dt><dd>{{ campusName(detailMember.campus) }}</dd><dt>Adresse</dt><dd>{{ detailMember.address || '—' }}</dd></dl></section></div>
      <div class="modal-backdrop" *ngIf="pendingAction" (click)="pendingAction = null"><section class="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" (click)="$event.stopPropagation()"><span class="warning-mark">!</span><h2 id="confirm-title">{{ pendingAction.type === 'suspend' ? 'Suspendre les accès ?' : 'Archiver ce membre ?' }}</h2><p>{{ pendingAction.type === 'suspend' ? 'Le membre ne pourra plus se connecter jusqu’à réactivation.' : 'Ce profil sera archivé et son compte désactivé.' }} <strong>{{ pendingAction.member.first_name }} {{ pendingAction.member.last_name }}</strong></p><div class="form-actions"><button type="button" class="danger-solid" (click)="confirmAction()">Confirmer</button><button type="button" class="quiet" (click)="pendingAction = null">Annuler</button></div></section></div>
    </section>
  `,
  styles: [`
    :host{display:block;color:#202b34}.page{max-width:1320px;margin:0 auto}.heading,.table-heading,.editor-heading{display:flex;justify-content:space-between;align-items:center;gap:16px}.heading{margin-bottom:20px}.eyebrow{margin:0 0 7px;color:#157c72;font-size:.72rem;font-weight:800}.heading h1{margin:0;font-size:1.8rem}.heading p:not(.eyebrow){margin:5px 0 0;color:#69757a}.primary,.quiet{min-height:38px;padding:9px 13px;border:1px solid #166d65;background:#166d65;color:#fff;font-weight:700;cursor:pointer}.quiet{border-color:#d4dfdc;background:#fff;color:#29423e}.primary:disabled{opacity:.55;cursor:not-allowed}.editor,.table-panel{margin-bottom:18px;border:1px solid #dce4e2;background:#fff;padding:18px}.editor-heading h2,.table-heading h2{margin:0;font-size:1rem}.icon-close{border:0;background:none;font-size:1.5rem;cursor:pointer}.form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:16px 0}.form-grid label{display:grid;gap:6px;color:#53615e;font-size:.8rem;font-weight:700}.form-grid input,.form-grid select,.form-grid textarea,.search{width:100%;min-height:38px;padding:8px 10px;border:1px solid #cfd9d6;background:white;color:#202b34;font:inherit}.form-grid textarea{min-height:70px}.wide{grid-column:1/-1}.form-actions{display:flex;gap:8px}.table-heading{margin-bottom:14px}.search{max-width:280px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:920px}th,td{padding:12px 10px;border-top:1px solid #edf1f0;text-align:left;vertical-align:top}th{color:#69757a;font-size:.7rem;text-transform:uppercase}td{font-size:.85rem}td small{display:block;margin-top:4px;color:#75817f;font-size:.76rem}.status{display:inline-block;padding:5px 8px;background:#edf3f1;font-size:.7rem;font-weight:800}.status[data-status="ACTIVE"]{background:#e2f4eb;color:#1b7544}.status[data-status="PENDING"]{background:#fff4d9;color:#805b12}.status[data-status="SUSPENDED"],.status[data-status="ARCHIVED"]{background:#fce9e7;color:#9b352a}.actions{display:flex;gap:6px;flex-wrap:wrap}.actions button{border:0;background:none;color:#176f66;font-size:.75rem;font-weight:700;cursor:pointer}.actions .danger{color:#a33434}.empty{text-align:center;color:#69757a;padding:22px}.notice,.token-box{padding:10px 12px;margin:0 0 14px;font-size:.87rem}.error{background:#fff1ef;color:#9b352a}.success{background:#e9f5ed;color:#23613a}.token-box{background:#fff8e8;color:#694d10;overflow-wrap:anywhere}.token-box code{font-size:.8rem}@media(max-width:800px){.form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.heading{align-items:flex-start;flex-direction:column}.form-grid{grid-template-columns:1fr}.wide{grid-column:auto}.table-heading{align-items:flex-start;flex-direction:column}.search{max-width:none}}
    `,
  ],
})
export class MemberListComponent implements OnInit {
  members: Member[] = [];
  selectedMember: Member | null = null;
  selectedMemberIds = new Set<string>();
  churches: Church[] = [];
  campuses: Campus[] = [];
  visibleCampuses: Campus[] = [];
  formOpen = false;
  editingId: string | null = null;
  loading = false;
  saving = false;
  search = '';
  errorMessage = '';
  successMessage = '';
  invitationToken = '';
  openMenuId: string | null = null;
  detailMember: Member | null = null;
  pendingAction: { type: 'suspend' | 'archive'; member: Member } | null = null;
  canManage = false;
  churchSelectionFixed = false;
  defaultChurchId: string | null = null;
  statusFilter = 'ALL';
  churchFilter = 'ALL';
  campusFilter = 'ALL';
  pageIndex = 0;
  readonly pageSize = 10;
  memberTab: 'profile' | 'family' | 'activities' | 'history' = 'profile';
  familyCount = 0;
  familiesAvailable = false;
  form = this.fb.group({
    first_name: ['', Validators.required], last_name: ['', Validators.required], email: ['', [Validators.required, Validators.email]],
    phone: [''], gender: [''], date_of_birth: [''], church: ['', Validators.required], campus: [''], marital_status: [''], address: [''],
  });

  constructor(private fb: FormBuilder, private memberService: MemberService, private tenantService: TenantService, private authService: AuthService, private router: Router, private familyService: FamilyService) {}

  ngOnInit(): void {
    this.loading = true;
    forkJoin({ members: this.memberService.getMembers(), context: this.tenantService.churchContext(), user: this.authService.me() }).subscribe({
      next: ({ members, context, user }) => {
        this.members = members; this.selectedMember = members[0] ?? null; this.churches = context.churches; this.campuses = context.campuses; this.visibleCampuses = context.campuses;
        this.churchSelectionFixed = context.church_selection_fixed;
        this.defaultChurchId = context.default_church_id;
        const role = user.organizations.find((item) => item.tenant_id === user.active_organization?.tenant_id)?.role;
        this.canManage = role === 'owner' || role === 'admin';
        if (this.canManage) {
          this.familyService.listFamilies().subscribe({
            next: (families) => { this.familyCount = families.length; this.familiesAvailable = true; },
            error: (error) => this.errorMessage = this.describeError(error),
          });
        }
        this.applyPreferredSite();
        this.loading = false;
      },
      error: (error) => { this.errorMessage = this.describeError(error); this.loading = false; },
    });
  }

  get filteredMembers(): Member[] {
    const query = this.search.trim().toLocaleLowerCase();
    return this.members.filter((member) => {
      const matchesSearch = !query || `${member.first_name} ${member.last_name} ${member.email}`.toLocaleLowerCase().includes(query);
      const churchId = this.relationId(member.church);
      const campusId = this.relationId(member.campus);
      return matchesSearch
        && (this.statusFilter === 'ALL' || member.status === this.statusFilter)
        && (this.churchFilter === 'ALL' || churchId === this.churchFilter)
        && (this.campusFilter === 'ALL' || campusId === this.campusFilter);
    });
  }

  get pagedMembers(): Member[] { const start = this.pageIndex * this.pageSize; return this.filteredMembers.slice(start, start + this.pageSize); }
  get pageCount(): number { return Math.max(1, Math.ceil(this.filteredMembers.length / this.pageSize)); }
  get rangeStart(): number { return this.filteredMembers.length ? this.pageIndex * this.pageSize + 1 : 0; }
  get rangeEnd(): number { return Math.min((this.pageIndex + 1) * this.pageSize, this.filteredMembers.length); }
  get visiblePages(): number[] { return Array.from({ length: Math.min(this.pageCount, 5) }, (_, index) => index); }
  get allVisibleSelected(): boolean { return this.pagedMembers.length > 0 && this.pagedMembers.every((member) => this.selectedMemberIds.has(member.id)); }
  get filteredCampuses(): Campus[] { return this.churchFilter === 'ALL' ? this.campuses : this.campuses.filter((campus) => campus.church === this.churchFilter); }
  get newMembersThisMonth(): number { const now = new Date(); return this.members.filter((member) => { const date = member.member_since ? new Date(member.member_since) : null; return !!date && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear(); }).length; }
  get inactiveMembersCount(): number { return this.members.filter((member) => member.status === 'SUSPENDED' || member.status === 'ARCHIVED').length; }

  countByStatus(status: string): number { return this.members.filter((member) => member.status === status).length; }
  filterStatus(event: Event): void { this.statusFilter = (event.target as HTMLSelectElement).value; this.resetPageAndSelection(); }
  setChurchFilter(event: Event): void { this.churchFilter = (event.target as HTMLSelectElement).value; this.campusFilter = 'ALL'; this.resetPageAndSelection(); }
  setCampusFilter(event: Event): void { this.campusFilter = (event.target as HTMLSelectElement).value; this.resetPageAndSelection(); }
  resetFilters(): void { this.statusFilter = 'ALL'; this.churchFilter = 'ALL'; this.campusFilter = 'ALL'; this.search = ''; this.resetPageAndSelection(); }
  changePage(delta: number): void { this.pageIndex = Math.max(0, Math.min(this.pageCount - 1, this.pageIndex + delta)); }
  goToPage(page: number): void { this.pageIndex = Math.max(0, Math.min(this.pageCount - 1, page)); }
  toggleVisibleSelection(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const ids = this.pagedMembers.map((member) => member.id);
    this.selectedMemberIds = new Set([...this.selectedMemberIds].filter((id) => !ids.includes(id)));
    if (checked) ids.forEach((id) => this.selectedMemberIds.add(id));
  }
  toggleMemberSelection(id: string, event: Event): void {
    const selected = new Set(this.selectedMemberIds);
    if ((event.target as HTMLInputElement).checked) selected.add(id); else selected.delete(id);
    this.selectedMemberIds = selected;
  }

  onSearch(event: Event): void { this.search = (event.target as HTMLInputElement).value; this.resetPageAndSelection(); }
  selectMember(member: Member): void { this.selectedMember = member; this.memberTab = 'profile'; }
  initials(member: Member): string { return `${member.first_name?.[0] ?? ''}${member.last_name?.[0] ?? ''}`.toUpperCase(); }
  genderLabel(value?: string): string { return ({ M: 'Homme', F: 'Femme' } as Record<string, string>)[value ?? ''] ?? 'Non renseigné'; }
  maritalStatusLabel(value?: string): string { return ({ single: 'Célibataire', married: 'Marié(e)', divorced: 'Divorcé(e)', widowed: 'Veuf / Veuve' } as Record<string, string>)[value ?? ''] ?? 'Non renseignée'; }
  private resetPageAndSelection(): void { this.pageIndex = 0; this.keepSelectedMemberVisible(); }
  private keepSelectedMemberVisible(): void { if (!this.filteredMembers.some((member) => member.id === this.selectedMember?.id)) this.selectedMember = this.filteredMembers[0] ?? null; }
  openCreate(): void { this.resetForm(); this.applyPreferredSite(); this.formOpen = true; }
  closeForm(): void { this.formOpen = false; this.resetForm(); }
  filterCampuses(): void {
    const churchId = this.form.controls.church.value;
    this.visibleCampuses = this.campuses.filter((item) => item.church === churchId || !churchId);
    this.form.controls.campus.setValue('');
    if (churchId) localStorage.setItem('churchos_preferred_church', churchId);
    if (this.visibleCampuses.length === 1) this.form.controls.campus.setValue(this.visibleCampuses[0].campus_id);
  }

  rememberCampus(): void { const campusId = this.form.controls.campus.value; if (campusId) localStorage.setItem('churchos_preferred_campus', campusId); }
  churchName(value: Member['church']): string { const id = typeof value === 'string' ? value : value?.church_id; return this.churches.find((church) => church.church_id === id)?.name ?? (typeof value === 'object' && value ? value.name ?? '—' : '—'); }
  campusName(value: Member['campus']): string { const id = typeof value === 'string' ? value : value?.campus_id; return this.campuses.find((campus) => campus.campus_id === id)?.name ?? (typeof value === 'object' && value ? value.name ?? '—' : '—'); }

  toggleMenu(id: string, event: Event): void { event.stopPropagation(); this.openMenuId = this.openMenuId === id ? null : id; }
  viewDetails(member: Member): void { this.openMenuId = null; this.router.navigate(['/members', member.id]); }
  askSuspend(member: Member): void { this.openMenuId = null; this.pendingAction = { type: 'suspend', member }; }
  askArchive(member: Member): void { this.openMenuId = null; this.pendingAction = { type: 'archive', member }; }
  confirmAction(): void {
    if (!this.pendingAction) return;
    const { type, member } = this.pendingAction;
    const request = type === 'suspend' ? this.memberService.suspendMember(member.id) : this.memberService.archiveMember(member.id);
    request.subscribe({ next: () => { this.successMessage = type === 'suspend' ? 'Accès suspendus.' : 'Membre archivé.'; this.pendingAction = null; this.reload(); }, error: (error) => { this.errorMessage = this.describeError(error); this.pendingAction = null; } });
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const raw = this.form.getRawValue() as MemberCreateRequest;
    const payload: MemberCreateRequest = { ...raw, campus: raw.campus || null };
    this.saving = true; this.clearMessages();
    const request = this.editingId ? this.memberService.updateMember(this.editingId, payload) : this.memberService.createMember(payload);
    request.subscribe({
      next: (member) => {
        this.saving = false;
        this.successMessage = this.editingId ? 'Profil mis à jour.' : 'Membre créé. Une invitation a été générée.';
        this.invitationToken = (member as Member & { invitation_token?: string }).invitation_token ?? '';
        this.closeForm(); this.reload();
      },
      error: (error) => { this.errorMessage = this.describeError(error); this.saving = false; },
    });
  }

  edit(member: Member): void {
    this.openMenuId = null;
    this.editingId = member.id; this.formOpen = true;
    this.form.patchValue({ ...member, church: this.relationId(member.church), campus: this.relationId(member.campus) });
  }

  invite(member: Member): void {
    this.openMenuId = null;
    this.memberService.resendInvitation(member.id).subscribe({ next: (result) => { this.invitationToken = result.invitation_token; this.successMessage = 'Invitation régénérée. Transmettez le code à 5 chiffres au membre.'; }, error: (error) => this.errorMessage = this.describeError(error) });
  }

  relationName(value: Member['church'] | Member['campus']): string { return typeof value === 'string' ? value : value?.name ?? '—'; }
  private relationId(value: Member['church'] | Member['campus']): string { const relation = value as { church_id?: string; campus_id?: string } | string | null | undefined; return typeof relation === 'string' ? relation : relation?.church_id ?? relation?.campus_id ?? ''; }
  statusLabel(status?: string): string { return ({ ACTIVE: 'Actif', PENDING: 'Invitation en attente', SUSPENDED: 'Suspendu', ARCHIVED: 'Archivé' } as Record<string, string>)[status ?? ''] ?? status ?? 'Inconnu'; }
  trackById(_index: number, member: Member): string { return member.id; }

  reload(): void { this.memberService.getMembers().subscribe({ next: (items) => { this.members = items; this.selectedMember = items.find((member) => member.id === this.selectedMember?.id) ?? items[0] ?? null; }, error: (error) => this.errorMessage = this.describeError(error) }); }
  private resetForm(): void { this.editingId = null; this.form.reset({ first_name: '', last_name: '', email: '', phone: '', gender: '', date_of_birth: '', church: '', campus: '', marital_status: '', address: '' }); this.visibleCampuses = this.campuses; }
  private applyPreferredSite(): void {
    const storedChurchId = localStorage.getItem('churchos_preferred_church');
    const defaultChurch = this.churches.find((item) => item.church_id === this.defaultChurchId);
    const church = (this.churchSelectionFixed ? defaultChurch : null)
      ?? this.churches.find((item) => item.church_id === storedChurchId)
      ?? (this.churches.length === 1 ? this.churches[0] : null);
    if (!church) return;
    this.form.controls.church.setValue(church.church_id);
    this.visibleCampuses = this.campuses.filter((campus) => campus.church === church.church_id);
    const storedCampusId = localStorage.getItem('churchos_preferred_campus');
    const campus = this.visibleCampuses.find((item) => item.campus_id === storedCampusId) ?? (this.visibleCampuses.length === 1 ? this.visibleCampuses[0] : null);
    if (campus) this.form.controls.campus.setValue(campus.campus_id);
  }
  private clearMessages(): void { this.errorMessage = ''; this.successMessage = ''; this.invitationToken = ''; }
  private describeError(error: unknown): string {
    if (error instanceof HttpErrorResponse) { const body = error.error as Record<string, unknown> | string | null; if (typeof body === 'string') return body; if (body && typeof body === 'object') return Object.entries(body).map(([key, value]) => `${key} : ${Array.isArray(value) ? value.join(', ') : value}`).join(' · '); return `Erreur API (${error.status}).`; }
    return 'Une erreur inattendue est survenue.';
  }
}