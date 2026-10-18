import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Member } from '../../../core/models/member';
import { Campus, Church } from '../../../core/models/tenant';
import { AuthService } from '../../../core/services/auth.service';
import { MemberService } from '../../../core/services/member.service';
import { TenantService } from '../../../core/services/tenant.service';

@Component({
  selector: 'app-member-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="detail-page" *ngIf="member as item; else loadingState">
      <div class="breadcrumb"><a routerLink="/members">Membres</a><span>/</span><span>Fiche {{ item.id.slice(0, 8) }}</span></div>
      <header class="page-heading">
        <div class="person-heading"><span class="avatar">{{ initials(item) }}</span><div><p class="eyebrow">DOSSIER MEMBRE</p><h1>{{ item.first_name }} {{ item.last_name }}</h1><p>{{ item.email }}</p></div></div>
        <div class="heading-actions"><span class="status" [attr.data-status]="item.status">{{ statusLabel(item.status) }}</span><a class="button secondary" routerLink="/members">Retour à la liste</a><button *ngIf="canManage && item.status === 'PENDING'" type="button" class="button primary" (click)="sendInvitation()">Renvoyer l’invitation</button><button *ngIf="canManage && item.status === 'ACTIVE'" type="button" class="button danger" (click)="confirmSuspend = true">Suspendre l’accès</button></div>
      </header>
      <p *ngIf="feedback" class="notice" [class.error]="feedbackIsError" role="status">{{ feedback }}</p>
      <p *ngIf="invitationToken" class="token">Code d’invitation (5 chiffres) : <code>{{ invitationToken }}</code></p>

      <div class="detail-grid-panels">
        <section class="panel identity-panel"><header class="panel-heading"><h2>Coordonnées</h2><span class="panel-action">{{ item.member_since ? 'Membre depuis ' + item.member_since : 'Profil membre' }}</span></header><dl class="facts"><dt>Email</dt><dd>{{ item.email || 'Non renseigné' }}</dd><dt>Téléphone</dt><dd>{{ item.phone || 'Non renseigné' }}</dd><dt>Date de naissance</dt><dd>{{ item.date_of_birth || 'Non renseignée' }}</dd><dt>Genre</dt><dd>{{ genderLabel(item.gender) }}</dd><dt>Situation familiale</dt><dd>{{ maritalLabel(item.marital_status) }}</dd></dl></section>
        <section class="panel assignment-panel"><header class="panel-heading"><h2>Affectation</h2><span class="status-dot">Organisation active</span></header><div class="assignment"><span class="assignment-icon">É</span><div><small>ÉGLISE</small><strong>{{ churchName(item.church) }}</strong></div></div><div class="assignment"><span class="assignment-icon campus-icon">C</span><div><small>CAMPUS</small><strong>{{ campusName(item.campus) }}</strong></div></div><div class="address-block"><small>ADRESSE</small><p>{{ item.address || 'Aucune adresse enregistrée.' }}</p></div></section>
        <section class="panel access-panel"><header class="panel-heading"><h2>Compte et accès</h2></header><div class="access-summary"><span class="access-icon">{{ item.status === 'ACTIVE' ? '✓' : '!' }}</span><div><strong>{{ accessTitle(item.status) }}</strong><p>{{ accessDescription(item.status) }}</p></div></div><div class="access-meta"><span>Identifiant membre</span><code>{{ item.id }}</code></div><div class="access-meta"><span>Créé le</span><span>{{ item.created_at | date:'dd/MM/yyyy' }}</span></div></section>
        <section class="panel notes-panel"><header class="panel-heading"><h2>Notes</h2></header><p class="notes-empty">Aucune note supplémentaire dans le dossier membre.</p></section>
      </div>

      <div class="modal-backdrop" *ngIf="confirmSuspend" (click)="confirmSuspend = false"><section class="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="suspend-title" (click)="$event.stopPropagation()"><span class="warning-mark">!</span><h2 id="suspend-title">Suspendre les accès ?</h2><p>{{ item.first_name }} {{ item.last_name }} ne pourra plus se connecter jusqu’à réactivation.</p><div class="confirm-actions"><button type="button" class="button danger" (click)="suspend()">Confirmer la suspension</button><button type="button" class="button secondary" (click)="confirmSuspend = false">Annuler</button></div></section></div>
    </section>
    <ng-template #loadingState><p class="loading-state">{{ loading ? 'Chargement de la fiche…' : errorMessage }}</p></ng-template>
  `,
  styles: [`
    :host{display:block;color:#25323a}.detail-page{max-width:1440px;margin:0 auto;padding:18px 0 32px}.breadcrumb{display:flex;gap:9px;align-items:center;margin:0 0 20px;color:#77848a;font-size:.78rem}.breadcrumb a{color:#176b50;text-decoration:none}.page-heading,.person-heading,.heading-actions,.panel-heading{display:flex;align-items:center}.page-heading{justify-content:space-between;gap:20px;margin-bottom:20px}.person-heading{gap:14px}.avatar{display:grid;place-items:center;width:52px;height:52px;background:#dcebe3;color:#10533c;font-size:1.1rem;font-weight:800}.eyebrow{margin:0 0 5px;color:#198455;font-size:.69rem;font-weight:800}.page-heading h1{margin:0;font-size:1.55rem}.person-heading p:last-child{margin:4px 0 0;color:#748188;font-size:.86rem}.heading-actions{justify-content:flex-end;gap:8px;flex-wrap:wrap}.button{min-height:37px;padding:8px 12px;border:1px solid #d9e1df;background:#fff;color:#34434a;font-size:.8rem;font-weight:700;text-decoration:none;cursor:pointer}.button.primary{border-color:#0b4939;background:#0b4939;color:#fff}.button.danger{border-color:#c43e3e;background:#c43e3e;color:#fff}.status{padding:6px 10px;background:#e5f3e9;color:#23734a;font-size:.73rem;font-weight:800}.status[data-status="PENDING"]{background:#fff3d8;color:#8a6117}.status[data-status="SUSPENDED"],.status[data-status="ARCHIVED"]{background:#fde9e8;color:#9e3434}.detail-grid-panels{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(300px,.85fr);gap:14px}.panel{min-width:0;padding:18px;background:#fff;border:1px solid #e0e6e6}.panel-heading{justify-content:space-between;gap:12px;margin-bottom:15px;padding-bottom:11px;border-bottom:1px solid #edf0f0}.panel-heading h2{margin:0;font-size:.97rem;font-weight:700}.panel-action,.status-dot{color:#75838a;font-size:.72rem}.facts{display:grid;grid-template-columns:minmax(125px,.65fr) minmax(0,1fr);gap:13px 18px;margin:0}.facts dt,.address-block small{color:#7b878c;font-size:.75rem}.facts dd{margin:0;color:#303e44;font-size:.82rem;overflow-wrap:anywhere}.assignment{display:flex;align-items:center;gap:12px;margin:8px 0 16px}.assignment-icon{display:grid;place-items:center;width:38px;height:38px;background:#e0f1e7;color:#178151;font-weight:800}.campus-icon{background:#e5eaf7;color:#536bb3}.assignment div{display:grid;gap:4px}.assignment small,.access-meta{color:#7b878c;font-size:.68rem}.assignment strong{font-size:.84rem}.address-block{padding-top:11px;border-top:1px solid #edf0f0}.address-block p{margin:6px 0 0;font-size:.82rem}.access-summary{display:flex;align-items:center;gap:12px;padding:4px 0 14px}.access-icon{display:grid;place-items:center;width:40px;height:40px;background:#e4f3e9;color:#19814f;font-size:1.1rem;font-weight:800}.access-summary strong{font-size:.86rem}.access-summary p{margin:4px 0 0;color:#77848a;font-size:.75rem;line-height:1.4}.access-meta{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid #edf0f0}.access-meta code{max-width:60%;overflow:hidden;text-overflow:ellipsis;color:#4a565c;font-size:.66rem}.notes-panel{grid-column:1/-1}.notes-empty{margin:0;color:#78858a;font-size:.82rem}.notice,.token{padding:10px 12px;margin:0 0 14px;background:#e7f3eb;color:#256844;font-size:.84rem}.notice.error{background:#fff0ef;color:#a13333}.token{background:#fff6df;color:#725314;overflow-wrap:anywhere}.loading-state{padding:30px;color:#728087}.modal-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:#17262480}.modal{width:min(480px,100%);padding:24px;background:#fff;box-shadow:0 24px 80px #10221f40}.confirm-modal{text-align:center}.warning-mark{display:grid;place-items:center;width:44px;height:44px;margin:auto;background:#fff1df;color:#9c5a0e;font-size:1.5rem;font-weight:800}.confirm-modal h2{margin:12px 0 8px;font-size:1.1rem}.confirm-modal p{color:#69777d;font-size:.85rem;line-height:1.5}.confirm-actions{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:18px}@media(max-width:760px){.page-heading{align-items:flex-start;flex-direction:column}.heading-actions{justify-content:flex-start}.detail-grid-panels{grid-template-columns:1fr}.notes-panel{grid-column:auto}.facts{grid-template-columns:115px 1fr}}@media(max-width:480px){.page-heading h1{font-size:1.3rem}.panel{padding:14px}.facts{grid-template-columns:1fr;gap:5px}.facts dd{margin-bottom:8px}}
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

  constructor(private route: ActivatedRoute, private router: Router, private memberService: MemberService, private tenantService: TenantService, private authService: AuthService) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.errorMessage = 'Identifiant membre absent.'; this.loading = false; return; }
    forkJoin({ member: this.memberService.getMember(id), churches: this.tenantService.listChurches(), campuses: this.tenantService.listCampuses(), user: this.authService.me() }).subscribe({
      next: ({ member, churches, campuses, user }) => {
        this.member = member; this.churches = churches; this.campuses = campuses;
        const role = user.organizations.find((organization) => organization.tenant_id === user.active_organization?.tenant_id)?.role;
        this.canManage = role === 'owner' || role === 'admin'; this.loading = false;
      },
      error: (error) => { this.errorMessage = this.describeError(error); this.loading = false; },
    });
  }

  initials(member: Member): string { return `${member.first_name.slice(0, 1)}${member.last_name.slice(0, 1)}`.toUpperCase(); }
  churchName(value: Member['church']): string { const id = typeof value === 'string' ? value : value?.church_id; return this.churches.find((church) => church.church_id === id)?.name ?? (typeof value === 'object' && value ? value.name ?? '—' : '—'); }
  campusName(value: Member['campus']): string { const id = typeof value === 'string' ? value : value?.campus_id; return this.campuses.find((campus) => campus.campus_id === id)?.name ?? (typeof value === 'object' && value ? value.name ?? '—' : '—'); }
  statusLabel(status?: string): string { return ({ ACTIVE: 'Actif', PENDING: 'Invitation en attente', SUSPENDED: 'Suspendu', ARCHIVED: 'Archivé' } as Record<string, string>)[status ?? ''] ?? status ?? 'Inconnu'; }
  genderLabel(gender?: string): string { return gender === 'M' ? 'Homme' : gender === 'F' ? 'Femme' : 'Non renseigné'; }
  maritalLabel(value?: string): string { return ({ single: 'Célibataire', married: 'Marié(e)', divorced: 'Divorcé(e)', widowed: 'Veuf/veuve' } as Record<string, string>)[value ?? ''] ?? value ?? 'Non renseignée'; }
  accessTitle(status?: string): string { return status === 'ACTIVE' ? 'Compte activé' : status === 'PENDING' ? 'Invitation en attente' : status === 'SUSPENDED' ? 'Accès suspendu' : 'Compte membre'; }
  accessDescription(status?: string): string { return status === 'ACTIVE' ? 'Le membre peut se connecter à son espace.' : status === 'PENDING' ? 'Le membre doit accepter son invitation pour définir un mot de passe.' : status === 'SUSPENDED' ? 'La connexion est désactivée pour ce compte.' : 'État du compte communiqué par le serveur.'; }

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