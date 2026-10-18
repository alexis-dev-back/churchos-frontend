import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Family, FamilyCreateRequest, FamilyMemberRecord, FamilyMemberRequest } from '../../../core/models/family';
import { Person } from '../../../core/models/person';
import { Member } from '../../../core/models/member';
import { FamilyService } from '../../../core/services/family.service';
import { PersonService } from '../../../core/services/person.service';
import { MemberService } from '../../../core/services/member.service';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-family-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="page">
      <div class="family-workspace">
        <div class="family-main">
      <nav class="family-breadcrumb"><a routerLink="/dashboard">Accueil</a><span>›</span><strong>Familles</strong></nav>
      <header class="family-heading">
        <div class="family-title"><span class="family-title-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-1a3.5 3.5 0 1 0-2.6-5.8 5.5 5.5 0 0 1 0 7.6c.7.1 1.8.1 2.6.1ZM9 13c-4 0-7 2-7 4.5V21h14v-3.5C16 15 13 13 9 13Zm7.5.3c1.6.9 2.5 2.2 2.5 4V21h3v-3.5c0-2.2-2.2-3.8-5.5-4.2Z"/></svg></span><div><h1>Familles</h1><p>Gérez les familles de votre église et suivez leur parcours spirituel.</p></div></div>
        <div class="family-heading-actions"><button class="primary" type="button" (click)="openCreate()">＋ Ajouter une famille</button><button class="outline-action" type="button" disabled title="Import bientôt disponible">⇧ Importer</button><button class="outline-action icon-action" type="button" aria-label="Actualiser" (click)="loadFamilies()">···</button></div>
      </header>
      <p *ngIf="errorMessage" class="notice error" role="alert">{{ errorMessage }}</p><p *ngIf="successMessage" class="notice success" role="status">{{ successMessage }}</p>

      <div class="modal-backdrop" *ngIf="formOpen" (click)="closeForm()"><form class="editor modal" [formGroup]="form" (ngSubmit)="save()" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="family-form-title">
        <div class="editor-heading"><h2 id="family-form-title">{{ editingId ? 'Modifier la famille' : 'Créer une famille' }}</h2><button type="button" aria-label="Fermer" (click)="closeForm()">×</button></div>
        <div class="form-grid"><label>Nom de la famille *<input formControlName="name" /></label><label>Téléphone<input formControlName="phone" /></label><label>Email<input type="email" formControlName="email" /></label><label>Quartier<input formControlName="neighborhood" /></label><label>Ministère<input formControlName="ministry" /></label><label>Statut<select formControlName="status"><option value="ACTIVE">Active</option><option value="FOLLOW_UP">En suivi</option><option value="INACTIVE">Inactive</option><option value="ARCHIVED">Archivée</option></select></label><label class="wide">Adresse<textarea formControlName="address"></textarea></label><label class="wide">Notes<textarea formControlName="notes"></textarea></label></div>
        <div class="actions"><button class="primary" type="submit" [disabled]="form.invalid || saving">{{ saving ? 'Enregistrement…' : editingId ? 'Enregistrer' : 'Créer' }}</button><button class="quiet" type="button" (click)="closeForm()">Annuler</button></div>
      </form></div>

      <div class="family-stats">
        <article><span class="stat-icon blue">♟</span><div><span>Total des familles</span><strong>{{ families.length }}</strong><small>Familles enregistrées</small></div></article>
        <article><span class="stat-icon green">♟</span><div><span>Familles actives</span><strong>{{ activeFamilyCount }}</strong><small>Statut actif</small></div></article>
        <article><span class="stat-icon purple">♙</span><div><span>Nouvelles familles</span><strong>{{ newFamilyCount }}</strong><small>Enregistrées ce mois</small></div></article>
        <article><span class="stat-icon orange">◉</span><div><span>Familles en suivi pastoral</span><strong>{{ followUpFamilyCount }}</strong><small>À accompagner</small></div></article>
      </div>
        <section class="families family-table">
          <div class="filters">
            <label class="search">⌕ <input aria-label="Rechercher une famille" placeholder="Rechercher une famille..." [value]="searchTerm" (input)="setSearch($event)" /></label>
            <select aria-label="Filtrer par statut" [value]="statusFilter" (change)="setStatus($event)"><option value="">Tous les statuts</option><option value="ACTIVE">Actives</option><option value="FOLLOW_UP">En suivi</option><option value="INACTIVE">Inactives</option><option value="ARCHIVED">Archivées</option></select>
            <select aria-label="Filtrer par ministère" [value]="ministryFilter" (change)="setMinistry($event)"><option value="">Tous les ministères</option><option *ngFor="let ministry of ministries" [value]="ministry">{{ ministry }}</option></select>
            <select aria-label="Filtrer par quartier" [value]="neighborhoodFilter" (change)="setNeighborhood($event)"><option value="">Tous les quartiers</option><option *ngFor="let neighborhood of neighborhoods" [value]="neighborhood">{{ neighborhood }}</option></select>
            <button type="button" class="filter-button" (click)="resetFilters()">☷ Filtres</button>
          </div>
          <div class="table-wrap"><table><thead><tr><th><input type="checkbox" aria-label="Sélectionner toutes les familles visibles" [checked]="allVisibleSelected" (change)="toggleVisibleFamilies($event)" /></th><th>Nom de la famille</th><th>Chef de famille</th><th>Téléphone</th><th>Quartier</th><th>Statut</th><th>Actions</th></tr></thead><tbody>
            <tr *ngFor="let family of pagedFamilies; trackBy: trackById" (click)="selectFamily(family)" [class.selected-row]="activeFamily?.id === family.id">
              <td><input type="checkbox" [attr.aria-label]="'Sélectionner ' + family.name" [checked]="selectedFamilyIds.has(family.id)" (click)="$event.stopPropagation()" (change)="toggleFamilySelection(family.id, $event)" /></td>
              <td><button type="button" class="family-link" (click)="$event.stopPropagation(); selectFamily(family)"><span class="family-avatars"><span class="family-avatar">{{ initials(family.primary_contact_name) }}</span><span class="family-avatar second" *ngIf="(family.member_count || 0) > 1">{{ family.member_count }}</span></span><span><strong>{{ family.name }}</strong><small>{{ family.member_count || 0 }} membre(s)</small></span></button></td>
              <td>{{ family.primary_contact_name || 'Non renseigné' }}</td><td>{{ family.primary_contact_phone || family.phone || '—' }}</td><td>{{ family.neighborhood || '—' }}</td>
              <td><span class="status-pill" [attr.data-status]="family.status">{{ statusLabel(family.status) }}</span></td>
              <td><div class="context-wrap"><button type="button" class="context-trigger" aria-label="Actions famille" (click)="toggleMenu(family.id, $event)">···</button><div class="context-menu" *ngIf="openMenuId === family.id"><button type="button" (click)="viewDetails(family)">Voir détail</button><button type="button" (click)="edit(family)">Modifier</button><button type="button" (click)="openAddMember(family)">Ajouter un membre / une personne</button></div></div></td>
            </tr>
            <tr *ngFor="let placeholder of placeholderRows" class="placeholder-row" aria-hidden="true"><td colspan="7"></td></tr>
            <tr *ngIf="!pagedFamilies.length"><td colspan="7" class="empty">{{ loading ? 'Chargement…' : 'Aucune famille ne correspond à votre recherche.' }}</td></tr>
          </tbody></table></div>
          <div class="pagination" *ngIf="filteredFamilies.length"><span>Affichage de {{ rangeStart }} à {{ rangeEnd }} sur {{ filteredFamilies.length }} familles</span><div><button type="button" aria-label="Page précédente" [disabled]="pageIndex === 0" (click)="changePage(-1)">‹</button><button *ngFor="let page of visiblePages" type="button" [class.current-page]="page === pageIndex" (click)="goToPage(page)">{{ page + 1 }}</button><span class="page-ellipsis" *ngIf="pageCount > 5">…</span><button *ngIf="pageCount > 5" type="button" [class.current-page]="pageIndex === pageCount - 1" (click)="goToPage(pageCount - 1)">{{ pageCount }}</button><button type="button" aria-label="Page suivante" [disabled]="pageIndex + 1 >= pageCount" (click)="changePage(1)">›</button></div></div>
        </section>
        </div>
        <aside class="family-panel" *ngIf="activeFamily">
          <div class="family-cover"><span class="status-pill" [attr.data-status]="activeFamily.status">{{ statusLabel(activeFamily.status) }}</span><button type="button" aria-label="Actions de la famille" (click)="toggleMenu(activeFamily.id, $event)">···</button></div>
          <div class="family-summary"><div class="family-portrait-stack"><span class="family-portrait" *ngFor="let person of familyPortraits">{{ initials(person.member_name || person.person_name) }}</span><span class="family-portrait" *ngIf="!familyMembers.length">{{ initials(activeFamily.primary_contact_name) }}</span></div><div><h2>{{ activeFamily.name }}</h2><span class="member-count">♟ {{ activeFamily.member_count || 0 }} membre(s)</span><p>Une famille unie, une bénédiction pour l’église.</p></div></div>
          <nav class="panel-tabs"><button *ngFor="let tab of panelTabs" type="button" [class.active]="activePanelTab === tab" (click)="activePanelTab = tab">{{ tab }}</button></nav>
          <div class="panel-content" *ngIf="activePanelTab === 'Informations'">
            <h3>Informations générales</h3>
            <div class="info-row"><span>♙</span><div><small>Chef de famille</small><strong>{{ activeFamily.primary_contact_name || 'Non renseigné' }}</strong></div></div>
            <div class="info-row"><span>♧</span><div><small>Téléphone</small><strong>{{ activeFamily.primary_contact_phone || activeFamily.phone || '—' }}</strong></div></div>
            <div class="info-row"><span>✉</span><div><small>Email</small><strong>{{ activeFamily.email || '—' }}</strong></div></div>
            <div class="info-row"><span>⌖</span><div><small>Quartier</small><strong>{{ activeFamily.neighborhood || '—' }}</strong></div></div>
            <div class="info-row"><span>♟</span><div><small>Ministère</small><strong>{{ activeFamily.ministry || '—' }}</strong></div></div>
            <div class="info-row"><span>◷</span><div><small>Date d’enregistrement</small><strong>{{ activeFamily.created_at | date:'d MMMM yyyy' }}</strong></div></div>
            <div class="info-row"><span>◉</span><div><small>Statut</small><strong><span class="status-pill" [attr.data-status]="activeFamily.status">{{ statusLabel(activeFamily.status) }}</span></strong></div></div>
            <h3 class="roster-heading">Membres de la famille ({{ familyMembers.length }})</h3>
            <article class="roster-item" *ngFor="let item of familyMembers"><span class="avatar">{{ initials(item.member_name || item.person_name) }}</span><div><strong>{{ item.member_name || item.person_name }}</strong><small>{{ relationshipLabel(item.relationship_type) }}</small></div><span class="roster-arrow">›</span></article>
          </div>
          <div class="panel-content" *ngIf="activePanelTab === 'Membres'">
            <p class="panel-loading" *ngIf="loadingFamilyMembers">Chargement des membres…</p>
            <article class="roster-item" *ngFor="let item of familyMembers"><span class="avatar">{{ (item.member_name || item.person_name || '?').charAt(0) }}</span><div><strong>{{ item.member_name || item.person_name }}</strong><small>{{ relationshipLabel(item.relationship_type) }}<span *ngIf="item.is_primary_contact"> · Contact principal</span></small><small>{{ item.phone || item.email || 'Coordonnées non renseignées' }}</small></div></article>
            <p class="panel-empty" *ngIf="!loadingFamilyMembers && !familyMembers.length">Aucun membre n’est encore rattaché à cette famille.</p>
          </div>
          <div class="panel-content" *ngIf="activePanelTab === 'Historique'"><div class="history-item"><strong>Famille créée</strong><span>{{ activeFamily.created_at ? (activeFamily.created_at | date:'dd/MM/yyyy') : 'Date indisponible' }}</span></div><div class="history-item"><strong>Dernière mise à jour</strong><span>{{ activeFamily.updated_at ? (activeFamily.updated_at | date:'dd/MM/yyyy') : 'Date indisponible' }}</span></div></div>
          <div class="panel-content" *ngIf="activePanelTab === 'Activités'"><p class="panel-empty">Aucune activité familiale enregistrée.</p></div>
          <div class="panel-actions"><button type="button" class="edit-action" (click)="edit(activeFamily)">✎ Modifier</button><button type="button" class="delete-action" (click)="deleteFamily(activeFamily)">▤ Supprimer</button></div>
        </aside>
      </div>

      <div class="modal-backdrop" *ngIf="selectedFamily" (click)="selectedFamily = null"><form class="membership modal" [formGroup]="memberForm" (ngSubmit)="addMember()" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="family-member-title">
        <div class="editor-heading"><div><h2 id="family-member-title">Ajouter à {{ selectedFamily.name }}</h2><p>Sélectionnez une personne ou un membre déjà enregistré.</p></div><button type="button" aria-label="Fermer" (click)="selectedFamily = null">×</button></div>
        <div class="form-grid"><label>Type de profil *<select formControlName="target_type"><option value="person">Personne du répertoire</option><option value="member">Membre de l’église</option></select></label><label *ngIf="memberForm.controls.target_type.value === 'person'">Personne *<select formControlName="person"><option value="">Sélectionner une personne</option><option *ngFor="let person of people" [value]="person.id">{{ person.first_name }} {{ person.last_name }}</option></select></label><label *ngIf="memberForm.controls.target_type.value === 'member'">Membre *<select formControlName="member"><option value="">Sélectionner un membre</option><option *ngFor="let member of members" [value]="member.id">{{ member.first_name }} {{ member.last_name }} · {{ member.email }}</option></select></label><label>Lien familial *<select formControlName="relationship_type"><option value="HEAD">Responsable</option><option value="SPOUSE">Conjoint(e)</option><option value="PARENT">Parent</option><option value="CHILD">Enfant</option><option value="SIBLING">Frère / sœur</option><option value="OTHER">Autre</option></select></label><label class="check"><input type="checkbox" formControlName="is_primary_contact" /> Contact principal</label></div>
        <div class="actions"><button class="primary" type="submit" [disabled]="saving || (memberForm.controls.target_type.value === 'person' && !people.length) || (memberForm.controls.target_type.value === 'member' && !members.length)">Ajouter à la famille</button><button class="quiet" type="button" (click)="selectedFamily = null">Annuler</button></div>
      </form></div>
      <p class="empty" *ngIf="families.length && !people.length && !members.length && !loading">Aucune personne ni membre n’est disponible. Créez d’abord une fiche dans Personnes ou Membres.</p>
    </section>
  `,
  styles: [`
    :host{display:block;color:#202b34}.page{max-width:1440px;margin:0 auto}.heading,.editor-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}.heading{margin-bottom:20px}.eyebrow{margin:0 0 7px;color:#157c72;font-size:.72rem;font-weight:800}.heading h1{margin:0;font-size:1.8rem}.heading p:not(.eyebrow){margin:5px 0 0;color:#69757a}.primary,.quiet{min-height:37px;padding:8px 12px;border:1px solid #166d65;background:#166d65;color:white;font-weight:700;cursor:pointer}.quiet{border-color:#d4dfdc;background:white;color:#29423e}.primary:disabled{opacity:.55}.editor,.membership,.families{margin-bottom:18px;border:1px solid #e2e8e7;background:white;padding:18px}.editor-heading h2{margin:0;font-size:1rem}.editor-heading p{margin:5px 0 0;color:#69757a;font-size:.84rem}.editor-heading>button{border:0;background:none;font-size:1.5rem;cursor:pointer}.form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:16px 0}.form-grid label{display:grid;gap:6px;color:#53615e;font-size:.8rem;font-weight:700}.form-grid input,.form-grid select,.form-grid textarea{width:100%;min-height:38px;padding:8px 10px;border:1px solid #cfd9d6;background:white;font:inherit}.form-grid textarea{min-height:68px}.wide{grid-column:1/-1}.check{display:flex!important;align-items:center;gap:8px!important}.check input{width:16px;height:16px;min-height:0}.actions{display:flex;gap:8px;flex-wrap:wrap}.empty{padding:18px 0;text-align:center;color:#69757a}.notice{padding:10px 12px;margin:0 0 14px;font-size:.87rem}.error{background:#fff1ef;color:#9b352a}.success{background:#e9f5ed;color:#23613a}
    `],
})
export class FamilyListComponent implements OnInit {
  readonly panelTabs = ['Informations', 'Membres', 'Historique', 'Activités'];
  families: Family[] = [];
  people: Person[] = [];
  members: Member[] = [];
  formOpen = false;
  editingId: string | null = null;
  selectedFamily: Family | null = null;
  activeFamily: Family | null = null;
  familyMembers: FamilyMemberRecord[] = [];
  activePanelTab = 'Informations';
  loadingFamilyMembers = false;
  searchTerm = '';
  statusFilter = '';
  ministryFilter = '';
  neighborhoodFilter = '';
  pageIndex = 0;
  readonly pageSize = 10;
  readonly selectedFamilyIds = new Set<string>();
  openMenuId: string | null = null;
  loading = false;
  saving = false;
  errorMessage = '';
  successMessage = '';
  get ministries(): string[] { return [...new Set(this.families.map((family) => family.ministry).filter((value): value is string => !!value))].sort(); }
  get neighborhoods(): string[] { return [...new Set(this.families.map((family) => family.neighborhood).filter((value): value is string => !!value))].sort(); }
  get filteredFamilies(): Family[] {
    const query = this.searchTerm.trim().toLocaleLowerCase();
    return this.families.filter((family) =>
      (!this.statusFilter || family.status === this.statusFilter)
      && (!this.ministryFilter || family.ministry === this.ministryFilter)
      && (!this.neighborhoodFilter || family.neighborhood === this.neighborhoodFilter)
      && (!query || [family.name, family.address, family.neighborhood, family.ministry, family.phone, family.email, family.primary_contact_name]
        .some((value) => value?.toLocaleLowerCase().includes(query))),
    );
  }
  get pagedFamilies(): Family[] { return this.filteredFamilies.slice(this.pageIndex * this.pageSize, (this.pageIndex + 1) * this.pageSize); }
  get placeholderRows(): number[] { return this.pagedFamilies.length ? Array.from({ length: this.pageSize - this.pagedFamilies.length }, (_, index) => index) : []; }
  get pageCount(): number { return Math.max(1, Math.ceil(this.filteredFamilies.length / this.pageSize)); }
  get visiblePages(): number[] {
    const visiblePageCount = Math.min(this.pageCount, 5);
    const firstPage = Math.min(Math.max(this.pageIndex - 2, 0), this.pageCount - visiblePageCount);
    return Array.from({ length: visiblePageCount }, (_, index) => firstPage + index);
  }
  get allVisibleSelected(): boolean { return this.pagedFamilies.length > 0 && this.pagedFamilies.every((family) => this.selectedFamilyIds.has(family.id)); }
  get rangeStart(): number { return this.filteredFamilies.length ? this.pageIndex * this.pageSize + 1 : 0; }
  get rangeEnd(): number { return Math.min((this.pageIndex + 1) * this.pageSize, this.filteredFamilies.length); }
  get familyPortraits(): FamilyMemberRecord[] { return this.familyMembers.slice(0, 4); }
  get activeFamilyCount(): number { return this.families.filter((family) => family.status === 'ACTIVE').length; }
  get followUpFamilyCount(): number { return this.families.filter((family) => family.status === 'FOLLOW_UP').length; }
  get newFamilyCount(): number {
    const now = new Date();
    return this.families.filter((family) => {
      if (!family.created_at) return false;
      const created = new Date(family.created_at);
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    }).length;
  }
  form = this.fb.group({ name: ['', Validators.required], address: [''], neighborhood: [''], ministry: [''], phone: [''], email: ['', Validators.email], status: ['ACTIVE'], notes: [''] });
  memberForm = this.fb.group({ target_type: ['person' as 'person' | 'member'], person: [''], member: [''], relationship_type: ['OTHER' as FamilyMemberRequest['relationship_type'], Validators.required], is_primary_contact: [false] });

  constructor(private fb: FormBuilder, private familyService: FamilyService, private personService: PersonService, private memberService: MemberService, private router: Router) {}

  ngOnInit(): void {
    this.loading = true; this.loadFamilies();
    this.personService.listPersons().subscribe({ next: (items) => this.people = items, error: (error) => this.errorMessage = this.describeError(error) });
    this.memberService.getMembers().subscribe({ next: (items) => this.members = items, error: (error) => this.errorMessage = this.describeError(error) });
  }
  openCreate(): void { this.resetForm(); this.formOpen = true; }
  closeForm(): void { this.formOpen = false; this.resetForm(); }
  edit(family: Family): void { this.openMenuId = null; this.editingId = family.id; this.formOpen = true; this.form.patchValue(family); }
  toggleMenu(id: string, event: Event): void { event.stopPropagation(); this.openMenuId = this.openMenuId === id ? null : id; }
  viewDetails(family: Family): void { this.openMenuId = null; this.router.navigate(['/families', family.id]); }
  selectFamily(family: Family): void {
    this.activeFamily = family;
    this.familyMembers = [];
    this.activePanelTab = 'Informations';
    this.loadingFamilyMembers = true;
    this.familyService.getFamilyMembers(family.id).subscribe({
      next: (items) => { if (this.activeFamily?.id === family.id) this.familyMembers = items; this.loadingFamilyMembers = false; },
      error: (error) => { this.errorMessage = this.describeError(error); this.loadingFamilyMembers = false; },
    });
  }
  setSearch(event: Event): void { this.searchTerm = (event.target as HTMLInputElement).value; this.pageIndex = 0; }
  setStatus(event: Event): void { this.statusFilter = (event.target as HTMLSelectElement).value; this.pageIndex = 0; }
  setMinistry(event: Event): void { this.ministryFilter = (event.target as HTMLSelectElement).value; this.pageIndex = 0; }
  setNeighborhood(event: Event): void { this.neighborhoodFilter = (event.target as HTMLSelectElement).value; this.pageIndex = 0; }
  resetFilters(): void { this.searchTerm = ''; this.statusFilter = ''; this.ministryFilter = ''; this.neighborhoodFilter = ''; this.pageIndex = 0; }
  toggleFamilySelection(id: string, event: Event): void {
    if ((event.target as HTMLInputElement).checked) this.selectedFamilyIds.add(id);
    else this.selectedFamilyIds.delete(id);
  }
  toggleVisibleFamilies(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    for (const family of this.pagedFamilies) {
      if (checked) this.selectedFamilyIds.add(family.id);
      else this.selectedFamilyIds.delete(family.id);
    }
  }
  changePage(direction: number): void { this.pageIndex = Math.max(0, Math.min(this.pageCount - 1, this.pageIndex + direction)); }
  goToPage(page: number): void { this.pageIndex = Math.max(0, Math.min(this.pageCount - 1, page)); }
  statusLabel(status?: string): string {
    if (status === 'ACTIVE') return 'Active';
    if (status === 'FOLLOW_UP') return 'En suivi';
    if (status === 'INACTIVE') return 'Inactive';
    if (status === 'ARCHIVED') return 'Archivée';
    return 'Non définie';
  }
  initials(name?: string | null): string {
    if (!name?.trim()) return '?';
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase();
  }
  relationshipLabel(type: FamilyMemberRecord['relationship_type']): string {
    const labels: Record<FamilyMemberRecord['relationship_type'], string> = {
      HEAD: 'Responsable', SPOUSE: 'Conjoint(e)', CHILD: 'Enfant', PARENT: 'Parent', SIBLING: 'Frère / sœur', OTHER: 'Autre',
    };
    return labels[type];
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const payload = this.form.getRawValue() as FamilyCreateRequest;
    this.saving = true; this.clearMessages();
    const request = this.editingId ? this.familyService.updateFamily(this.editingId, payload) : this.familyService.createFamily(payload);
    request.subscribe({ next: () => { this.saving = false; this.successMessage = this.editingId ? 'Famille mise à jour.' : 'Famille créée.'; this.closeForm(); this.loadFamilies(); }, error: (error) => { this.errorMessage = this.describeError(error); this.saving = false; } });
  }

  deleteFamily(family: Family): void {
    if (!window.confirm(`Supprimer « ${family.name} » et les rattachements de ses membres ?`)) return;
    this.familyService.deleteFamily(family.id).subscribe({
      next: () => {
        this.successMessage = `La famille « ${family.name} » a été supprimée.`;
        if (this.activeFamily?.id === family.id) { this.activeFamily = null; this.familyMembers = []; }
        this.loadFamilies();
      },
      error: (error) => { this.errorMessage = this.describeError(error); },
    });
  }

  openAddMember(family: Family): void { this.openMenuId = null; this.selectedFamily = family; this.memberForm.reset({ target_type: 'person', person: '', member: '', relationship_type: 'OTHER', is_primary_contact: false }); this.clearMessages(); }

  addMember(): void {
    if (!this.selectedFamily || this.memberForm.invalid) { this.memberForm.markAllAsTouched(); return; }
    const { target_type, person, member, relationship_type, is_primary_contact } = this.memberForm.getRawValue();
    const targetId = target_type === 'member' ? member : person;
    if (!targetId) { this.errorMessage = target_type === 'member' ? 'Sélectionnez un membre de l’église.' : 'Sélectionnez une personne.'; return; }
    const shared = { relationship_type: relationship_type ?? 'OTHER', is_primary_contact: is_primary_contact ?? false };
    const payload: FamilyMemberRequest = target_type === 'member'
      ? { ...shared, member: targetId }
      : { ...shared, person: targetId };
    this.saving = true;
    this.familyService.addMemberToFamily(this.selectedFamily.id, payload).subscribe({
      next: () => {
        this.saving = false;
        this.successMessage = target_type === 'member' ? 'Membre ajouté à la famille.' : 'Personne ajoutée à la famille.';
        const family = this.selectedFamily;
        this.selectedFamily = null;
        this.loadFamilies();
        if (family && this.activeFamily?.id === family.id) this.selectFamily(family);
      },
      error: (error) => { this.errorMessage = this.describeError(error); this.saving = false; },
    });
  }

  trackById(_index: number, family: Family): string { return family.id; }
  loadFamilies(): void { this.loading = true; this.familyService.listFamilies().subscribe({ next: (items) => { this.families = items; this.loading = false; const selected = items.find((family) => family.id === this.activeFamily?.id) ?? items.find((family) => (family.member_count || 0) > 0) ?? items[0] ?? null; if (selected) this.selectFamily(selected); else { this.activeFamily = null; this.familyMembers = []; } }, error: (error) => { this.errorMessage = this.describeError(error); this.loading = false; } }); }
  private resetForm(): void { this.editingId = null; this.form.reset({ name: '', address: '', neighborhood: '', ministry: '', phone: '', email: '', status: 'ACTIVE', notes: '' }); }
  private clearMessages(): void { this.errorMessage = ''; this.successMessage = ''; }
  private describeError(error: unknown): string { if (error instanceof HttpErrorResponse) { const body = error.error as Record<string, unknown> | string | null; if (typeof body === 'string') return body; if (body && typeof body === 'object') { const detail = body['detail']; if (typeof detail === 'string') return detail; return Object.entries(body).map(([key, value]) => `${key} : ${Array.isArray(value) ? value.join(', ') : value}`).join(' · '); } return `Erreur API (${error.status}).`; } return 'Une erreur inattendue est survenue.'; }
}