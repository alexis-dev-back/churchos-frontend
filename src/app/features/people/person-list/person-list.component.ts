import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { InvitingMember, Person, PersonCreateRequest, PersonMembershipRequest } from '../../../core/models/person';
import { Campus, Church } from '../../../core/models/tenant';
import { PersonService } from '../../../core/services/person.service';
import { TenantService } from '../../../core/services/tenant.service';

@Component({
  selector: 'app-person-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="page people-page">
      <nav class="breadcrumbs"><a routerLink="/dashboard">ChurchOS</a><span>/</span><strong>Personnes</strong></nav>
      <header class="people-heading"><div class="people-title"><h1>Personnes</h1><p>Fiches de personnes, conversion en membres</p></div><button type="button" class="primary" (click)="openCreate()">＋ Nouvelle personne</button></header>
      <p *ngIf="errorMessage" class="notice error" role="alert">{{ errorMessage }}</p><p *ngIf="successMessage" class="notice success" role="status">{{ successMessage }}</p>
      <p *ngIf="invitationToken" class="token-box">Code d’invitation à 5 chiffres à transmettre pour activer le compte : <code>{{ invitationToken }}</code></p>

      <div class="modal-backdrop" *ngIf="formOpen" (click)="closeForm()"><form class="editor modal" [formGroup]="form" (ngSubmit)="savePerson()" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="person-form-title">
        <div class="editor-heading"><h2 id="person-form-title">{{ editingId ? 'Modifier la personne' : 'Nouvelle personne' }}</h2><button type="button" aria-label="Fermer" (click)="closeForm()">×</button></div>
        <p *ngIf="formError" class="notice error" role="alert">{{ formError }}</p>
        <div class="duplicate-list" *ngIf="duplicates.length"><p>Fiches similaires déjà présentes :</p><button type="button" *ngFor="let duplicate of duplicates" (click)="edit(duplicate)">{{ duplicate.first_name }} {{ duplicate.last_name }} · {{ duplicate.email || duplicate.phone || 'Coordonnées absentes' }} · Ouvrir la fiche</button></div>
        <div class="form-grid">
          <label>Prénom *<input formControlName="first_name" /></label><label>Nom *<input formControlName="last_name" /></label><label>Autre prénom<input formControlName="middle_name" /></label>
          <label>Email<input type="email" formControlName="email" /></label><label>Téléphone<input formControlName="phone" /></label><label>Genre<select formControlName="gender"><option value="">Non renseigné</option><option value="M">Homme</option><option value="F">Femme</option></select></label>
          <label>Date de naissance<input type="date" formControlName="date_of_birth" /></label>
          <label>Type de personne<select formControlName="person_type"><option value="INVITED">Invité(e)</option><option value="NON_INVITED">Non invité(e)</option></select></label>
          <label>Situation baptismale<select formControlName="baptism_status"><option value="UNKNOWN">Non renseignée</option><option value="NOT_BAPTIZED">Non baptisé(e)</option><option value="IN_PREPARATION">En préparation</option><option value="BAPTIZED">Baptisé(e)</option></select></label>
          <label>Invité(e) par un membre<select formControlName="invited_by_member"><option value="">Aucun membre sélectionné</option><option *ngFor="let member of members" [value]="member.id">{{ member.first_name }} {{ member.last_name }}</option></select></label>
          <label>Nationalité<input formControlName="nationality" /></label><label>Profession<input formControlName="profession" /></label><label>Niveau d’étude<input formControlName="education_level" /></label>
          <label>Situation matrimoniale<select formControlName="marital_status"><option value="">Non renseignée</option><option value="single">Célibataire</option><option value="married">Marié(e)</option><option value="divorced">Divorcé(e)</option><option value="widowed">Veuf/veuve</option></select></label>
          <label class="wide">Lieu d’habitation<textarea formControlName="address"></textarea></label><label class="wide">Notes<textarea formControlName="notes"></textarea></label>
        </div>
        <div class="actions"><button class="primary" type="submit" [disabled]="form.invalid || saving">{{ saving ? 'Enregistrement…' : editingId ? 'Enregistrer' : 'Créer la fiche' }}</button><button type="button" class="quiet" (click)="closeForm()">Annuler</button></div>
      </form></div>

      <section class="people-table" aria-label="Annuaire des personnes">
        <div class="people-filters">
          <label class="people-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Rechercher..." aria-label="Rechercher une personne" (input)="onSearch($event)" /></label>
          <span class="people-result-count">{{ filteredPeople.length }} fiches</span>
        </div>
        <div class="table-wrap"><table><thead><tr><th>Personne</th><th>Email</th><th>Téléphone</th><th>Genre</th><th>Actions</th></tr></thead><tbody>
          <tr *ngFor="let person of filteredPeople; trackBy: trackById">
            <td><button type="button" class="person-name" (click)="viewDetails(person)"><span class="person-avatar">{{ initials(person) }}</span><strong>{{ person.first_name }} {{ person.middle_name || '' }} {{ person.last_name }}</strong></button></td>
            <td>{{ person.email || '—' }}</td><td>{{ person.phone || '—' }}</td><td>{{ genderLabel(person.gender) }}</td>
            <td><div class="row-actions">
              <button type="button" class="row-action" [attr.aria-label]="'Voir la fiche de ' + person.first_name + ' ' + person.last_name" title="Voir la fiche" (click)="viewDetails(person)">◉</button>
              <button type="button" class="row-action" [attr.aria-label]="'Modifier ' + person.first_name + ' ' + person.last_name" title="Modifier" (click)="edit(person)">✎</button>
              <button *ngIf="!person.user" type="button" class="row-action" [attr.aria-label]="'Convertir ' + person.first_name + ' en membre'" title="Convertir en membre" (click)="openConversion(person)">↻</button>
            </div></td>
          </tr>
          <tr *ngIf="!filteredPeople.length"><td colspan="5" class="empty">{{ loading ? 'Chargement…' : people.length ? 'Aucun résultat.' : 'Aucune personne enregistrée.' }}</td></tr>
        </tbody></table></div>
      </section>

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
    </section>
  `,
  styles: [`
    :host{display:block;color:#1B2A24}.people-page{max-width:none;margin:0 auto;padding:4px 0 32px}
    .breadcrumbs{display:flex;align-items:center;gap:8px;margin:0 0 18px;color:#7A8A84;font-size:.84rem}.breadcrumbs a{color:#6B7D75;text-decoration:none}.breadcrumbs strong{color:#1B2A24}
    .people-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 18px}.people-title h1{margin:0;font-size:1.4rem;font-weight:750}.people-title p{margin:3px 0 0;color:#7A8A84;font-size:.9rem}
    .people-heading>.primary,.actions .primary{min-height:36px;padding:8px 13px;border:0;border-radius:7px;background:#2A8768;color:#fff;font-size:.86rem;font-weight:700;cursor:pointer}.primary:disabled{opacity:.55}
    .people-table{overflow:hidden;border:1px solid #E3EAE6;border-radius:12px;background:#fff;box-shadow:0 2px 5px #1B2A240a}.people-filters{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 20px;border-bottom:1px solid #E6EDE9}
    .people-search{display:flex;align-items:center;gap:9px;width:min(380px,100%);min-height:40px;padding:0 12px;border:1px solid #E3EAE6;border-radius:7px;background:#F8F9FA;color:#42536b}.people-search input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:#263630;font:inherit;font-size:.9rem}.people-result-count{color:#7A8A84;font-size:.84rem;white-space:nowrap}
    .table-wrap{overflow:auto}.people-table table{width:100%;border-collapse:collapse;color:#3F5049;font-size:.9rem;text-align:left}.people-table th{padding:11px 14px;border-bottom:1px solid #E6EDE9;background:#F8F9FA;color:#7A8A84;text-align:left;font-size:.76rem;font-weight:700;text-transform:uppercase;letter-spacing:.025em;white-space:nowrap}.people-table td{padding:11px 14px;border-top:1px solid #E9EFEC;white-space:nowrap}.people-table tbody tr:first-child td{border-top:0}
    .person-name{display:inline-flex;align-items:center;gap:11px;padding:0;border:0;background:none;color:#3F5049;text-align:left;font:inherit;cursor:pointer}.person-name strong{font-size:.9rem;font-weight:700}.person-avatar{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#2A8768;color:#fff;font-size:.7rem;font-weight:800}.people-table tbody tr:nth-child(3n + 2) .person-avatar{background:#16a34a}.people-table tbody tr:nth-child(3n) .person-avatar{background:#e87900}
    .row-actions{display:flex;align-items:center;gap:6px}.row-action{display:grid;place-items:center;width:34px;height:34px;border:1px solid #E3EAE6;border-radius:6px;background:#fff;color:#6B7D75;font-size:.9rem;cursor:pointer}.row-action:hover{border-color:#A9CDBD;background:#F4F9F6;color:#2A8768}.people-table .empty{padding:24px;text-align:center;color:#7A8A84}
    .notice,.token-box{padding:10px 12px;margin:0 0 14px;border-radius:7px;font-size:.87rem}.error{background:#fff1ef;color:#dc2626}.success{background:#f0fdf4;color:#23613a}.token-box{background:#fff8e8;color:#694d10;overflow-wrap:anywhere}.token-box code{font-size:.8rem}
    @media(max-width:760px){.people-table td,.people-table th{padding-right:10px;padding-left:10px}}
    @media(max-width:560px){.people-heading{align-items:flex-start;flex-direction:column}.people-heading>.primary{align-self:stretch}.people-filters{padding:10px}.people-search{width:100%}}
  `],
})
export class PersonListComponent implements OnInit {
  people: Person[] = [];
  members: InvitingMember[] = [];
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
  form = this.fb.group({ first_name: ['', Validators.required], last_name: ['', Validators.required], middle_name: [''], email: ['', Validators.email], phone: [''], gender: [''], date_of_birth: [''], address: [''], notes: [''], nationality: [''], profession: [''], education_level: [''], marital_status: [''], baptism_status: ['UNKNOWN'], person_type: ['INVITED' as 'INVITED' | 'NON_INVITED'], invited_by_member: [''] });
  conversionForm = this.fb.group({ church: ['', Validators.required], campus: [''], marital_status: [''], address: [''] });

  constructor(private fb: FormBuilder, private personService: PersonService, private tenantService: TenantService, private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    this.loading = true;
    forkJoin({
      people: this.personService.listPersons(),
      members: this.personService.listInviterMembers(),
      context: this.tenantService.churchContext(),
    }).subscribe({
      next: (result) => {
        this.people = result.people;
        this.members = result.members;
        this.churches = result.context.churches;
        this.campuses = result.context.campuses;
        this.conversionCampuses = result.context.campuses;
        this.churchSelectionFixed = result.context.church_selection_fixed;
        this.defaultChurchId = result.context.default_church_id;
        const editId = this.route.snapshot.queryParamMap.get('edit');
        const convertId = this.route.snapshot.queryParamMap.get('convert');
        const requestedPerson = result.people.find((person) => person.id === (editId ?? convertId));
        if (requestedPerson) {
          if (editId) this.edit(requestedPerson);
          else if (!requestedPerson.user) this.openConversion(requestedPerson);
          this.router.navigate([], { relativeTo: this.route, queryParams: { edit: null, convert: null }, queryParamsHandling: 'merge', replaceUrl: true });
        }
        this.loading = false;
      },
      error: (error) => { this.errorMessage = this.describeError(error); this.loading = false; },
    });
  }

  get filteredPeople(): Person[] { const query = this.search.trim().toLocaleLowerCase(); return this.people.filter((person) => !query || `${person.first_name} ${person.middle_name ?? ''} ${person.last_name} ${person.email ?? ''} ${person.phone ?? ''}`.toLocaleLowerCase().includes(query)); }
  onSearch(event: Event): void { this.search = (event.target as HTMLInputElement).value; }
  initials(person: Person): string { return `${person.first_name?.[0] ?? ''}${person.last_name?.[0] ?? ''}`.toUpperCase(); }
  genderLabel(value?: string | null): string { return value === 'M' ? 'Homme' : value === 'F' ? 'Femme' : 'Non renseigné'; }
  openCreate(): void { this.form.reset(); this.editingId = null; this.formError = ''; this.duplicates = []; this.formOpen = true; }
  closeForm(): void { this.formOpen = false; this.editingId = null; this.formError = ''; this.duplicates = []; this.form.reset(); }

  savePerson(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const raw = this.form.getRawValue();
    const payload = { ...raw, invited_by_member: raw.invited_by_member || null } as PersonCreateRequest;
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
  viewDetails(person: Person): void { this.openMenuId = null; this.router.navigate(['/people', person.id]); }

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
  private reload(): void { this.personService.listPersons().subscribe({ next: (items) => { this.people = items; }, error: (error) => this.errorMessage = this.describeError(error) }); }
  private clearMessages(): void { this.errorMessage = ''; this.successMessage = ''; this.invitationToken = ''; }
  private describeError(error: unknown): string { if (error instanceof HttpErrorResponse) { const body = error.error as Record<string, unknown> | string | null; if (typeof body === 'string') return body; if (body && typeof body === 'object') { if (typeof body['detail'] === 'string') return body['detail']; return Object.entries(body).map(([key, value]) => `${key} : ${Array.isArray(value) ? value.join(', ') : value}`).join(' · '); } return `Erreur API (${error.status}).`; } return 'Une erreur inattendue est survenue.'; }
}