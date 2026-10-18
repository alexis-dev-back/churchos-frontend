import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Family, FamilyMemberRecord } from '../../../core/models/family';
import { FamilyService } from '../../../core/services/family.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="family-detail" *ngIf="family as item; else loadingState">
      <div class="breadcrumb"><a routerLink="/families">Familles</a><span>/</span><span>{{ item.name }}</span></div>
      <header class="detail-heading"><div><p class="eyebrow">DOSSIER FAMILLE</p><h1>{{ item.name }}</h1><p>{{ item.address || 'Adresse non renseignée' }}</p></div><a class="back-button" routerLink="/families">Retour aux familles</a></header>
      <p *ngIf="errorMessage" class="notice error" role="alert">{{ errorMessage }}</p>
      <div class="cards">
        <section class="panel"><header><h2>Informations de la famille</h2><span class="status" [attr.data-status]="item.status">{{ statusLabel(item.status) }}</span></header><dl class="facts"><dt>Nom</dt><dd>{{ item.name }}</dd><dt>Adresse</dt><dd>{{ item.address || '—' }}</dd><dt>Quartier</dt><dd>{{ item.neighborhood || '—' }}</dd><dt>Ministère</dt><dd>{{ item.ministry || '—' }}</dd><dt>Téléphone</dt><dd>{{ item.phone || '—' }}</dd><dt>Email</dt><dd>{{ item.email || '—' }}</dd><dt>Créée le</dt><dd>{{ item.created_at | date:'dd/MM/yyyy' }}</dd><dt>Notes</dt><dd>{{ item.notes || '—' }}</dd></dl></section>
        <section class="panel summary"><header><h2>Composition</h2></header><strong>{{ familyMembers.length }}</strong><span>personne(s) associée(s)</span><p>Les personnes et membres apparaissent selon le profil avec lequel ils ont été rattachés.</p><a routerLink="/families">Gérer les rattachements</a></section>
      </div>
      <section class="panel roster"><header><div><h2>Membres de la famille</h2><p>Personnes et membres de l’église rattachés à ce foyer.</p></div><span class="count">{{ familyMembers.length }}</span></header>
        <div class="table-wrap"><table><thead><tr><th>Nom</th><th>Profil</th><th>Lien familial</th><th>Contact</th><th>Contact principal</th><th>Depuis</th></tr></thead><tbody>
          <tr *ngFor="let link of familyMembers"><td><strong>{{ link.member_name || link.person_name || 'Profil sans nom' }}</strong></td><td>{{ link.member ? 'Membre de l’église' : 'Personne' }}</td><td>{{ relationshipLabel(link.relationship_type) }}</td><td>{{ link.email || link.phone || '—' }}</td><td><span class="primary-contact" *ngIf="link.is_primary_contact">Oui</span><span *ngIf="!link.is_primary_contact">—</span></td><td>{{ link.joined_at | date:'dd/MM/yyyy' }}</td></tr>
          <tr *ngIf="!familyMembers.length"><td colspan="6" class="empty">Aucun membre n’est encore rattaché à cette famille.</td></tr>
        </tbody></table></div>
      </section>
    </section>
    <ng-template #loadingState><p class="loading-state">{{ loading ? 'Chargement de la famille…' : errorMessage }}</p></ng-template>
  `,
  styles: [`
    :host{display:block;color:#25323a}.family-detail{max-width:1320px;margin:0 auto;padding:18px 0 30px}.breadcrumb{display:flex;gap:9px;margin-bottom:20px;color:#77848a;font-size:.78rem}.breadcrumb a{color:#176b50;text-decoration:none}.detail-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:18px}.eyebrow{margin:0 0 5px;color:#198455;font-size:.7rem;font-weight:800}.detail-heading h1{margin:0;font-size:1.6rem}.detail-heading p:last-child{margin:5px 0 0;color:#748188;font-size:.85rem}.back-button{padding:9px 12px;border:1px solid #dce3e3;color:#34434a;background:#fff;text-decoration:none;font-size:.8rem;font-weight:700}.cards{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(260px,.7fr);gap:14px;margin-bottom:14px}.panel{padding:18px;background:#fff;border:1px solid #e0e6e6}.panel>header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px;padding-bottom:11px;border-bottom:1px solid #edf0f0}.panel h2{margin:0;font-size:.98rem}.facts{display:grid;grid-template-columns:130px 1fr;gap:12px;margin:0}.facts dt{color:#78858a;font-size:.76rem}.facts dd{margin:0;font-size:.83rem;overflow-wrap:anywhere}.summary{display:flex;flex-direction:column;align-items:flex-start}.summary>strong{font-size:2rem;color:#0b4939}.summary>span{color:#66757a;font-size:.8rem}.summary p{margin:13px 0;color:#75838a;font-size:.8rem;line-height:1.5}.summary a{margin-top:auto;color:#176b50;font-size:.8rem;font-weight:700;text-decoration:none}.count{display:grid;place-items:center;min-width:32px;height:32px;background:#e1efe7;color:#176b50;font-weight:800}.roster>header p{margin:5px 0 0;color:#76838a;font-size:.78rem}.table-wrap{overflow:auto}table{width:100%;min-width:720px;border-collapse:collapse}thead{background:#dcece5}th,td{padding:11px 12px;text-align:left;font-size:.78rem}th{color:#34464a;font-weight:700}td{border-top:1px solid #edf0f0;color:#46545a}.primary-contact{padding:4px 7px;background:#e2f2e8;color:#1d7048;font-size:.7rem;font-weight:800}.empty{padding:20px;text-align:center;color:#78858a}.notice{padding:10px 12px;margin-bottom:14px}.notice.error{background:#fff0ef;color:#a13333}.loading-state{padding:28px;color:#728087}@media(max-width:760px){.cards{grid-template-columns:1fr}.detail-heading{align-items:flex-start;flex-direction:column}.facts{grid-template-columns:110px 1fr}}
  `],
})
export class FamilyDetailComponent implements OnInit {
  family: Family | null = null;
  familyMembers: FamilyMemberRecord[] = [];
  loading = true;
  errorMessage = '';

  constructor(private route: ActivatedRoute, private familyService: FamilyService) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.errorMessage = 'Identifiant famille absent.'; this.loading = false; return; }
    forkJoin({ family: this.familyService.getFamily(id), members: this.familyService.getFamilyMembers(id) }).subscribe({
      next: ({ family, members }) => { this.family = family; this.familyMembers = members; this.loading = false; },
      error: (error) => { this.errorMessage = this.describeError(error); this.loading = false; },
    });
  }

  relationshipLabel(value: string): string { return ({ HEAD: 'Responsable', SPOUSE: 'Conjoint(e)', CHILD: 'Enfant', PARENT: 'Parent', SIBLING: 'Frère / sœur', OTHER: 'Autre' } as Record<string, string>)[value] ?? value; }
  statusLabel(value?: string): string { return ({ ACTIVE: 'Active', FOLLOW_UP: 'En suivi', INACTIVE: 'Inactive', ARCHIVED: 'Archivée' } as Record<string, string>)[value ?? ''] ?? 'Non définie'; }
  private describeError(error: unknown): string { if (error instanceof HttpErrorResponse) { const body = error.error as Record<string, unknown> | string | null; if (typeof body === 'string') return body; if (body && typeof body === 'object' && typeof body['detail'] === 'string') return body['detail']; return `Erreur API (${error.status}).`; } return 'Une erreur inattendue est survenue.'; }
}