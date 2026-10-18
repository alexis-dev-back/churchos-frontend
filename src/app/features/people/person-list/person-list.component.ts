import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Person, PersonCreateRequest, PersonMembershipRequest } from '../../../core/models/person';
import { Campus, Church } from '../../../core/models/tenant';
import { PersonService } from '../../../core/services/person.service';
import { TenantService } from '../../../core/services/tenant.service';

@Component({
  selector: 'app-person-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="page people-page">
      <nav class="breadcrumbs"><a routerLink="/dashboard">Accueil</a><span>›</span><strong>Personnes</strong></nav>
      <header class="people-heading"><div class="people-title"><span class="people-title-icon">P</span><div><h1>Personnes</h1><p>Gérez les fiches et accompagnez leur parcours vers l’église.</p></div></div><button type="button" class="primary" (click)="openCreate()">＋ Ajouter une personne</button></header>
      <p *ngIf="errorMessage" class="notice error" role="alert">{{ errorMessage }}</p><p *ngIf="successMessage" class="notice success" role="status">{{ successMessage }}</p>
      <p *ngIf="invitationToken" class="token-box">Code d’invitation à 5 chiffres à transmettre pour activer le compte : <code>{{ invitationToken }}</code></p>

      <div class="modal-backdrop" *ngIf="formOpen" (click)="closeForm()"><form class="editor modal" [formGroup]="form" (ngSubmit)="savePerson()" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="person-form-title">
        <div class="editor-heading"><h2 id="person-form-title">{{ editingId ? 'Modifier la personne' : 'Nouvelle personne' }}</h2><button type="button" aria-label="Fermer" (click)="closeForm()">×</button></div>
        <p *ngIf="formError" class="notice error" role="alert">{{ formError }}</p>
        <div class="duplicate-list" *ngIf="duplicates.length"><p>Fiches similaires déjà présentes :</p><button type="button" *ngFor="let duplicate of duplicates" (click)="edit(duplicate)">{{ duplicate.first_name }} {{ duplicate.last_name }} · {{ duplicate.email || duplicate.phone || 'Coordonnées absentes' }} · Ouvrir la fiche</button></div>
        <div class="form-grid">
          <label>Prénom *<input formControlName="first_name" /></label><label>Nom *<input formControlName="last_name" /></label><label>Autre prénom<input formControlName="middle_name" /></label>
          <label>Email<input type="email" formControlName="email" /></label><label>Téléphone<input formControlName="phone" /></label><label>Genre<select formControlName="gender"><option value="">Non renseigné</option><option value="M">Homme</option><option value="F">Femme</option></select></label>
          <label>Date de naissance<input type="date" formControlName="date_of_birth" /></label><label class="wide">Adresse<textarea formControlName="address"></textarea></label><label class="wide">Notes<textarea formControlName="notes"></textarea></label>
        </div>
        <div class="actions"><button class="primary" type="submit" [disabled]="form.invalid || saving">{{ saving ? 'Enregistrement…' : editingId ? 'Enregistrer' : 'Créer la fiche' }}</button><button type="button" class="quiet" (click)="closeForm()">Annuler</button></div>
      </form></div>

      <div class="summary-strip">
        <article class="summary-tile"><span class="summary-mark">P</span><div><strong>{{ people.length }}</strong><span>Personnes enregistrées</span></div></article>
        <article class="summary-tile"><span class="summary-mark">A</span><div><strong>{{ linkedPeopleCount }}</strong><span>Comptes liés</span></div></article>
        <article class="summary-tile"><span class="summary-mark">C</span><div><strong>{{ people.length - linkedPeopleCount }}</strong><span>À convertir en membre</span></div></article>
        <article class="summary-tile"><span class="summary-mark">☎</span><div><strong>{{ peopleWithoutContactCount }}</strong><span>Coordonnées à compléter</span></div></article>
      </div>
      <div class="people-workspace">
        <section class="list-panel table-panel people-table">
        <div class="people-filters"><label class="people-search"><span>⌕</span><input type="search" placeholder="Rechercher une personne..." aria-label="Rechercher une personne" (input)="onSearch($event)" /></label><select aria-label="Filtrer par compte" [value]="accountFilter" (change)="setAccountFilter($event)"><option value="ALL">Tous les comptes</option><option value="LINKED">Compte lié</option><option value="UNLINKED">Sans compte</option></select><span class="people-result-count">{{ filteredPeople.length }} résultat(s)</span></div>
        <div class="table-wrap"><table><thead><tr><th>Nom complet</th><th>Email</th><th>Téléphone</th><th>Adresse</th><th>Compte</th><th>Actions</th></tr></thead><tbody>
          <tr *ngFor="let person of filteredPeople; trackBy: trackById" (click)="selectPerson(person)" [class.selected-row]="selectedPerson?.id === person.id">
            <td><strong>{{ person.first_name }} {{ person.middle_name || '' }} {{ person.last_name }}</strong></td><td>{{ person.email || '—' }}</td><td>{{ person.phone || '—' }}</td><td>{{ person.address || '—' }}</td><td><span class="person-status" [attr.data-status]="person.user ? 'ACTIVE' : 'PENDING'">{{ person.user ? 'Compte lié' : 'Sans compte' }}</span></td>
            <td><div class="context-wrap"><button type="button" class="context-trigger" aria-label="Actions personne" (click)="toggleMenu(person.id, $event)">⋮</button><div class="context-menu" *ngIf="openMenuId === person.id"><button type="button" (click)="viewDetails(person)">Voir détail</button><button type="button" (click)="edit(person)">Modifier</button><button type="button" *ngIf="!person.user" (click)="openConversion(person)">Convertir en membre</button></div></div></td>
          </tr>
          <tr *ngIf="!filteredPeople.length"><td colspan="6" class="empty">{{ loading ? 'Chargement…' : people.length ? 'Aucun résultat.' : 'Aucune personne enregistrée.' }}</td></tr>
        </tbody></table></div>
      </section>
      <aside class="person-panel" *ngIf="selectedPerson as person">
        <div class="person-cover"><span class="person-account" [attr.data-status]="person.user ? 'ACTIVE' : 'PENDING'">{{ person.user ? 'Compte lié' : 'Sans compte' }}</span><button type="button" aria-label="Actions de la personne" (click)="toggleMenu(person.id, $event)">···</button></div>
        <div class="person-summary"><span class="person-portrait">{{ initials(person) }}</span><div><h2>{{ person.first_name }} {{ person.middle_name || '' }} {{ person.last_name }}</h2><span>{{ person.email || 'Adresse email non renseignée' }}</span></div></div>
        <nav class="person-tabs"><button type="button" class="active">Informations</button><button type="button" (click)="openConversion(person)" *ngIf="!person.user">Convertir en membre</button></nav>
        <div class="person-panel-content">
          <h3>Informations générales</h3>
          <div class="person-info-row"><span>☎</span><div><small>Téléphone</small><strong>{{ person.phone || '—' }}</strong></div></div>
          <div class="person-info-row"><span>⌖</span><div><small>Adresse</small><strong>{{ person.address || '—' }}</strong></div></div>
          <div class="person-info-row"><span>◷</span><div><small>Date de naissance</small><strong>{{ person.date_of_birth || '—' }}</strong></div></div>
          <div class="person-info-row"><span>✉</span><div><small>Compte utilisateur</small><strong>{{ person.user ? 'Compte associé' : 'Aucun compte associé' }}</strong></div></div>
          <div class="person-panel-actions"><button type="button" class="secondary" (click)="edit(person)">Modifier</button><button type="button" class="primary" (click)="viewDetails(person)">Voir la fiche complète</button></div>
        </div>
      </aside>
      </div>

      <div class="modal-backdrop" *ngIf="conversionPerson" (click)="conversionPerson = null"><form class="conversion modal" [formGroup]="conversionForm" (ngSubmit)="convert()" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="conversion-title">
        <div class="editor-heading"><div><h2 id="conversion-title">Convertir {{ conversionPerson.first_name }} {{ conversionPerson.last_name }}</h2><p>Un compte membre sera créé avec une invitation à accepter.</p></div><button type="button" aria-label="Fermer" (click)="conversionPerson = null">×</button></div>
        <div class="form-grid">
          <label *ngIf="!churchSelectionFixed">Église *<select formControlName="church" (change)="filterConversionCampuses()"><option value="">Sélectionner</option><option *ngFor="let church of churches" [value]="church.church_id">{{ church.name }}</option></select></label>
          <label>Campus *<select formControlName="campus" (change)="rememberConversionCampus()"><option value="">Sélectionner</option><option *ngFor="let campus of conversionCampuses" [value]="campus.campus_id">{{ campus.name }}</option></select></label>
          <label>Situation matrimoniale<select formControlName="marital_status"><option value="">Non renseignée</option><option value="single">Célibataire</option><option value="married">Marié(e)</option><option value="divorced">Divorcé(e)</option><option value="widowed">Veuf/Veuve</option></select></label>
          <label class="wide">Adresse<textarea formControlName="address"></textarea></label>
        </div>
        <div class="actions"><button type="submit" class="primary" [disabled]="conversionForm.invalid || saving">{{ saving ? 'Conversion…' : 'Créer le membre' }}</button><button type="button" class="quiet" (click)="conversionPerson = null">Annuler</button></div>
      </form></div>
      <div class="modal-backdrop" *ngIf="detailPerson" (click)="detailPerson = null"><section class="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="person-detail-title" (click)="$event.stopPropagation()"><div class="editor-heading"><h2 id="person-detail-title">{{ detailPerson.first_name }} {{ detailPerson.middle_name || '' }} {{ detailPerson.last_name }}</h2><button type="button" aria-label="Fermer" (click)="detailPerson = null">×</button></div><dl class="detail-grid"><dt>Email</dt><dd>{{ detailPerson.email || '—' }}</dd><dt>Téléphone</dt><dd>{{ detailPerson.phone || '—' }}</dd><dt>Adresse</dt><dd>{{ detailPerson.address || '—' }}</dd><dt>Date de naissance</dt><dd>{{ detailPerson.date_of_birth || '—' }}</dd><dt>Notes</dt><dd>{{ detailPerson.notes || '—' }}</dd><dt>Compte lié</dt><dd>{{ detailPerson.user ? 'Oui' : 'Non' }}</dd></dl></section></div>
    </section>
  `,
  styles: [`
    :host{display:block;color:#202b34}.page{max-width:1320px;margin:0 auto}.heading,.editor-heading,.list-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}.heading{margin-bottom:20px}.eyebrow{margin:0 0 7px;color:#157c72;font-size:.72rem;font-weight:800}.heading h1{margin:0;font-size:1.8rem}.heading p:not(.eyebrow){margin:5px 0 0;color:#69757a}.primary,.quiet{min-height:37px;padding:8px 12px;border:1px solid #166d65;background:#166d65;color:#fff;font-weight:700;cursor:pointer}.quiet{background:#fff;border-color:#d4dfdc;color:#29423e}.primary:disabled{opacity:.55}.editor,.list-panel,.conversion{margin-bottom:18px;border:1px solid #dce4e2;background:#fff;padding:18px}.editor-heading h2,.list-heading h2{margin:0;font-size:1rem}.editor-heading p{margin:5px 0 0;color:#69757a;font-size:.84rem}.editor-heading>button{border:0;background:none;font-size:1.5rem;cursor:pointer}.form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:16px 0}.form-grid label{display:grid;gap:6px;color:#53615e;font-size:.8rem;font-weight:700}.form-grid input,.form-grid select,.form-grid textarea,.list-heading input{width:100%;min-height:38px;padding:8px 10px;border:1px solid #cfd9d6;background:white;font:inherit}.form-grid textarea{min-height:70px}.wide{grid-column:1/-1}.actions{display:flex;gap:8px;flex-wrap:wrap}.list-heading{margin-bottom:8px}.list-heading input{max-width:280px}.person{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0;border-top:1px solid #edf1f0}.person-info{display:grid;gap:4px;min-width:0}.person-info strong{font-size:.92rem}.person-info span,.person-info small{color:#69757a;font-size:.8rem;overflow-wrap:anywhere}.empty{padding:20px 0;text-align:center;color:#69757a}.notice,.token-box{padding:10px 12px;margin:0 0 14px;font-size:.87rem}.error{background:#fff1ef;color:#9b352a}.success{background:#e9f5ed;color:#23613a}.token-box{background:#fff8e8;color:#694d10;overflow-wrap:anywhere}.token-box code{font-size:.8rem}@media(max-width:760px){.form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.heading{align-items:flex-start;flex-direction:column}.person{align-items:flex-start;flex-direction:column}.form-grid{grid-template-columns:1fr}.wide{grid-column:auto}.list-heading{align-items:flex-start;flex-direction:column}.list-heading input{max-width:none}}
    .modal-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:#17262480}.modal{width:min(760px,100%);max-height:90vh;overflow:auto;margin:0;background:white;padding:24px;border:0;box-shadow:0 24px 80px #10221f40}.detail-modal{width:min(520px,100%)}.context-wrap{position:relative}.context-trigger{width:34px;height:34px;border:1px solid #dce4e2;background:white;font-size:1.2rem;cursor:pointer}.context-menu{position:absolute;right:0;top:38px;z-index:8;min-width:180px;padding:5px;background:white;border:1px solid #dce4e2;box-shadow:0 12px 30px #1b2c351c}.context-menu button{display:block;width:100%;padding:9px;text-align:left;border:0;background:white;color:#29423e;cursor:pointer}.context-menu button:hover{background:#f2f7f5}.detail-grid{display:grid;grid-template-columns:125px 1fr;gap:11px;margin-top:20px}.detail-grid dt{color:#687477;font-size:.82rem}.detail-grid dd{margin:0;font-size:.86rem;overflow-wrap:anywhere}@media(max-width:560px){.modal-backdrop{padding:10px}.modal{padding:18px}.detail-grid{grid-template-columns:100px 1fr}}
  `,
  `
    .people-page{max-width:none;padding:8px 0 24px;color:#18345d}
    .breadcrumbs{display:flex;gap:9px;margin:0 0 10px;color:#7a8ba2;font-size:.75rem}
    .breadcrumbs a{color:#176bff;text-decoration:none}.breadcrumbs strong{color:#30425e}
    .people-heading{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:0 4px 14px}
    .people-title{display:flex;align-items:center;gap:11px}
    .people-title-icon{display:grid;place-items:center;width:34px;height:34px;border-radius:8px;background:#e6f0ff;color:#0969f6;font-weight:800}
    .people-title h1{margin:0;color:#1d355b;font-size:1.48rem}
    .people-title p{margin:4px 0 0;color:#71829b;font-size:.78rem}
    .people-heading>.primary{min-height:36px;padding:7px 11px;border:0;border-radius:6px;background:#0969f6;color:white;font-size:.72rem;font-weight:700}
    .people-page .summary-strip{grid-template-columns:repeat(4,minmax(0,1fr));gap:11px;margin-bottom:14px}
    .people-page .summary-tile{min-height:80px;padding:13px;border-color:#e2ebf8;border-radius:8px;box-shadow:0 2px 8px #17345b08}
    .people-page .summary-mark{width:32px;height:32px;border-radius:8px;background:#e6f0ff;color:#0969f6}
    .people-page .summary-tile strong{color:#213b62;font-size:1.2rem}
    .people-page .summary-tile span{color:#71829b;font-size:.68rem}
    .people-workspace{display:grid;grid-template-columns:minmax(0,1fr) minmax(230px,23%);gap:14px;align-items:stretch}
    .people-table{display:flex;min-width:0;height:min(63vh,490px);min-height:360px;flex-direction:column;overflow:hidden;margin:0;padding:0;border:1px solid #e2ebf8;border-radius:8px;box-shadow:0 2px 8px #17345b08}
    .people-filters{display:flex;align-items:center;gap:7px;padding:8px;border-bottom:1px solid #edf2f8}
    .people-filters select,.people-search{min-width:0;min-height:35px;padding:7px 9px;border:1px solid #e0e8f3;border-radius:6px;background:#fff;color:#334967;font-size:.66rem}
    .people-search{display:flex;flex:1;align-items:center;gap:6px;color:#3378d8}
    .people-search input{width:100%;min-width:0;border:0;outline:0;color:#334967;font:inherit}
    .people-result-count{color:#8190a5;font-size:.64rem;white-space:nowrap}
    .people-table .table-wrap{flex:1;overflow:auto}
    .people-table table{width:100%;border-collapse:collapse;color:#304665;font-size:.66rem}
    .people-table th{padding:8px 7px;border-bottom:1px solid #eaf0f8;background:#f8faff;color:#506582;text-align:left;font-size:.61rem;white-space:nowrap}
    .people-table td{padding:8px 7px;border-top:1px solid #eef2f8;color:#435a78;font-size:.64rem}
    .people-table tbody tr{cursor:pointer}.people-table tbody tr:hover,.people-table tbody tr.selected-row{background:#f5f9ff}
    .people-table td strong{color:#2d4362}
    .person-panel{position:sticky;top:68px;display:flex;min-width:0;min-height:min(63vh,490px);flex-direction:column;overflow:hidden;border:1px solid #e2ebf8;border-radius:8px;background:white;box-shadow:0 2px 8px #17345b08}
    .person-cover{display:flex;justify-content:flex-end;align-items:flex-start;gap:6px;height:62px;padding:8px;background:linear-gradient(0deg,#1c3d6588,transparent 72%),url('/assets/images/church-banner.svg') center 48%/cover no-repeat}
    .person-cover button{border:0;border-radius:4px;background:#ffffffbb;color:#254465;cursor:pointer}
    .person-account{align-self:flex-start;padding:4px 8px;border-radius:99px;background:#d9f7eb;color:#129465;font-size:.58rem;font-weight:800}
    .person-account[data-status=PENDING]{background:#fff1d8;color:#986710}
    .person-summary{display:flex;align-items:flex-start;gap:9px;padding:0 11px 10px}
    .person-portrait{display:grid;flex:0 0 40px;place-items:center;width:40px;height:40px;margin-top:-20px;border:3px solid white;border-radius:50%;background:#dce8f7;color:#315578;font-size:.72rem;font-weight:800;box-shadow:0 0 0 1px #e0e8f2}
    .person-summary>div{min-width:0}.person-summary h2{margin:5px 0 4px;color:#263d60;font-size:.78rem}.person-summary>div>span{color:#7889a1;font-size:.6rem;overflow-wrap:anywhere}
    .person-panel-content{padding:12px}.person-panel-content h3{margin:0 0 8px;color:#304665;font-size:.72rem}
    .person-info-row{display:flex;align-items:center;gap:9px;padding:7px 0;border-bottom:1px solid #edf2f8}.person-info-row>span{display:grid;flex:0 0 27px;place-items:center;width:27px;height:27px;border-radius:7px;background:#eef4ff;color:#176bff;font-size:.72rem}.person-info-row>div{display:grid;min-width:0;gap:3px}.person-info-row small{display:block;color:#8291a6;font-size:.57rem}.person-info-row strong{overflow-wrap:anywhere;color:#304665;font-size:.65rem}
    .person-panel-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.person-panel-actions button{padding:6px 9px;border:1px solid #dce6f3;border-radius:5px;background:white;color:#315578;font-size:.65rem;font-weight:700;cursor:pointer}
    @media(max-width:850px){.people-workspace{grid-template-columns:minmax(0,1fr)}.person-panel{position:static;min-height:0;order:-1}}
    @media(max-width:700px){.people-heading{align-items:flex-start;flex-direction:column}.people-page .summary-strip{grid-template-columns:repeat(2,minmax(0,1fr))}.people-filters{align-items:stretch;flex-direction:column}.people-table{overflow:auto}.people-table table{min-width:600px}}
  `],
})
export class PersonListComponent implements OnInit {
  people: Person[] = [];
  churches: Church[] = [];
  campuses: Campus[] = [];
  conversionCampuses: Campus[] = [];
  formOpen = false;
  editingId: string | null = null;
  conversionPerson: Person | null = null;
  loading = false;
  saving = false;
  search = '';
  errorMessage = '';
  successMessage = '';
  invitationToken = '';
  formError = '';
  duplicates: Person[] = [];
  churchSelectionFixed = false;
  defaultChurchId: string | null = null;
  openMenuId: string | null = null;
  detailPerson: Person | null = null;
  selectedPerson: Person | null = null;
  accountFilter = 'ALL';
  form = this.fb.group({ first_name: ['', Validators.required], last_name: ['', Validators.required], middle_name: [''], email: ['', Validators.email], phone: [''], gender: [''], date_of_birth: [''], address: [''], notes: [''] });
  conversionForm = this.fb.group({ church: ['', Validators.required], campus: [''], marital_status: [''], address: [''] });

  constructor(private fb: FormBuilder, private personService: PersonService, private tenantService: TenantService) {}

  ngOnInit(): void {
    this.loading = true;
    forkJoin({
      people: this.personService.listPersons(),
      context: this.tenantService.churchContext(),
    }).subscribe({
      next: (result) => {
        this.people = result.people;
        this.selectedPerson = result.people[0] ?? null;
        this.churches = result.context.churches;
        this.campuses = result.context.campuses;
        this.conversionCampuses = result.context.campuses;
        this.churchSelectionFixed = result.context.church_selection_fixed;
        this.defaultChurchId = result.context.default_church_id;
        this.loading = false;
      },
      error: (error) => { this.errorMessage = this.describeError(error); this.loading = false; },
    });
  }

  get filteredPeople(): Person[] { const query = this.search.trim().toLocaleLowerCase(); return this.people.filter((person) => (!query || `${person.first_name} ${person.last_name} ${person.email ?? ''} ${person.phone ?? ''}`.toLocaleLowerCase().includes(query)) && (this.accountFilter === 'ALL' || (this.accountFilter === 'LINKED' ? !!person.user : !person.user))); }
  get linkedPeopleCount(): number { return this.people.filter((person) => !!person.user).length; }
  get peopleWithoutContactCount(): number { return this.people.filter((person) => !person.email && !person.phone).length; }
  onSearch(event: Event): void { this.search = (event.target as HTMLInputElement).value; this.keepSelectedPersonVisible(); }
  setAccountFilter(event: Event): void { this.accountFilter = this.valueOf(event); this.keepSelectedPersonVisible(); }
  valueOf(event: Event): string { return (event.target as HTMLSelectElement).value; }
  selectPerson(person: Person): void { this.selectedPerson = person; }
  initials(person: Person): string { return `${person.first_name?.[0] ?? ''}${person.last_name?.[0] ?? ''}`.toUpperCase(); }
  private keepSelectedPersonVisible(): void { if (!this.filteredPeople.some((person) => person.id === this.selectedPerson?.id)) this.selectedPerson = this.filteredPeople[0] ?? null; }
  openCreate(): void { this.form.reset(); this.editingId = null; this.formError = ''; this.duplicates = []; this.formOpen = true; }
  closeForm(): void { this.formOpen = false; this.editingId = null; this.formError = ''; this.duplicates = []; this.form.reset(); }

  savePerson(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const payload = this.form.getRawValue() as PersonCreateRequest;
    this.saving = true; this.clearMessages(); this.formError = ''; this.duplicates = [];
    const request = this.editingId ? this.personService.updatePerson(this.editingId, payload) : this.personService.createPerson(payload);
    request.subscribe({
      next: (result) => {
        this.saving = false;
        if ('duplicates' in result) { this.formError = result.detail; this.duplicates = result.duplicates; return; }
        this.successMessage = this.editingId ? 'Fiche mise à jour.' : 'Personne créée.'; this.closeForm(); this.reload();
      },
      error: (error) => { this.formError = this.describeError(error); this.saving = false; },
    });
  }

  edit(person: Person): void { this.openMenuId = null; this.formError = ''; this.duplicates = []; this.editingId = person.id; this.formOpen = true; this.form.patchValue(person); }

  toggleMenu(id: string, event: Event): void { event.stopPropagation(); this.openMenuId = this.openMenuId === id ? null : id; }
  viewDetails(person: Person): void { this.openMenuId = null; this.detailPerson = person; }

  openConversion(person: Person): void {
    this.clearMessages(); this.openMenuId = null; this.conversionPerson = person;
    const preferredChurchId = localStorage.getItem('churchos_preferred_church');
    const defaultChurch = this.churches.find((item) => item.church_id === this.defaultChurchId);
    const church = (this.churchSelectionFixed ? defaultChurch : null)
      ?? this.churches.find((item) => item.church_id === preferredChurchId)
      ?? (this.churches.length === 1 ? this.churches[0] : null);
    this.conversionCampuses = church ? this.campuses.filter((campus) => campus.church === church.church_id) : this.campuses;
    const preferredCampusId = localStorage.getItem('churchos_preferred_campus');
    const campus = this.conversionCampuses.find((item) => item.campus_id === preferredCampusId) ?? (this.conversionCampuses.length === 1 ? this.conversionCampuses[0] : null);
    this.conversionForm.reset({ church: church?.church_id ?? '', campus: campus?.campus_id ?? '', marital_status: '', address: person.address ?? '' });
  }

  filterConversionCampuses(): void {
    const churchId = this.conversionForm.controls.church.value;
    this.conversionCampuses = this.campuses.filter((item) => item.church === churchId || !churchId);
    this.conversionForm.controls.campus.setValue('');
    if (churchId) localStorage.setItem('churchos_preferred_church', churchId);
    if (this.conversionCampuses.length === 1) this.conversionForm.controls.campus.setValue(this.conversionCampuses[0].campus_id);
  }

  rememberConversionCampus(): void { const id = this.conversionForm.controls.campus.value; if (id) localStorage.setItem('churchos_preferred_campus', id); }

  convert(): void {
    if (!this.conversionPerson || this.conversionForm.invalid) { this.conversionForm.markAllAsTouched(); return; }
    const payload = { ...this.conversionForm.getRawValue(), email: this.conversionPerson.email ?? '', phone: this.conversionPerson.phone ?? '', gender: this.conversionPerson.gender ?? '', date_of_birth: this.conversionPerson.date_of_birth ?? '' } as PersonMembershipRequest;
    this.saving = true; this.clearMessages();
    this.personService.convertToMember(this.conversionPerson.id, payload).subscribe({
      next: (result) => { this.invitationToken = result.invitation_token; this.successMessage = 'Conversion réussie. Transmettez le code à 5 chiffres pour que le membre crée son nom d’utilisateur et son mot de passe.'; this.conversionPerson = null; this.saving = false; this.reload(); },
      error: (error) => { this.errorMessage = this.describeError(error); this.saving = false; },
    });
  }

  trackById(_index: number, person: Person): string { return person.id; }
  private reload(): void { this.personService.listPersons().subscribe({ next: (items) => { this.people = items; this.selectedPerson = items.find((person) => person.id === this.selectedPerson?.id) ?? items[0] ?? null; }, error: (error) => this.errorMessage = this.describeError(error) }); }
  private clearMessages(): void { this.errorMessage = ''; this.successMessage = ''; this.invitationToken = ''; }
  private describeError(error: unknown): string { if (error instanceof HttpErrorResponse) { const body = error.error as Record<string, unknown> | string | null; if (typeof body === 'string') return body; if (body && typeof body === 'object') { if (typeof body['detail'] === 'string') return body['detail']; return Object.entries(body).map(([key, value]) => `${key} : ${Array.isArray(value) ? value.join(', ') : value}`).join(' · '); } return `Erreur API (${error.status}).`; } return 'Une erreur inattendue est survenue.'; }
}