import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Person } from '../../../core/models/person';
import { PersonService } from '../../../core/services/person.service';

type PersonDetailTab = 'information' | 'family' | 'ministries' | 'attendance' | 'finance';

@Component({
  selector: 'app-person-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="detail-page" *ngIf="person as item; else loadingState">
      <nav class="breadcrumb" aria-label="Fil d’Ariane"><a routerLink="/dashboard">ChurchOS</a><span>/</span><a routerLink="/people">Personnes</a><span>/</span><strong>Fiche personne</strong></nav>
      <header class="page-heading">
        <div><a class="back-link" routerLink="/people">← Retour aux personnes</a><h1>{{ fullName(item) }}</h1><p>Fiche de personne</p></div>
        <div class="heading-actions"><button type="button" class="button secondary" (click)="editPerson()">Modifier</button><button *ngIf="!item.user" type="button" class="button primary" (click)="convertToMember()">Convertir en membre</button></div>
      </header>

      <section class="profile-card" aria-label="Résumé de la personne">
        <span class="profile-avatar">{{ initials(item) }}</span>
        <div class="profile-identity"><h2>{{ fullName(item) }}</h2><p>{{ item.email || 'Adresse e-mail non renseignée' }}<span class="summary-separator">·</span>{{ item.user ? 'Compte lié' : 'Personne' }}</p>
          <div class="profile-badges"><span class="badge account-badge" [attr.data-linked]="!!item.user"><span class="status-dot"></span>{{ item.user ? 'Compte lié' : 'Sans compte' }}</span><span class="badge">{{ personTypeLabel(item.person_type) }}</span><span class="badge">{{ baptismLabel(item.baptism_status) }}</span><span class="badge">{{ genderLabel(item.gender) }}</span></div>
        </div>
      </section>

      <nav class="detail-tabs" aria-label="Détails de la personne" role="tablist">
        <button type="button" role="tab" id="tab-information" aria-controls="panel-information" [attr.aria-selected]="activeTab === 'information'" [class.active]="activeTab === 'information'" (click)="activeTab = 'information'">Informations</button>
        <button type="button" role="tab" id="tab-family" aria-controls="panel-family" [attr.aria-selected]="activeTab === 'family'" [class.active]="activeTab === 'family'" (click)="activeTab = 'family'">Famille</button>
        <button type="button" role="tab" id="tab-ministries" aria-controls="panel-ministries" [attr.aria-selected]="activeTab === 'ministries'" [class.active]="activeTab === 'ministries'" (click)="activeTab = 'ministries'">Ministères</button>
        <button type="button" role="tab" id="tab-attendance" aria-controls="panel-attendance" [attr.aria-selected]="activeTab === 'attendance'" [class.active]="activeTab === 'attendance'" (click)="activeTab = 'attendance'">Présence</button>
        <button type="button" role="tab" id="tab-finance" aria-controls="panel-finance" [attr.aria-selected]="activeTab === 'finance'" [class.active]="activeTab === 'finance'" (click)="activeTab = 'finance'">Finances</button>
      </nav>

      <section *ngIf="activeTab === 'information'" class="information-grid" id="panel-information" role="tabpanel" aria-labelledby="tab-information">
        <article class="info-card"><span>Prénom</span><strong>{{ item.first_name }}</strong></article>
        <article class="info-card"><span>Nom</span><strong>{{ item.last_name }}</strong></article>
        <article class="info-card"><span>Autre prénom</span><strong>{{ item.middle_name || 'Non renseigné' }}</strong></article>
        <article class="info-card"><span>Email</span><strong>{{ item.email || 'Non renseigné' }}</strong></article>
        <article class="info-card"><span>Téléphone</span><strong>{{ item.phone || 'Non renseigné' }}</strong></article>
        <article class="info-card"><span>Téléphone</span><strong>{{ item.phone || 'Non renseigné' }}</strong></article>
        <article class="info-card"><span>Date de naissance</span><strong>{{ formatDate(item.date_of_birth) }}</strong></article>
        <article class="info-card"><span>Genre</span><strong>{{ genderLabel(item.gender) }}</strong></article>
        <article class="info-card"><span>Type</span><strong>{{ personTypeLabel(item.person_type) }}</strong></article>
        <article class="info-card"><span>Situation baptismale</span><strong>{{ baptismLabel(item.baptism_status) }}</strong></article>
        <article class="info-card"><span>Invité(e) par</span><strong>{{ item.invited_by_member_name || 'Non renseigné' }}</strong></article>
        <article class="info-card"><span>Nationalité</span><strong>{{ item.nationality || 'Non renseignée' }}</strong></article>
        <article class="info-card"><span>Profession</span><strong>{{ item.profession || 'Non renseignée' }}</strong></article>
        <article class="info-card"><span>Niveau d’étude</span><strong>{{ item.education_level || 'Non renseigné' }}</strong></article>
        <article class="info-card"><span>Situation matrimoniale</span><strong>{{ maritalLabel(item.marital_status) }}</strong></article>
        <article class="info-card"><span>Adresse</span><strong>{{ item.address || 'Non renseignée' }}</strong></article>
        <article class="info-card"><span>Compte utilisateur</span><strong>{{ item.user ? 'Compte associé' : 'Aucun compte associé' }}</strong></article>
        <article class="info-card"><span>Créée le</span><strong>{{ formatDate(item.created_at) }}</strong></article>
        <article class="info-card notes-card"><span>Notes</span><strong>{{ item.notes || 'Aucune note renseignée' }}</strong></article>
      </section>

      <section *ngIf="activeTab !== 'information'" class="tab-panel" [id]="'panel-' + activeTab" role="tabpanel" [attr.aria-labelledby]="'tab-' + activeTab">
        <ng-container [ngSwitch]="activeTab">
          <div *ngSwitchCase="'family'"><h2>Famille</h2><p class="tab-note">Les liens familiaux ne sont pas renseignés sur cette fiche.</p><a class="tab-link" routerLink="/families">Ouvrir le répertoire Familles</a></div>
          <div *ngSwitchCase="'ministries'"><h2>Ministères</h2><p class="tab-note">Les affectations de ministère ne sont pas disponibles pour cette personne.</p><a class="tab-link" routerLink="/ministries">Ouvrir les Ministères</a></div>
          <div *ngSwitchCase="'attendance'"><h2>Présence</h2><p class="tab-note">Aucun historique de présence associé à cette fiche.</p><a class="tab-link" routerLink="/attendance">Ouvrir le module Présence</a></div>
          <div *ngSwitchCase="'finance'"><h2>Finances</h2><p class="tab-note">Aucune information financière associée à cette fiche.</p><a class="tab-link" routerLink="/finance">Ouvrir le module Finances</a></div>
        </ng-container>
      </section>
    </section>
    <ng-template #loadingState><p class="loading-state">{{ loading ? 'Chargement de la fiche…' : errorMessage }}</p></ng-template>
  `,
  styles: [`
    :host{display:block;color:#1B2A24}.detail-page{max-width:1440px;margin:0 auto;padding:4px 0 32px}
    .breadcrumb{display:flex;align-items:center;gap:9px;margin:0 0 22px;color:#7A8A84;font-size:.82rem}.breadcrumb a{color:#6B7D75;text-decoration:none}.breadcrumb strong{color:#1B2A24}
    .page-heading{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:20px}.back-link{display:inline-block;margin-bottom:9px;color:#2A8768;font-size:.88rem;text-decoration:none}
    .page-heading h1{margin:0;font-size:1.42rem;font-weight:750;letter-spacing:-.025em}.page-heading p{margin:3px 0 0;color:#7A8A84;font-size:.9rem}
    .heading-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}.button{min-height:37px;padding:8px 13px;border:1px solid #E1E8E4;border-radius:8px;background:#fff;color:#1B2A24;font-size:.84rem;font-weight:650;cursor:pointer}
    .button.primary{border-color:#2A8768;background:#2A8768;color:#fff}.profile-card{display:flex;align-items:center;gap:20px;min-height:122px;padding:20px 26px;border:1px solid #E3EAE6;border-radius:13px;background:#fff;box-shadow:0 2px 4px #1B2A240a}
    .profile-avatar{display:grid;place-items:center;flex:0 0 72px;width:72px;height:72px;border-radius:13px;background:#2A8768;color:#fff;font-size:1.45rem;font-weight:800}
    .profile-identity{min-width:0;flex:1}.profile-identity h2{margin:0 0 3px;font-size:1.22rem;font-weight:750}.profile-identity>p{margin:0 0 10px;color:#7A8A84;font-size:.9rem}.summary-separator{margin:0 6px}
    .profile-badges{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.badge{display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border:1px solid #E3EAE6;border-radius:6px;background:#F8F9FA;color:#3F5049;font-size:.78rem;line-height:1.2}
    .account-badge{border-color:transparent;background:#ecfdf3;color:#159447}.account-badge[data-linked=false]{background:#fff7e6;color:#b7791f}.status-dot{width:7px;height:7px;border-radius:50%;background:currentColor}
    .detail-tabs{display:flex;justify-content:flex-start;gap:2px;margin:12px 0 17px;border-bottom:1px solid #E3E9E5;overflow-x:auto}
    .detail-tabs button{position:relative;flex:0 0 auto;padding:13px 10px 12px;border:0;background:transparent;color:#6F8079;font-size:.91rem;cursor:pointer}
    .detail-tabs button.active{color:#2A8768}.detail-tabs button.active:after{position:absolute;right:0;bottom:-1px;left:0;height:3px;background:#2A8768;content:""}
    .information-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.info-card{display:grid;align-content:center;gap:4px;min-height:67px;padding:12px 16px;border:1px solid #E3EAE6;border-radius:9px;background:#F8F9FA}
    .info-card span{color:#7A8A84;font-size:.77rem;font-weight:650;text-transform:uppercase;letter-spacing:.025em}.info-card strong{color:#1B2A24;font-size:.93rem;font-weight:550;overflow-wrap:anywhere}.notes-card{grid-column:1/-1}
    .tab-panel{padding:16px;border:1px solid #E3EAE6;border-radius:9px}.tab-panel h2{margin:0 0 10px}.tab-note{color:#7A8A84}.tab-link{color:#2A8768;text-decoration:none}.loading-state{padding:30px;color:#7A8A84}
    @media(max-width:760px){.page-heading{align-items:flex-start;flex-direction:column}.heading-actions{justify-content:flex-start}.profile-card{align-items:flex-start;gap:14px;padding:16px}.profile-avatar{flex-basis:58px;width:58px;height:58px}.information-grid{grid-template-columns:1fr}.notes-card{grid-column:auto}.detail-tabs button{padding-right:8px;padding-left:8px}}
  `],
})
export class PersonDetailComponent implements OnInit {
  person: Person | null = null;
  loading = true;
  errorMessage = '';
  activeTab: PersonDetailTab = 'information';

  constructor(private route: ActivatedRoute, private router: Router, private personService: PersonService) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.errorMessage = 'Identifiant personne absent.'; this.loading = false; return; }
    this.personService.getPerson(id).subscribe({
      next: (person) => { this.person = person; this.loading = false; },
      error: (error: unknown) => { this.errorMessage = this.describeError(error); this.loading = false; },
    });
  }

  fullName(person: Person): string { return [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' '); }
  initials(person: Person): string { return `${person.first_name?.[0] ?? ''}${person.last_name?.[0] ?? ''}`.toUpperCase(); }
  genderLabel(value?: string | null): string { return value === 'M' ? 'Homme' : value === 'F' ? 'Femme' : 'Non renseigné'; }
  personTypeLabel(value?: string): string { return value === 'INVITED' ? 'Invité(e)' : value === 'NON_INVITED' ? 'Non invité(e)' : 'Type non renseigné'; }
  baptismLabel(value?: string): string { return ({ UNKNOWN: 'Non renseignée', NOT_BAPTIZED: 'Non baptisé(e)', IN_PREPARATION: 'En préparation', BAPTIZED: 'Baptisé(e)' } as Record<string, string>)[value ?? ''] ?? 'Non renseignée'; }
  maritalLabel(value?: string | null): string { return ({ single: 'Célibataire', married: 'Marié(e)', divorced: 'Divorcé(e)', widowed: 'Veuf/veuve' } as Record<string, string>)[value ?? ''] ?? value ?? 'Non renseignée'; }
  formatDate(value?: string | null): string {
    if (!value) return 'Non renseignée';
    const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
    return Number.isNaN(date.getTime()) ? 'Non renseignée' : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  }
  editPerson(): void { if (this.person) this.router.navigate(['/people'], { queryParams: { edit: this.person.id } }); }
  convertToMember(): void { if (this.person && !this.person.user) this.router.navigate(['/people'], { queryParams: { convert: this.person.id } }); }

  private describeError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as Record<string, unknown> | string | null;
      if (typeof body === 'string') return body;
      if (body && typeof body === 'object') { if (typeof body['detail'] === 'string') return body['detail']; return Object.entries(body).map(([key, value]) => `${key} : ${Array.isArray(value) ? value.join(', ') : value}`).join(' · '); }
      return `Erreur API (${error.status}).`;
    }
    return 'Une erreur inattendue est survenue.';
  }
}
