import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { Campus, Church } from '../../../core/models/tenant';
import { Member, MemberCreateRequest } from '../../../core/models/member';
import { MemberService } from '../../../core/services/member.service';
import { TenantService } from '../../../core/services/tenant.service';
import { FamilyService } from '../../../core/services/family.service';
import { cropImageToSquare } from '../../../core/utils/crop-image';
import { ConfigurationService } from '../../../core/services/configuration.service';

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
          <label class="wide">Photo de profil<input type="file" accept="image/*" (change)="selectPhoto($event)" /><small>Recadrage carré automatique · JPEG, PNG ou WebP · 5 Mo maximum</small><img *ngIf="photoPreview" class="photo-preview" [src]="photoPreview" alt="Aperçu de la photo recadrée" /></label>
          <label *ngIf="!churchSelectionFixed">Église *<select formControlName="church" (change)="filterCampuses()"><option value="">Sélectionner</option><option *ngFor="let church of churches" [value]="church.church_id">{{ church.name }}</option></select></label>
          <label>Campus (facultatif)<select formControlName="campus" (change)="rememberCampus()"><option value="">Aucun campus</option><option *ngFor="let campus of visibleCampuses" [value]="campus.campus_id">{{ campus.name }}</option></select></label>
          <label>Situation matrimoniale<select formControlName="marital_status"><option value="">Non renseignée</option><option value="single">Célibataire</option><option value="married">Marié(e)</option><option value="divorced">Divorcé(e)</option><option value="widowed">Veuf/Veuve</option></select></label>
          <label>Nationalité<input formControlName="nationality" /></label><label>Profession<input formControlName="profession" /></label><label>Niveau d’étude<input formControlName="education_level" /></label>
          <label>Situation baptismale<select formControlName="baptism_status"><option value="UNKNOWN">Non renseignée</option><option value="NOT_BAPTIZED">Non baptisé(e)</option><option value="IN_PREPARATION">En préparation</option><option value="BAPTIZED">Baptisé(e)</option></select></label>
          <label>Date du baptême<input type="date" formControlName="baptism_date" /></label>
          <label>Contact d’urgence<input formControlName="emergency_contact_name" /></label><label>Téléphone d’urgence<input formControlName="emergency_contact_phone" /></label>
          <label *ngIf="editingId">Statut du membre<select formControlName="status"><option value="NEW">Nouveau membre</option><option value="ACTIVE">Membre actif</option><option value="INACTIVE">Membre inactif</option><option value="TRANSFERRED">Transféré</option><option value="DECEASED">Décédé</option><option value="PENDING">Invitation en attente</option><option value="SUSPENDED">Accès suspendu</option><option value="ARCHIVED">Archivé</option></select></label>
          <label class="wide">Lieu d’habitation<textarea formControlName="address"></textarea></label>
        </div>
        <div class="form-actions"><button class="primary" type="submit" [disabled]="form.invalid || saving || !churches.length">{{ saving ? 'Enregistrement…' : editingId ? 'Enregistrer les changements' : 'Créer le membre et générer une invitation' }}</button><button type="button" class="quiet" (click)="closeForm()">Annuler</button></div>
      </form></div>

      <div class="members-workspace"><section class="table-panel member-directory-table">
        <div class="member-filters"><label class="member-search"><span aria-hidden="true">⌕</span><input class="search" type="search" placeholder="Rechercher un membre..." aria-label="Rechercher un membre" [(value)]="search" (input)="onSearch($event)" /></label><select aria-label="Filtrer par statut" [value]="statusFilter" (change)="filterStatus($event)"><option value="ALL">Tous les statuts</option><option value="NEW">Nouveaux</option><option value="ACTIVE">Actifs</option><option value="INACTIVE">Inactifs</option><option value="TRANSFERRED">Transférés</option><option value="DECEASED">Décédés</option><option value="PENDING">Invitation en attente</option><option value="SUSPENDED">Accès suspendus</option><option value="ARCHIVED">Archivés</option></select><select aria-label="Filtrer par église" [value]="churchFilter" (change)="setChurchFilter($event)"><option value="ALL">Toutes les églises</option><option *ngFor="let church of churches" [value]="church.church_id">{{ church.name }}</option></select><select aria-label="Filtrer par campus" [value]="campusFilter" (change)="setCampusFilter($event)"><option value="ALL">Tous les campus</option><option *ngFor="let campus of filteredCampuses" [value]="campus.campus_id">{{ campus.name }}</option></select><button class="member-filter-button" type="button" (click)="resetFilters()">☷ Filtres</button></div>
        <div class="table-wrap" (scroll)="closeMenuOnScroll()">
          <table class="member-table">
            <thead>
              <tr>
                <th class="check-column"><input type="checkbox" aria-label="Sélectionner tous les membres affichés" [checked]="allVisibleSelected" (change)="toggleVisibleSelection($event)" /></th>
                <th class="number-column">N°</th>
                <th class="sortable" (click)="sortBy('name')"><span>Membre</span><span class="sort-chevrons" aria-hidden="true"><i [class.active]="sortField === 'name' && sortDirection === 'asc'">⌃</i><i [class.active]="sortField === 'name' && sortDirection === 'desc'">⌄</i></span></th>
                <th class="sortable" (click)="sortBy('email')"><span>Email</span><span class="sort-chevrons" aria-hidden="true"><i [class.active]="sortField === 'email' && sortDirection === 'asc'">⌃</i><i [class.active]="sortField === 'email' && sortDirection === 'desc'">⌄</i></span></th>
                <th class="sortable" (click)="sortBy('phone')"><span>Téléphone</span><span class="sort-chevrons" aria-hidden="true"><i [class.active]="sortField === 'phone' && sortDirection === 'asc'">⌃</i><i [class.active]="sortField === 'phone' && sortDirection === 'desc'">⌄</i></span></th>
                <th class="sortable" (click)="sortBy('church')"><span>Église</span><span class="sort-chevrons" aria-hidden="true"><i [class.active]="sortField === 'church' && sortDirection === 'asc'">⌃</i><i [class.active]="sortField === 'church' && sortDirection === 'desc'">⌄</i></span></th>
                <th>Campus</th>
                <th class="sortable" (click)="sortBy('status')"><span>Statut</span><span class="sort-chevrons" aria-hidden="true"><i [class.active]="sortField === 'status' && sortDirection === 'asc'">⌃</i><i [class.active]="sortField === 'status' && sortDirection === 'desc'">⌄</i></span></th>
                <th class="sortable" (click)="sortBy('member_since')"><span>Adhésion</span><span class="sort-chevrons" aria-hidden="true"><i [class.active]="sortField === 'member_since' && sortDirection === 'asc'">⌃</i><i [class.active]="sortField === 'member_since' && sortDirection === 'desc'">⌄</i></span></th>
                <th class="actions-column">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let member of pagedMembers; let i = index; trackBy: trackById" (click)="viewDetails(member)">
                <td class="check-column"><input type="checkbox" [attr.aria-label]="'Sélectionner ' + member.first_name + ' ' + member.last_name" [checked]="selectedMemberIds.has(member.id)" (click)="$event.stopPropagation()" (change)="toggleMemberSelection(member.id, $event)" /></td>
                <td class="number-column"><span class="member-number">#{{ rangeStart + i }}</span></td>
                <td><div class="member-name-cell"><strong>{{ member.first_name }} {{ member.last_name }}</strong></div></td>
                <td><a class="member-contact-link" [attr.href]="member.email ? 'mailto:' + member.email : null" (click)="$event.stopPropagation()">{{ member.email || '—' }}</a></td>
                <td>{{ member.phone || '—' }}</td>
                <td>{{ churchName(member.church) }}</td>
                <td>{{ campusName(member.campus) }}</td>
                <td><span class="member-status" [attr.data-status]="member.status">{{ member.status === 'ACTIVE' ? 'Actif' : statusLabel(member.status) }}</span></td>
                <td>{{ member.member_since ? (member.member_since | date:'dd-MM-yyyy') : '—' }}</td>
                <td class="actions-column">
                  <div class="context-wrap">
                    <button type="button" class="context-trigger" aria-label="Actions du membre" (click)="toggleMenu(member.id, $event)"><span></span><span></span><span></span></button>
                    <div class="context-menu" *ngIf="openMenuId === member.id" [style.top.px]="menuPosition.top" [style.left.px]="menuPosition.left" (click)="$event.stopPropagation()">
                      <button type="button" (click)="viewDetails(member)">Voir la fiche complète</button>
                      <button type="button" *ngIf="canManage" (click)="edit(member)">Modifier</button>
                      <button type="button" *ngIf="canManage && member.status === 'PENDING'" (click)="invite(member)">Renvoyer l’invitation</button>
                      <button type="button" *ngIf="canManage && member.status === 'ACTIVE'" (click)="askSuspend(member)">Suspendre les accès</button>
                      <button type="button" *ngIf="canManage && member.status !== 'ARCHIVED'" class="danger" (click)="askArchive(member)">Archiver</button>
                      <button type="button" *ngIf="member.email" (click)="copyToClipboard(member.email, 'email')">Copier l’email</button>
                      <button type="button" *ngIf="member.phone" (click)="copyToClipboard(member.phone, 'téléphone')">Copier le téléphone</button>
                    </div>
                  </div>
                </td>
              </tr>
              <tr *ngIf="!pagedMembers.length"><td colspan="10" class="empty">{{ loading ? 'Chargement…' : members.length ? 'Aucun résultat.' : 'Aucun membre dans cette organisation.' }}</td></tr>
            </tbody>
          </table>
        </div>
        <footer class="member-table-footer"><span>Affichage de {{ rangeStart }} à {{ rangeEnd }} sur {{ filteredMembers.length }} membres</span><div class="member-pagination"><button type="button" aria-label="Page précédente" [disabled]="pageIndex === 0" (click)="changePage(-1)">‹</button><button *ngFor="let page of visiblePages" type="button" [class.current-page]="page === pageIndex" (click)="goToPage(page)">{{ page + 1 }}</button><span *ngIf="pageCount > 5">…</span><button *ngIf="pageCount > 5" type="button" [class.current-page]="pageIndex === pageCount - 1" (click)="goToPage(pageCount - 1)">{{ pageCount }}</button><button type="button" aria-label="Page suivante" [disabled]="pageIndex + 1 >= pageCount" (click)="changePage(1)">›</button></div></footer>
      </section>
      <aside class="member-preview" *ngIf="selectedMember as member"><div class="member-preview-heading"><div class="member-preview-cover"></div><button type="button" class="member-preview-menu" aria-label="Actions du membre" (click)="toggleMenu(member.id, $event)">···</button></div><div class="member-preview-summary"><span class="member-preview-avatar">{{ initials(member) }}</span><div><h2>{{ member.first_name }} {{ member.last_name }}</h2><span class="member-status" [attr.data-status]="member.status">{{ member.status === 'ACTIVE' ? 'Membre actif' : statusLabel(member.status) }}</span><small>Membre depuis {{ member.member_since | date:'d MMM, y' }}</small></div></div><nav class="member-preview-tabs" aria-label="Informations du membre"><button type="button" [class.active]="memberTab === 'profile'" (click)="memberTab = 'profile'">Profil</button><button type="button" [class.active]="memberTab === 'family'" (click)="memberTab = 'family'">Famille</button><button type="button" [class.active]="memberTab === 'activities'" (click)="memberTab = 'activities'">Activités</button><button type="button" [class.active]="memberTab === 'history'" (click)="memberTab = 'history'">Historique</button></nav>
        <div class="member-preview-content" *ngIf="memberTab === 'profile'"><h3>Informations personnelles</h3><div class="member-preview-row"><span>☎</span><div><small>Téléphone</small><strong>{{ member.phone || 'Non renseigné' }}</strong></div></div><div class="member-preview-row"><span>✉</span><div><small>Email</small><strong>{{ member.email || 'Non renseigné' }}</strong></div></div><div class="member-preview-row"><span>▦</span><div><small>Date de naissance</small><strong>{{ member.date_of_birth ? (member.date_of_birth | date:'d MMMM y') : 'Non renseignée' }}</strong></div></div><div class="member-preview-row"><span>♙</span><div><small>Genre</small><strong>{{ genderLabel(member.gender) }}</strong></div></div><div class="member-preview-row"><span>⌖</span><div><small>Adresse</small><strong>{{ member.address || 'Non renseignée' }}</strong></div></div><div class="member-preview-row"><span>▣</span><div><small>Église / campus</small><strong>{{ churchName(member.church) }}<ng-container *ngIf="campusName(member.campus) !== '—'"> · {{ campusName(member.campus) }}</ng-container></strong></div></div><h3 class="member-preview-section-heading">Situation familiale</h3><div class="member-preview-row"><span>♥</span><div><small>État civil</small><strong>{{ maritalStatusLabel(member.marital_status) }}</strong></div></div></div>
        <div class="member-preview-content" *ngIf="memberTab === 'family'"><h3>Informations familiales</h3><div class="member-preview-row"><span>♥</span><div><small>Situation matrimoniale</small><strong>{{ maritalStatusLabel(member.marital_status) }}</strong></div></div><div class="member-preview-row"><span>⌖</span><div><small>Adresse du membre</small><strong>{{ member.address || 'Non renseignée' }}</strong></div></div><p class="member-preview-empty">Les liens avec une famille et les autres membres du foyer se consultent dans le répertoire Familles.</p><a class="member-preview-link" routerLink="/families">Ouvrir le répertoire Familles</a></div>
        <div class="member-preview-content empty-preview" *ngIf="memberTab === 'activities'"><h3>Activités</h3><p>Aucune activité récente n’est disponible dans ce dossier.</p></div>
        <div class="member-preview-content" *ngIf="memberTab === 'history'"><h3>Historique du profil</h3><div class="member-preview-row"><span>＋</span><div><small>Inscription comme membre</small><strong>{{ member.member_since ? (member.member_since | date:'d MMMM y') : 'Date non renseignée' }}</strong></div></div><div class="member-preview-row"><span>◷</span><div><small>Dernière mise à jour</small><strong>{{ member.updated_at ? (member.updated_at | date:'d MMMM y') : 'Aucun historique disponible' }}</strong></div></div></div>
        <div class="member-preview-actions"><button type="button" class="open-member-detail-button" (click)="viewDetails(member)">Voir la fiche complète</button><button type="button" class="edit-member-button" *ngIf="canManage" (click)="edit(member)">✎ Modifier</button><button type="button" class="disable-member-button" *ngIf="canManage && member.status === 'ACTIVE'" (click)="askSuspend(member)">⊘ Désactiver</button><button type="button" class="disable-member-button" *ngIf="canManage && member.status === 'PENDING'" (click)="invite(member)">Renvoyer l’invitation</button></div>
      </aside>
      </div>
      <div class="modal-backdrop" *ngIf="detailMember" (click)="detailMember = null"><section class="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="member-detail-title" (click)="$event.stopPropagation()"><div class="editor-heading"><h2 id="member-detail-title">{{ detailMember.first_name }} {{ detailMember.last_name }}</h2><button type="button" class="icon-close" aria-label="Fermer" (click)="detailMember = null">×</button></div><dl class="detail-grid"><dt>Email</dt><dd>{{ detailMember.email }}</dd><dt>Téléphone</dt><dd>{{ detailMember.phone || '—' }}</dd><dt>Statut</dt><dd>{{ statusLabel(detailMember.status) }}</dd><dt>Église</dt><dd>{{ churchName(detailMember.church) }}</dd><dt>Campus</dt><dd>{{ campusName(detailMember.campus) }}</dd><dt>Adresse</dt><dd>{{ detailMember.address || '—' }}</dd></dl></section></div>
      <div class="modal-backdrop" *ngIf="pendingAction" (click)="pendingAction = null"><section class="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" (click)="$event.stopPropagation()"><span class="warning-mark">!</span><h2 id="confirm-title">{{ pendingAction.type === 'suspend' ? 'Suspendre les accès ?' : 'Archiver ce membre ?' }}</h2><p>{{ pendingAction.type === 'suspend' ? 'Le membre ne pourra plus se connecter jusqu’à réactivation.' : 'Ce profil sera archivé et son compte désactivé.' }} <strong>{{ pendingAction.member.first_name }} {{ pendingAction.member.last_name }}</strong></p><div class="form-actions"><button type="button" class="danger-solid" (click)="confirmAction()">Confirmer</button><button type="button" class="quiet" (click)="pendingAction = null">Annuler</button></div></section></div>
    </section>
  `,
  styles: [`
    :host{display:block;color:#1B2A24}.page{max-width:1320px;margin:0 auto}.heading,.table-heading,.editor-heading{display:flex;justify-content:space-between;align-items:center;gap:16px}.heading{margin-bottom:20px}.eyebrow{margin:0 0 7px;color:#2A8768;font-size:.72rem;font-weight:800}.heading h1{margin:0;font-size:1.8rem}.heading p:not(.eyebrow){margin:5px 0 0;color:#7A8A84}.primary,.quiet{min-height:38px;padding:9px 13px;border:1px solid #2A8768;background:#2A8768;color:#fff;font-weight:700;cursor:pointer}.quiet{border-color:#E3EAE6;background:#fff;color:#2A3B35}.primary:disabled{opacity:.55;cursor:not-allowed}.editor,.table-panel{margin-bottom:18px;border:1px solid #E3EAE6;background:#fff;padding:18px}.editor-heading h2,.table-heading h2{margin:0;font-size:1rem}.icon-close{border:0;background:none;font-size:1.5rem;cursor:pointer}.form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:16px 0}.form-grid label{display:grid;gap:6px;color:#7A8A84;font-size:.8rem;font-weight:700}.form-grid input,.form-grid select,.form-grid textarea,.search{width:100%;min-height:38px;padding:8px 10px;border:1px solid #E3EAE6;background:white;color:#1B2A24;font:inherit}.form-grid textarea{min-height:70px}.form-grid .photo-preview{width:88px;height:88px;border-radius:50%;object-fit:cover}.wide{grid-column:1/-1}.form-actions{display:flex;gap:8px}.table-heading{margin-bottom:14px}.search{max-width:280px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:920px}th,td{padding:12px 10px;border-top:1px solid #E3EAE6;text-align:left;vertical-align:top}th{color:#7A8A84;font-size:.7rem;text-transform:uppercase}td{font-size:.85rem}td small{display:block;margin-top:4px;color:#7A8A84;font-size:.76rem}.status{display:inline-block;padding:5px 8px;background:#F2F5F3;font-size:.7rem;font-weight:800}.status[data-status="ACTIVE"]{background:#f0fdf4;color:#16a34a}.status[data-status="PENDING"]{background:#fff4d9;color:#805b12}.status[data-status="SUSPENDED"],.status[data-status="ARCHIVED"]{background:#fce9e7;color:#dc2626}.actions{display:flex;gap:6px;flex-wrap:wrap}.actions button{border:0;background:none;color:#176f66;font-size:.75rem;font-weight:700;cursor:pointer}.actions .danger{color:#dc2626}.empty{text-align:center;color:#7A8A84;padding:22px}.notice,.token-box{padding:10px 12px;margin:0 0 14px;font-size:.87rem}.error{background:#fff1ef;color:#dc2626}.success{background:#f0fdf4;color:#23613a}.token-box{background:#fff8e8;color:#694d10;overflow-wrap:anywhere}.token-box code{font-size:.8rem}@media(max-width:800px){.form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.heading{align-items:flex-start;flex-direction:column}.form-grid{grid-template-columns:1fr}.wide{grid-column:auto}.table-heading{align-items:flex-start;flex-direction:column}.search{max-width:none}}
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
  menuPosition = { top: 0, left: 0 };
  sortField: 'name' | 'email' | 'phone' | 'church' | 'status' | 'member_since' = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';
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
    nationality: [''], profession: [''], education_level: [''], baptism_status: ['UNKNOWN'], baptism_date: [''],
    emergency_contact_name: [''], emergency_contact_phone: [''], status: ['PENDING'],
  });
  photoUpload: File | null = null;
  photoPreview: string | null = null;

  constructor(private fb: FormBuilder, private memberService: MemberService, private tenantService: TenantService, private authService: AuthService, private router: Router, private route: ActivatedRoute, private familyService: FamilyService, private configurationService: ConfigurationService) {}

  ngOnInit(): void {
    this.loading = true;
    forkJoin({ members: this.memberService.getMembers(), context: this.tenantService.churchContext(), user: this.authService.me(), access: this.configurationService.getAccess() }).subscribe({
      next: ({ members, context, user, access }) => {
        this.members = members; this.selectedMember = members[0] ?? null; this.churches = context.churches; this.campuses = context.campuses; this.visibleCampuses = context.campuses;
        this.churchSelectionFixed = context.church_selection_fixed;
        this.defaultChurchId = context.default_church_id;
        const role = user.organizations.find((item) => item.tenant_id === user.active_organization?.tenant_id)?.role;
        this.canManage = role === 'owner' || role === 'admin' || access.permission_codes.includes('members.update');
        const memberToEdit = this.route.snapshot.queryParamMap.get('edit');
        if (memberToEdit && this.canManage) {
          const member = members.find((item) => item.id === memberToEdit);
          if (member) {
            this.edit(member);
            this.router.navigate([], { relativeTo: this.route, queryParams: { edit: null }, queryParamsHandling: 'merge', replaceUrl: true });
          }
        }
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
    const filtered = this.members.filter((member) => {
      const matchesSearch = !query || `${member.first_name} ${member.last_name} ${member.email}`.toLocaleLowerCase().includes(query);
      const churchId = this.relationId(member.church);
      const campusId = this.relationId(member.campus);
      return matchesSearch
        && (this.statusFilter === 'ALL' || member.status === this.statusFilter)
        && (this.churchFilter === 'ALL' || churchId === this.churchFilter)
        && (this.campusFilter === 'ALL' || campusId === this.campusFilter);
    });
    const direction = this.sortDirection === 'asc' ? 1 : -1;
    return filtered.sort((a, b) => this.sortValue(a).localeCompare(this.sortValue(b), 'fr', { sensitivity: 'base' }) * direction);
  }

  private sortValue(member: Member): string {
    switch (this.sortField) {
      case 'email': return member.email ?? '';
      case 'phone': return member.phone ?? '';
      case 'church': return this.churchName(member.church);
      case 'status': return this.statusLabel(member.status);
      case 'member_since': return member.member_since ?? '';
      default: return `${member.last_name ?? ''} ${member.first_name ?? ''}`;
    }
  }

  get pagedMembers(): Member[] { const start = this.pageIndex * this.pageSize; return this.filteredMembers.slice(start, start + this.pageSize); }
  get pageCount(): number { return Math.max(1, Math.ceil(this.filteredMembers.length / this.pageSize)); }
  get rangeStart(): number { return this.filteredMembers.length ? this.pageIndex * this.pageSize + 1 : 0; }
  get rangeEnd(): number { return Math.min((this.pageIndex + 1) * this.pageSize, this.filteredMembers.length); }
  get visiblePages(): number[] { return Array.from({ length: Math.min(this.pageCount, 5) }, (_, index) => index); }
  get allVisibleSelected(): boolean { return this.pagedMembers.length > 0 && this.pagedMembers.every((member) => this.selectedMemberIds.has(member.id)); }
  get filteredCampuses(): Campus[] { return this.churchFilter === 'ALL' ? this.campuses : this.campuses.filter((campus) => campus.church === this.churchFilter); }
  get newMembersThisMonth(): number { const now = new Date(); return this.members.filter((member) => { const date = member.member_since ? new Date(member.member_since) : null; return !!date && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear(); }).length; }
  get inactiveMembersCount(): number { return this.members.filter((member) => ['INACTIVE', 'TRANSFERRED', 'DECEASED', 'SUSPENDED', 'ARCHIVED'].includes(member.status ?? '')).length; }

  countByStatus(status: string): number { return this.members.filter((member) => member.status === status).length; }
  filterStatus(event: Event): void { this.statusFilter = (event.target as HTMLSelectElement).value; this.resetPageAndSelection(); }
  setChurchFilter(event: Event): void { this.churchFilter = (event.target as HTMLSelectElement).value; this.campusFilter = 'ALL'; this.resetPageAndSelection(); }
  setCampusFilter(event: Event): void { this.campusFilter = (event.target as HTMLSelectElement).value; this.resetPageAndSelection(); }
  resetFilters(): void { this.statusFilter = 'ALL'; this.churchFilter = 'ALL'; this.campusFilter = 'ALL'; this.search = ''; this.resetPageAndSelection(); }
  sortBy(field: 'name' | 'email' | 'phone' | 'church' | 'status' | 'member_since'): void {
    if (this.sortField === field) this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    else { this.sortField = field; this.sortDirection = 'asc'; }
    this.pageIndex = 0;
  }
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

  toggleMenu(id: string, event: Event): void {
    event.stopPropagation();
    if (this.openMenuId === id) { this.openMenuId = null; return; }
    const trigger = event.currentTarget as HTMLElement;
    const rect = trigger.getBoundingClientRect();
    const width = 232;
    const estimatedHeight = 300;
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    const top = rect.bottom + 6 + estimatedHeight > window.innerHeight
      ? Math.max(8, rect.top - estimatedHeight - 6)
      : rect.bottom + 6;
    this.menuPosition = { top, left };
    this.openMenuId = id;
  }

  @HostListener('window:scroll')
  closeMenuOnScroll(): void { this.openMenuId = null; }

  @HostListener('window:resize')
  closeMenuOnResize(): void { this.openMenuId = null; }

  @HostListener('document:click', ['$event'])
  closeMenuOnDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.context-wrap')) this.openMenuId = null;
  }

  copyToClipboard(value: string | undefined, label: 'email' | 'téléphone'): void {
    this.openMenuId = null;
    if (!value) { this.errorMessage = `Aucun ${label} renseigné.`; return; }
    const success = () => {
      this.errorMessage = '';
      this.successMessage = `${label === 'email' ? 'Email' : 'Téléphone'} copié.`;
    };
    const failure = () => {
      this.successMessage = '';
      this.errorMessage = `Impossible de copier ${label === 'email' ? 'l’email' : 'le téléphone'}.`;
    };
    if (!navigator.clipboard) {
      this.copyWithFallback(value, success, failure);
      return;
    }
    navigator.clipboard.writeText(value).then(success).catch(() => this.copyWithFallback(value, success, failure));
  }

  private copyWithFallback(value: string, success: () => void, failure: () => void): void {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      if (document.execCommand('copy')) success(); else failure();
    } catch {
      failure();
    } finally {
      document.body.removeChild(textarea);
    }
  }

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
    const payload: MemberCreateRequest = { ...raw, campus: raw.campus || null, photo_upload: this.photoUpload ?? undefined };
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
    const churchId = this.relationId(member.church);
    this.visibleCampuses = this.campuses.filter((campus) => campus.church === churchId);
  }

  selectPhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { this.errorMessage = 'Sélectionnez un fichier image.'; input.value = ''; return; }
    if (file.size > 5 * 1024 * 1024) { this.errorMessage = 'La photo ne peut pas dépasser 5 Mo.'; input.value = ''; return; }
    cropImageToSquare(file).then((cropped) => { this.photoUpload = cropped; if (this.photoPreview) URL.revokeObjectURL(this.photoPreview); this.photoPreview = URL.createObjectURL(cropped); this.errorMessage = ''; })
      .catch((error: unknown) => { this.errorMessage = error instanceof Error ? error.message : 'Impossible de préparer cette photo.'; });
  }

  invite(member: Member): void {
    this.openMenuId = null;
    this.memberService.resendInvitation(member.id).subscribe({ next: (result) => { this.invitationToken = result.invitation_token; this.successMessage = 'Invitation régénérée. Transmettez le code à 5 chiffres au membre.'; }, error: (error) => this.errorMessage = this.describeError(error) });
  }

  relationName(value: Member['church'] | Member['campus']): string { return typeof value === 'string' ? value : value?.name ?? '—'; }
  private relationId(value: Member['church'] | Member['campus']): string { const relation = value as { church_id?: string; campus_id?: string } | string | null | undefined; return typeof relation === 'string' ? relation : relation?.church_id ?? relation?.campus_id ?? ''; }
  statusLabel(status?: string): string { return ({ NEW: 'Nouveau membre', ACTIVE: 'Membre actif', INACTIVE: 'Membre inactif', TRANSFERRED: 'Transféré', DECEASED: 'Décédé', PENDING: 'Invitation en attente', SUSPENDED: 'Accès suspendu', ARCHIVED: 'Archivé' } as Record<string, string>)[status ?? ''] ?? status ?? 'Inconnu'; }
  trackById(_index: number, member: Member): string { return member.id; }

  reload(): void { this.memberService.getMembers().subscribe({ next: (items) => { this.members = items; this.selectedMember = items.find((member) => member.id === this.selectedMember?.id) ?? items[0] ?? null; }, error: (error) => this.errorMessage = this.describeError(error) }); }
  private resetForm(): void { this.editingId = null; this.photoUpload = null; if (this.photoPreview) URL.revokeObjectURL(this.photoPreview); this.photoPreview = null; this.form.reset({ first_name: '', last_name: '', email: '', phone: '', gender: '', date_of_birth: '', church: '', campus: '', marital_status: '', address: '', nationality: '', profession: '', education_level: '', baptism_status: 'UNKNOWN', baptism_date: '', emergency_contact_name: '', emergency_contact_phone: '', status: 'PENDING' }); this.visibleCampuses = this.campuses; }
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