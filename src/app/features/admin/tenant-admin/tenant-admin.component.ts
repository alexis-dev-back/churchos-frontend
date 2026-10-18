import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { Campus, Church, Organization, TenantSiteWriteRequest } from '../../../core/models/tenant';
import { ChurchEventAdministrator } from '../../../core/models/event';
import { Member } from '../../../core/models/member';
import { AuthService } from '../../../core/services/auth.service';
import { EventService } from '../../../core/services/event.service';
import { MemberService } from '../../../core/services/member.service';
import { TenantService } from '../../../core/services/tenant.service';

type AdminTab = 'churches' | 'campuses';

@Component({
  selector: 'app-tenant-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <section class="page">
      <header class="page-heading">
        <div><p class="eyebrow">ADMINISTRATION DE L’ÉGLISE</p><h1>Églises et campus</h1><p>Gérez les sites et leurs informations.</p></div>
      </header>

      <nav class="tabs" aria-label="Gestion des sites">
        <button type="button" [class.selected]="tab === 'churches'" (click)="setTab('churches')">Églises</button>
        <button type="button" [class.selected]="tab === 'campuses'" (click)="setTab('campuses')">Campus</button>
      </nav>

      <p class="feedback error" role="alert" *ngIf="errorMessage">{{ errorMessage }}</p>
      <p class="feedback success" role="status" *ngIf="successMessage">{{ successMessage }}</p>

      <div class="workspace" *ngIf="tab === 'churches' || tab === 'campuses'">
        <section class="records">
          <div class="section-heading"><div><h2>{{ tab === 'churches' ? 'Églises' : 'Campus' }}</h2><p>{{ records.length }} site(s)</p></div><button type="button" class="primary" (click)="beginCreate()">{{ tab === 'churches' ? 'Nouvelle église' : 'Nouveau campus' }}</button></div>
          <div class="empty" *ngIf="!activeOrganization">Aucun espace actif. Contactez l’administrateur de la plateforme.</div>
          <div class="empty" *ngIf="activeOrganization && !records.length && !loading">Aucun élément enregistré.</div>
          <article class="record" *ngFor="let record of records">
            <div class="record-main"><strong>{{ record.name }}</strong><span>{{ record.slug }} · {{ record.email || record.address || 'Coordonnées non renseignées' }}</span></div>
            <div class="record-actions"><button type="button" class="secondary" *ngIf="tab === 'churches'" (click)="openChurchAdministrators(record)">Administrateurs événements</button><button type="button" class="quiet" (click)="editRecord(record)">Modifier</button><button type="button" class="danger" (click)="deleteRecord(record)">Supprimer</button></div>
          </article>
        </section>

        <div class="modal-backdrop" *ngIf="formOpen" (click)="closeEditor()"><form class="editor modal" [formGroup]="form" (ngSubmit)="saveRecord()" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="site-form-title">
          <div class="section-heading"><div><h2 id="site-form-title">{{ editingId ? 'Modifier' : 'Créer' }} {{ tab === 'churches' ? 'une église' : 'un campus' }}</h2><p>Les données seront rattachées à votre espace.</p></div><button type="button" class="quiet" (click)="closeEditor()">Fermer</button></div>
          <label>Nom *<input formControlName="name" /></label>
          <label>Identifiant URL *<input formControlName="slug" /></label>
          <label *ngIf="tab === 'churches'">Nom du pasteur<input formControlName="pastor_name" /></label>
          <label *ngIf="tab === 'campuses' && !churchSelectionFixed">Église *<select formControlName="church"><option value="">Choisir une église</option><option *ngFor="let church of churches" [value]="church.church_id">{{ church.name }}</option></select></label>
          <label>Email<input type="email" formControlName="email" /></label>
          <label>Téléphone<input formControlName="phone" /></label>
          <label>Adresse<textarea formControlName="address"></textarea></label>
          <label>Pays<input formControlName="country" /></label>
          <div class="form-actions"><button type="submit" class="primary" [disabled]="form.invalid || saving || !activeOrganization">{{ saving ? 'Enregistrement…' : editingId ? 'Enregistrer' : 'Créer' }}</button><button type="button" class="quiet" (click)="resetForm()">Effacer</button></div>
        </form></div>
      </div>
      <div class="modal-backdrop" *ngIf="churchAdminChurch" (click)="closeChurchAdministrators()">
        <section class="editor modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="church-admin-title">
          <div class="section-heading"><div><h2 id="church-admin-title">Administrateurs d’événements · {{ churchAdminChurch.name }}</h2><p>Ces membres pourront gérer uniquement les événements de cette église.</p></div><button type="button" class="quiet" (click)="closeChurchAdministrators()">Fermer</button></div>
          <p class="feedback error" role="alert" *ngIf="churchAdminError">{{ churchAdminError }}</p>
          <div class="membership-form">
            <label>Membre ayant un compte<select [(ngModel)]="selectedAdminMemberId" [ngModelOptions]="{standalone: true}"><option value="">Choisir un membre</option><option *ngFor="let member of eligibleChurchMembers" [value]="member.id">{{ member.first_name }} {{ member.last_name }} · {{ member.email }}</option></select></label>
            <button type="button" class="primary" [disabled]="!selectedAdminMemberId || savingAdmin" (click)="assignChurchAdministrator()">Attribuer</button>
          </div>
          <p class="empty" *ngIf="!churchAdministrators.length">Aucun administrateur spécifique pour cette église.</p>
          <article class="record" *ngFor="let administrator of churchAdministrators"><div class="record-main"><strong>{{ administrator.name }}</strong><span>{{ administrator.email }}</span></div><button type="button" class="danger" (click)="removeChurchAdministrator(administrator)">Retirer</button></article>
        </section>
      </div>
    </section>
  `,
  styles: [`
    :host{display:block;color:#202b34}.page{max-width:1320px;margin:0 auto}.page-heading,.section-heading{display:flex;align-items:center;justify-content:space-between;gap:18px}.page-heading{margin-bottom:24px}.eyebrow{margin:0 0 7px;color:#157c72;font-size:.72rem;font-weight:800;letter-spacing:.08em}.page-heading h1{margin:0;font-size:1.8rem}.page-heading p,.section-heading p{margin:5px 0 0;color:#69757a}.active-tenant{padding:8px 12px;background:#e7f4f1;color:#16665f;font-size:.82rem;font-weight:700}.tabs{display:flex;gap:4px;border-bottom:1px solid #dce4e2;margin-bottom:20px}.tabs button{padding:12px 15px;border:0;border-bottom:2px solid transparent;background:none;color:#687477;font-weight:700;cursor:pointer}.tabs button.selected{border-color:#157c72;color:#16665f}.workspace{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(280px,.8fr);gap:18px;align-items:start}.records,.editor{background:#fff;border:1px solid #dce4e2;padding:20px}.section-heading{margin-bottom:16px}.section-heading h2{font-size:1.05rem;margin:0}.section-heading p{font-size:.82rem}.record{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:13px 0;border-top:1px solid #edf1f0}.record-main{display:grid;gap:5px;min-width:0}.record-main strong{font-size:.92rem}.record-main span{font-size:.8rem;color:#69757a;overflow-wrap:anywhere}.record-actions,.form-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.primary,.secondary,.quiet,.danger{min-height:36px;padding:8px 11px;border:1px solid #d4dfdc;background:#fff;color:#28413d;font-weight:700;cursor:pointer}.primary{border-color:#166d65;background:#166d65;color:#fff}.secondary{border-color:#9abdb6;color:#16665f}.danger{color:#a33434}.primary:disabled,.secondary:disabled{opacity:.55;cursor:not-allowed}.editor{display:grid;gap:12px}.editor .section-heading{margin-bottom:2px}.editor label,.membership-form label{display:grid;gap:6px;color:#53615e;font-size:.82rem;font-weight:700}.editor input,.editor textarea,.editor select,.membership-form input,.membership-form select{width:100%;min-height:39px;padding:8px 10px;border:1px solid #cfd9d6;background:#fff;color:#202b34;font:inherit}.editor textarea{min-height:74px;resize:vertical}.form-actions{margin-top:4px}.membership-form{display:grid;grid-template-columns:1.3fr .8fr auto;gap:10px;align-items:end;border-top:1px solid #edf1f0;margin-top:18px;padding-top:18px}.membership-form h3{grid-column:1/-1;margin:0;font-size:.92rem}.empty{padding:18px 4px;color:#687477;font-size:.9rem}.feedback{padding:10px 12px;margin:0 0 14px;font-size:.9rem}.error{background:#fff1ef;color:#9b352a}.success{background:#e9f5ed;color:#23613a}@media(max-width:850px){.workspace{grid-template-columns:1fr}.membership-form{grid-template-columns:1fr}.membership-form h3{grid-column:auto}.page-heading{align-items:flex-start;flex-direction:column}}@media(max-width:560px){.record{align-items:flex-start;flex-direction:column}.page-heading h1{font-size:1.5rem}.tabs{overflow:auto}.tabs button{white-space:nowrap}}
  `],
})
export class TenantAdminComponent implements OnInit {
  tab: AdminTab = 'churches';
  churches: Church[] = [];
  churchSelectionFixed = false;
  defaultChurchId: string | null = null;
  campuses: Campus[] = [];
  records: Array<Church | Campus> = [];
  activeOrganization: Organization | null = null;
  editingId: string | null = null;
  churchAdminChurch: Church | null = null;
  churchAdministrators: ChurchEventAdministrator[] = [];
  eligibleChurchMembers: Member[] = [];
  selectedAdminMemberId = '';
  churchAdminError = '';
  savingAdmin = false;
  formOpen = false;
  loading = false;
  saving = false;
  errorMessage = '';
  successMessage = '';
  form = this.fb.group({
    name: ['', Validators.required], slug: ['', Validators.required], email: [''], phone: [''], address: [''], country: [''],
    pastor_name: [''], church: [''],
  });
  constructor(
    private fb: FormBuilder,
    private tenantService: TenantService,
    private authService: AuthService,
    private eventService: EventService,
    private memberService: MemberService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const routePath = this.route.snapshot.routeConfig?.path;
    this.tab = routePath === 'admin/campuses' ? 'campuses' : 'churches';
    if (this.tab === 'campuses') this.form.controls.church.addValidators(Validators.required);
    this.form.controls.church.updateValueAndValidity();
    this.activeOrganization = this.tenantService.getCurrentOrganization();
    if (this.activeOrganization) this.loadSites();
    else this.authService.me().subscribe({
      next: (user) => {
        if (user.active_organization) {
          this.activeOrganization = { tenant_id: user.active_organization.tenant_id, name: user.active_organization.name };
          this.tenantService.setOrganization(this.activeOrganization);
        }
        this.loadSites();
      },
      error: (error) => { this.errorMessage = this.describeError(error); },
    });
  }

  setTab(tab: AdminTab): void {
    this.tab = tab;
    if (tab === 'campuses') this.form.controls.church.addValidators(Validators.required);
    else this.form.controls.church.removeValidators(Validators.required);
    this.form.controls.church.updateValueAndValidity();
    this.resetForm();
    this.clearMessages();
    this.loadSites();
  }

  beginCreate(): void {
    this.resetForm();
    if (this.tab === 'campuses' && this.churchSelectionFixed) {
      this.form.controls.church.setValue(this.defaultChurchId ?? '');
    }
    this.formOpen = true;
  }
  closeEditor(): void { this.formOpen = false; this.resetForm(); }

  loadSites(): void {
    if (!this.activeOrganization) { this.records = []; return; }
    this.loading = true;
    this.tenantService.churchContext().subscribe({
      next: (context) => {
        this.churches = context.churches;
        this.churchSelectionFixed = context.church_selection_fixed;
        this.defaultChurchId = context.default_church_id;
        this.loadCampuses();
      },
      error: (error) => { this.churches = []; this.errorMessage = this.describeError(error); this.loadCampuses(); },
    });
  }

  private loadCampuses(): void {
    this.tenantService.listCampuses().subscribe({
      next: (items) => { this.campuses = items; this.records = this.tab === 'churches' ? this.churches : items; this.loading = false; },
      error: (error) => { this.campuses = []; this.records = this.tab === 'churches' ? this.churches : []; this.errorMessage = this.describeError(error); this.loading = false; },
    });
  }

  saveRecord(): void {
    if (this.form.invalid || !this.activeOrganization) { this.form.markAllAsTouched(); return; }
    const raw = this.form.getRawValue();
    const payload: TenantSiteWriteRequest = {
      name: raw.name ?? '', slug: raw.slug ?? '', email: raw.email ?? '', phone: raw.phone ?? '', address: raw.address ?? '', country: raw.country ?? '',
      ...(this.tab === 'churches' ? { pastor_name: raw.pastor_name ?? '', organization: this.activeOrganization.tenant_id } : { church: raw.church ?? '' }),
    };
    const request: Observable<unknown> = this.tab === 'churches'
      ? this.editingId ? this.tenantService.updateChurch(this.editingId, payload) : this.tenantService.createChurch(payload)
      : this.editingId ? this.tenantService.updateCampus(this.editingId, payload) : this.tenantService.createCampus(payload);
    this.saving = true;
    request.subscribe({
      next: () => { this.saving = false; this.successMessage = 'Enregistrement effectué.'; this.resetForm(); this.loadSites(); },
      error: (error) => { this.saving = false; this.errorMessage = this.describeError(error); },
    });
  }

  editRecord(record: Church | Campus): void {
    if ('church_id' in record) {
      this.editingId = record.church_id;
      this.form.patchValue({ ...record, church: '' });
    } else {
      this.editingId = record.campus_id;
      this.form.patchValue({ ...record, church: typeof record.church === 'string' ? record.church : '' });
    }
    this.formOpen = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  deleteRecord(record: Church | Campus): void {
    if (!window.confirm(`Supprimer « ${record.name} » ?`)) return;
    const id = 'church_id' in record ? record.church_id : record.campus_id;
    const request = this.tab === 'churches' ? this.tenantService.deleteChurch(id) : this.tenantService.deleteCampus(id);
    request.subscribe({ next: () => { this.successMessage = 'Élément supprimé.'; this.loadSites(); }, error: (error) => this.errorMessage = this.describeError(error) });
  }

  openChurchAdministrators(record: Church | Campus): void {
    if (!('church_id' in record)) return;
    this.churchAdminChurch = record;
    this.churchAdminError = '';
    this.selectedAdminMemberId = '';
    this.eventService.churchAdministrators(record.church_id).subscribe({
      next: (items) => this.churchAdministrators = items,
      error: (error) => this.churchAdminError = this.describeError(error),
    });
    this.memberService.getMembers().subscribe({
      next: (items) => this.eligibleChurchMembers = items.filter((member) => {
        const churchId = typeof member.church === 'string' ? member.church : member.church?.church_id;
        return churchId === record.church_id && member.status === 'ACTIVE' && member.has_account !== false;
      }),
      error: (error) => this.churchAdminError = this.describeError(error),
    });
  }

  closeChurchAdministrators(): void {
    this.churchAdminChurch = null;
    this.churchAdministrators = [];
    this.eligibleChurchMembers = [];
    this.selectedAdminMemberId = '';
    this.churchAdminError = '';
  }

  assignChurchAdministrator(): void {
    if (!this.churchAdminChurch || !this.selectedAdminMemberId) return;
    this.savingAdmin = true;
    this.eventService.assignChurchAdministrator(this.churchAdminChurch.church_id, this.selectedAdminMemberId).subscribe({
      next: () => {
        this.savingAdmin = false;
        this.selectedAdminMemberId = '';
        this.churchAdminError = '';
        this.reloadChurchAdministrators();
      },
      error: (error) => {
        this.savingAdmin = false;
        this.churchAdminError = this.describeError(error);
      },
    });
  }

  removeChurchAdministrator(administrator: ChurchEventAdministrator): void {
    if (!this.churchAdminChurch || !window.confirm(`Retirer les droits événements de ${administrator.name} ?`)) return;
    this.eventService.removeChurchAdministrator(this.churchAdminChurch.church_id, administrator.member_id).subscribe({
      next: () => this.reloadChurchAdministrators(),
      error: (error) => this.churchAdminError = this.describeError(error),
    });
  }

  private reloadChurchAdministrators(): void {
    if (!this.churchAdminChurch) return;
    this.eventService.churchAdministrators(this.churchAdminChurch.church_id).subscribe({
      next: (items) => this.churchAdministrators = items,
      error: (error) => this.churchAdminError = this.describeError(error),
    });
  }

  resetForm(): void {
    this.editingId = null;
    this.formOpen = false;
    this.form.reset({ name: '', slug: '', email: '', phone: '', address: '', country: '', pastor_name: '', church: '' });
  }

  private clearMessages(): void { this.errorMessage = ''; this.successMessage = ''; }
  private describeError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { detail?: string; non_field_errors?: string[] } | string | null;
      if (typeof body === 'string') return body;
      if (body?.detail) return body.detail;
      if (body?.non_field_errors?.length) return body.non_field_errors.join(' ');
      if (body && typeof body === 'object') return Object.entries(body).map(([key, value]) => `${key} : ${Array.isArray(value) ? value.join(', ') : value}`).join(' · ');
      return `Erreur API (${error.status}).`;
    }
    return 'Une erreur inattendue est survenue.';
  }
}