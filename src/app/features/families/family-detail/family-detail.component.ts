import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Family, FamilyMemberRecord } from '../../../core/models/family';
import { FamilyService } from '../../../core/services/family.service';

type FamilyDetailTab = 'information' | 'family' | 'ministries' | 'attendance' | 'finance';

@Component({
  selector: 'app-family-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="detail-page family-detail-page" *ngIf="family as item; else loadingState">
      <nav class="breadcrumb" aria-label="Fil d’Ariane">
        <a routerLink="/dashboard">ChurchOS</a><span>/</span><a routerLink="/families">Familles</a><span>/</span><strong>Fiche famille</strong>
      </nav>

      <header class="page-heading">
        <div>
          <a class="back-link" routerLink="/families">← Retour aux familles</a>
          <h1>{{ item.name }}</h1>
          <p>Profil famille</p>
        </div>
        <div class="heading-actions">
          <button type="button" class="button secondary" (click)="editFamily()">Modifier</button>
          <button type="button" class="button primary" (click)="addFamilyMember()">Ajouter un membre</button>
        </div>
      </header>

      <p *ngIf="errorMessage" class="notice error" role="alert">{{ errorMessage }}</p>

      <section class="profile-card" aria-label="Résumé de la famille">
        <span class="profile-avatar">{{ initials(item.name) }}</span>
        <div class="profile-identity">
          <h2>{{ item.name }}</h2>
          <p>{{ item.primary_contact_name || item.phone || 'Coordonnées non renseignées' }}<span class="summary-separator">·</span>Famille depuis {{ memberSince(item.created_at) }}</p>
          <div class="profile-badges">
            <span class="badge status-badge" [attr.data-status]="item.status"><span class="status-dot"></span>{{ statusLabel(item.status) }}</span>
            <span class="badge">{{ familyMembers.length }} membre(s)</span>
            <span class="badge" *ngIf="item.neighborhood">{{ item.neighborhood }}</span>
            <span class="badge church-badge" *ngIf="item.ministry">{{ item.ministry }}</span>
          </div>
        </div>
        <div class="last-login">
          <span>Contact principal</span>
          <strong>{{ item.primary_contact_name || 'Non renseigné' }}</strong>
        </div>
      </section>

      <nav class="detail-tabs" aria-label="Détails de la famille" role="tablist">
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
      </nav>

      <section *ngIf="activeTab === 'information'" class="information-grid" id="panel-information"
        role="tabpanel" aria-labelledby="tab-information">
        <article class="info-card"><span>Nom de la famille</span><strong>{{ item.name }}</strong></article>
        <article class="info-card"><span>Contact principal</span><strong>{{ item.primary_contact_name || 'Non renseigné' }}</strong></article>
        <article class="info-card"><span>Email</span><strong>{{ item.email || 'Non renseigné' }}</strong></article>
        <article class="info-card"><span>Téléphone</span><strong>{{ item.primary_contact_phone || item.phone || 'Non renseigné' }}</strong></article>
        <article class="info-card"><span>Adresse</span><strong>{{ item.address || 'Non renseignée' }}</strong></article>
        <article class="info-card"><span>Quartier</span><strong>{{ item.neighborhood || 'Non renseigné' }}</strong></article>
        <article class="info-card"><span>Ministère</span><strong>{{ item.ministry || 'Non renseigné' }}</strong></article>
        <article class="info-card"><span>Statut</span><strong>{{ statusLabel(item.status) }}</strong></article>
        <article class="info-card"><span>Créée le</span><strong>{{ formatDate(item.created_at) }}</strong></article>
        <article class="info-card"><span>Mise à jour le</span><strong>{{ formatDate(item.updated_at) }}</strong></article>
        <article class="info-card notes-card"><span>Notes</span><strong>{{ item.notes || 'Aucune note renseignée' }}</strong></article>
      </section>

      <section *ngIf="activeTab === 'family'" class="tab-panel roster-panel" id="panel-family"
        role="tabpanel" aria-labelledby="tab-family">
        <header class="roster-heading">
          <div><h2>Composition de la famille</h2><p>Personnes et membres de l’église rattachés à ce foyer.</p></div>
          <span class="count">{{ familyMembers.length }}</span>
        </header>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Nom</th><th>Profil</th><th>Lien familial</th><th>Contact</th><th>Contact principal</th><th>Depuis</th></tr></thead>
            <tbody>
              <tr *ngFor="let link of familyMembers">
                <td><strong>{{ link.member_name || link.person_name || 'Profil sans nom' }}</strong></td>
                <td>{{ link.member ? 'Membre de l’église' : 'Personne' }}</td>
                <td>{{ relationshipLabel(link.relationship_type) }}</td>
                <td>{{ link.email || link.phone || '—' }}</td>
                <td><span class="primary-contact" *ngIf="link.is_primary_contact">Oui</span><span *ngIf="!link.is_primary_contact">—</span></td>
                <td>{{ formatDate(link.joined_at) }}</td>
              </tr>
              <tr *ngIf="!familyMembers.length"><td colspan="6" class="empty">Aucun membre n’est encore rattaché à cette famille.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section *ngIf="activeTab !== 'information' && activeTab !== 'family'" class="tab-panel"
        [id]="'panel-' + activeTab" role="tabpanel" [attr.aria-labelledby]="'tab-' + activeTab">
        <ng-container [ngSwitch]="activeTab">
          <div *ngSwitchCase="'ministries'">
            <h2>Ministère</h2>
            <p class="tab-note">{{ item.ministry || 'Aucun ministère renseigné pour cette famille.' }}</p>
            <a class="tab-link" routerLink="/ministries">Ouvrir les Ministères</a>
          </div>
          <div *ngSwitchCase="'attendance'">
            <h2>Présence</h2>
            <p class="tab-note">L’historique de présence de la famille n’est pas disponible dans cette fiche.</p>
            <a class="tab-link" routerLink="/attendance">Ouvrir le module Présence</a>
          </div>
          <div *ngSwitchCase="'finance'">
            <h2>Finances</h2>
            <p class="tab-note">Les informations financières de la famille ne sont pas disponibles dans cette fiche.</p>
            <a class="tab-link" routerLink="/finance">Ouvrir le module Finances</a>
          </div>
        </ng-container>
      </section>
    </section>
    <ng-template #loadingState><p class="loading-state">{{ loading ? 'Chargement de la famille…' : errorMessage }}</p></ng-template>
  `,
  styles: [`
    :host{display:block;color:#1B2A24}.detail-page{max-width:1440px;margin:0 auto;padding:4px 0 32px}
    .breadcrumb{display:flex;align-items:center;gap:9px;margin:0 0 22px;color:#7A8A84;font-size:.82rem}.breadcrumb a{color:#6B7D75;text-decoration:none}.breadcrumb strong{color:#1B2A24}
    .page-heading{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:20px}.back-link{display:inline-block;margin-bottom:9px;color:#2A8768;font-size:.88rem;text-decoration:none}
    .page-heading h1{margin:0;font-size:1.42rem;font-weight:750;letter-spacing:-.025em}.page-heading p{margin:3px 0 0;color:#7A8A84;font-size:.9rem}
    .heading-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}.button{min-height:37px;padding:8px 13px;border:1px solid #E1E8E4;border-radius:8px;background:#fff;color:#1B2A24;font-size:.84rem;font-weight:650;text-decoration:none;cursor:pointer}
    .button.primary{border-color:#2A8768;background:#2A8768;color:#fff}
    .profile-card{display:flex;align-items:center;gap:20px;min-height:122px;padding:20px 26px;border:1px solid #E3EAE6;border-radius:13px;background:#fff;box-shadow:0 2px 4px #1B2A240a}
    .profile-avatar{display:grid;place-items:center;flex:0 0 72px;width:72px;height:72px;border-radius:13px;background:#2A8768;color:#fff;font-size:1.45rem;font-weight:800}
    .profile-identity{min-width:0;flex:1}.profile-identity h2{margin:0 0 3px;font-size:1.22rem;font-weight:750}.profile-identity>p{margin:0 0 10px;color:#7A8A84;font-size:.9rem}.summary-separator{margin:0 6px}
    .profile-badges{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.badge{display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border:1px solid #E3EAE6;border-radius:6px;background:#F8F9FA;color:#3F5049;font-size:.78rem;line-height:1.2}
    .status-badge{border-color:transparent;background:#ecfdf3;color:#159447}.status-badge[data-status="FOLLOW_UP"]{background:#fff7e6;color:#b7791f}.status-badge[data-status="INACTIVE"],.status-badge[data-status="ARCHIVED"]{background:#fff0f0;color:#c53030}
    .status-dot{width:7px;height:7px;border-radius:50%;background:currentColor}.church-badge{border-color:#E5F1EB;background:#F0F7F3;color:#2A8768}
    .last-login{display:grid;gap:3px;min-width:175px;margin-left:auto;text-align:right;color:#7A8A84;font-size:.82rem}.last-login strong{color:#1B2A24;font-size:.88rem;font-weight:650}
    .detail-tabs{display:flex;justify-content:flex-start;gap:2px;margin:12px 0 17px;border-bottom:1px solid #E3E9E5;overflow-x:auto}
    .detail-tabs button{position:relative;flex:0 0 auto;padding:13px 10px 12px;border:0;background:transparent;color:#6F8079;font-size:.91rem;cursor:pointer}
    .detail-tabs button.active{color:#2A8768}.detail-tabs button.active:after{position:absolute;right:0;bottom:-1px;left:0;height:3px;background:#2A8768;content:""}
    .information-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.info-card{display:grid;align-content:center;gap:4px;min-height:67px;padding:12px 16px;border:1px solid #E3EAE6;border-radius:9px;background:#F8F9FA}
    .info-card>span{color:#7A8A84;font-size:.77rem;font-weight:650;text-transform:uppercase;letter-spacing:.025em}.info-card strong{color:#1B2A24;font-size:.93rem;font-weight:550;overflow-wrap:anywhere}.notes-card{grid-column:1/-1}
    .tab-panel{padding:16px;border:1px solid #E3EAE6;border-radius:9px;background:#fff}.tab-note{color:#7A8A84}.tab-link{color:#2A8768;text-decoration:none}
    .tab-panel h2{margin:0 0 5px;font-size:1rem}
    .loading-state{padding:28px;color:#7A8A84}
    @media(max-width:760px){.page-heading{align-items:flex-start;flex-direction:column}.heading-actions{justify-content:flex-start}.profile-card{align-items:flex-start;gap:14px;padding:16px}.profile-avatar{flex-basis:58px;width:58px;height:58px}.last-login{min-width:0}.information-grid{grid-template-columns:1fr}.notes-card{grid-column:auto}.detail-tabs button{padding-right:8px;padding-left:8px}}
    @media(max-width:520px){.profile-card{flex-wrap:wrap}.profile-identity{flex-basis:calc(100% - 76px)}.last-login{width:100%;margin:0;padding-top:10px;border-top:1px solid #edf0f5;text-align:left}.breadcrumb{margin-bottom:16px}}
  `],
})
export class FamilyDetailComponent implements OnInit {
  family: Family | null = null;
  familyMembers: FamilyMemberRecord[] = [];
  loading = true;
  errorMessage = '';
  activeTab: FamilyDetailTab = 'information';

  constructor(private route: ActivatedRoute, private router: Router, private familyService: FamilyService) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.errorMessage = 'Identifiant famille absent.'; this.loading = false; return; }
    forkJoin({ family: this.familyService.getFamily(id), members: this.familyService.getFamilyMembers(id) }).subscribe({
      next: ({ family, members }) => { this.family = family; this.familyMembers = members; this.loading = false; },
      error: (error) => { this.errorMessage = this.describeError(error); this.loading = false; },
    });
  }

  initials(name: string): string { return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase() || '?'; }
  statusLabel(value?: string): string { return ({ ACTIVE: 'Active', FOLLOW_UP: 'En suivi', INACTIVE: 'Inactive', ARCHIVED: 'Archivée' } as Record<string, string>)[value ?? ''] ?? 'Non définie'; }
  relationshipLabel(value: FamilyMemberRecord['relationship_type']): string { return ({ HEAD: 'Responsable', SPOUSE: 'Conjoint(e)', CHILD: 'Enfant', PARENT: 'Parent', SIBLING: 'Frère / sœur', OTHER: 'Autre' } as Record<string, string>)[value] ?? value; }

  memberSince(value?: string): string {
    if (!value) return 'date non renseignée';
    const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
    return Number.isNaN(date.getTime()) ? 'date non renseignée' : new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(date);
  }

  formatDate(value?: string): string {
    if (!value) return 'Non renseignée';
    const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
    return Number.isNaN(date.getTime()) ? 'Non renseignée' : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  }

  editFamily(): void { if (this.family) this.router.navigate(['/families'], { queryParams: { edit: this.family.id } }); }
  addFamilyMember(): void { if (this.family) this.router.navigate(['/families'], { queryParams: { addMember: this.family.id } }); }

  private describeError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as Record<string, unknown> | string | null;
      if (typeof body === 'string') return body;
      if (body && typeof body === 'object') {
        if (typeof body['detail'] === 'string') return body['detail'];
        return Object.entries(body).map(([key, value]) => `${key} : ${Array.isArray(value) ? value.join(', ') : value}`).join(' · ');
      }
      return `Erreur API (${error.status}).`;
    }
    return 'Une erreur inattendue est survenue.';
  }
}
