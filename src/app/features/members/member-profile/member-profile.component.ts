import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Member, MemberCreateRequest } from '../../../core/models/member';
import { MemberService } from '../../../core/services/member.service';
import { Campus, Church } from '../../../core/models/tenant';
import { TenantService } from '../../../core/services/tenant.service';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="profile-page"><header><p class="eyebrow">MON ESPACE</p><h1>Mon profil membre</h1><p>Vos coordonnées au sein de l’organisation active.</p></header>
      <p *ngIf="errorMessage" class="notice error" role="alert">{{ errorMessage }}</p><p *ngIf="successMessage" class="notice success" role="status">{{ successMessage }}</p>
      <section *ngIf="member" class="profile-card"><div class="identity"><span class="avatar">{{ member.first_name.slice(0, 1) }}{{ member.last_name.slice(0, 1) }}</span><div><h2>{{ member.first_name }} {{ member.last_name }}</h2><span>{{ member.status || 'Statut inconnu' }}</span></div><button class="primary" type="button" (click)="editorOpen = true">Modifier mon profil</button></div>
        <dl class="detail-grid"><dt>Email</dt><dd>{{ member.email }}</dd><dt>Téléphone</dt><dd>{{ member.phone || '—' }}</dd><dt>Église</dt><dd>{{ relationName(member.church) }}</dd><dt>Campus</dt><dd>{{ relationName(member.campus) }}</dd><dt>Situation matrimoniale</dt><dd>{{ member.marital_status || '—' }}</dd><dt>Adresse</dt><dd>{{ member.address || '—' }}</dd></dl>
      </section>
      <div class="modal-backdrop" *ngIf="editorOpen" (click)="editorOpen = false"><form class="modal" [formGroup]="form" (ngSubmit)="save()" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="profile-form-title"><div class="editor-heading"><h2 id="profile-form-title">Modifier mon profil</h2><button type="button" aria-label="Fermer" (click)="editorOpen = false">×</button></div>
        <div class="fields"><label>Prénom<input formControlName="first_name" /></label><label>Nom<input formControlName="last_name" /></label><label>Email<input type="email" formControlName="email" /></label><label>Téléphone<input formControlName="phone" /></label><label>Situation matrimoniale<input formControlName="marital_status" /></label><label class="wide">Adresse<textarea formControlName="address"></textarea></label></div>
        <button class="primary" type="submit" [disabled]="form.invalid || saving">{{ saving ? 'Enregistrement…' : 'Enregistrer le profil' }}</button>
      </form></div>
      <p class="empty" *ngIf="!member && !loading">Aucun profil membre associé à ce compte.</p><p class="empty" *ngIf="loading">Chargement du profil…</p>
    </section>
  `,
  styles: [`
    :host{display:block;color:#202b34}.profile-page{max-width:900px;margin:0 auto}.profile-page>header{margin-bottom:20px}.eyebrow{margin:0 0 7px;color:#157c72;font-size:.72rem;font-weight:800}.profile-page h1{margin:0;font-size:1.8rem}.profile-page>header p:last-child{margin:5px 0 0;color:#69757a}.profile-card{padding:20px;border:1px solid #dce4e2;background:white}.identity{display:flex;align-items:center;gap:14px;margin-bottom:20px;padding-bottom:18px;border-bottom:1px solid #edf1f0}.identity>div{flex:1}.avatar{display:grid;place-items:center;width:48px;height:48px;background:#e7f4f1;color:#16665f;font-weight:800}.identity h2{margin:0 0 4px;font-size:1.05rem}.identity span{color:#69757a;font-size:.8rem}.fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;margin:18px 0}.fields label{display:grid;gap:6px;color:#53615e;font-size:.8rem;font-weight:700}.fields input,.fields textarea{min-height:40px;padding:8px 10px;border:1px solid #cfd9d6;font:inherit}.fields textarea{min-height:75px}.wide{grid-column:1/-1}.primary{min-height:40px;padding:9px 14px;border:0;background:#166d65;color:#fff;font-weight:700}.primary:disabled{opacity:.55}.notice{padding:10px 12px;margin:0 0 14px;font-size:.87rem}.error{background:#fff1ef;color:#9b352a}.success{background:#e9f5ed;color:#23613a}.empty{padding:20px 0;color:#69757a}.editor-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}.editor-heading button{border:0;background:none;font-size:1.4rem}@media(max-width:560px){.fields{grid-template-columns:1fr}.wide{grid-column:auto}.identity{flex-wrap:wrap}}
  `],
})
export class MemberProfileComponent implements OnInit {
  member: Member | null = null;
  loading = true;
  saving = false;
  errorMessage = '';
  successMessage = '';
  editorOpen = false;
  form = this.fb.group({ first_name: ['', Validators.required], last_name: ['', Validators.required], email: ['', [Validators.required, Validators.email]], phone: [''], marital_status: [''], address: [''] });
  churches: Church[] = [];
  campuses: Campus[] = [];

  constructor(private fb: FormBuilder, private memberService: MemberService, private tenantService: TenantService) {}
  ngOnInit(): void {
    forkJoin({ member: this.memberService.getMe(), churches: this.tenantService.listChurches(), campuses: this.tenantService.listCampuses() }).subscribe({
      next: ({ member, churches, campuses }) => { this.member = member; this.churches = churches; this.campuses = campuses; this.form.patchValue(member); this.loading = false; },
      error: (error) => { this.errorMessage = this.describeError(error); this.loading = false; },
    });
  }

  save(): void {
    if (!this.member || this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving = true; this.errorMessage = ''; this.successMessage = '';
    this.memberService.updateMember(this.member.id, this.form.getRawValue() as Partial<MemberCreateRequest>).subscribe({
      next: (member) => { this.member = member; this.successMessage = 'Profil mis à jour.'; this.saving = false; this.editorOpen = false; },
      error: (error) => { this.errorMessage = this.describeError(error); this.saving = false; },
    });
  }

  relationName(value: Member['church'] | Member['campus']): string {
    if (typeof value !== 'string') return value?.name ?? '—';
    return this.churches.find((church) => church.church_id === value)?.name
      ?? this.campuses.find((campus) => campus.campus_id === value)?.name
      ?? '—';
  }

  private describeError(error: unknown): string { if (error instanceof HttpErrorResponse) { const body = error.error as Record<string, unknown> | string | null; if (typeof body === 'string') return body; if (body && typeof body === 'object') { const detail = body['detail']; if (typeof detail === 'string') return detail; return Object.entries(body).map(([key, value]) => `${key} : ${Array.isArray(value) ? value.join(', ') : value}`).join(' · '); } return `Erreur API (${error.status}).`; } return 'Une erreur inattendue est survenue.'; }
}