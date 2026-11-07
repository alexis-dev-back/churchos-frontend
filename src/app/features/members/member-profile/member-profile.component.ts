import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import { Member, MemberCreateRequest, MemberHistoryEntry } from '../../../core/models/member';
import { MemberService } from '../../../core/services/member.service';
import { Campus, Church } from '../../../core/models/tenant';
import { TenantService } from '../../../core/services/tenant.service';
import { MeResponse } from '../../../core/models/auth';
import { AuthService } from '../../../core/services/auth.service';
import { cropImageToSquare } from '../../../core/utils/crop-image';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="profile-page"><header><p class="eyebrow">MON ESPACE</p><h1>Mon profil</h1><p>Les informations de votre compte ChurchOS.</p></header>
      <p *ngIf="errorMessage" class="notice error" role="alert">{{ errorMessage }}</p><p *ngIf="successMessage" class="notice success" role="status">{{ successMessage }}</p>
      <section *ngIf="user && !member" class="profile-card"><div class="identity"><span class="avatar">{{ user.username.slice(0, 2).toUpperCase() }}</span><div><h2>{{ user.username }}</h2><span>Compte utilisateur</span></div></div>
        <dl class="detail-grid"><dt>Nom d’utilisateur</dt><dd>{{ user.username }}</dd><dt>Email</dt><dd>{{ user.email || '—' }}</dd><dt>Organisation</dt><dd>{{ user.active_organization?.name || '—' }}</dd><dt>Rôle</dt><dd>{{ activeRole || '—' }}</dd></dl>
      </section>
      <section *ngIf="member" class="profile-card"><div class="identity"><img *ngIf="member.photo || photoPreview" class="avatar photo" [src]="photoPreview || member.photo" alt="Photo de profil" /><span *ngIf="!member.photo && !photoPreview" class="avatar">{{ member.first_name.slice(0, 1) }}{{ member.last_name.slice(0, 1) }}</span><div><h2>{{ member.first_name }} {{ member.last_name }}</h2><span>{{ statusLabel(member.status) }}</span></div><button class="primary" type="button" (click)="editorOpen = true">Modifier mon profil</button></div>
        <dl class="detail-grid"><dt>Email</dt><dd>{{ member.email }}</dd><dt>Téléphone</dt><dd>{{ member.phone || '—' }}</dd><dt>Date de naissance</dt><dd>{{ formatDate(member.date_of_birth) }}</dd><dt>Genre</dt><dd>{{ genderLabel(member.gender) }}</dd><dt>Nationalité</dt><dd>{{ member.nationality || '—' }}</dd><dt>Profession</dt><dd>{{ member.profession || '—' }}</dd><dt>Niveau d’étude</dt><dd>{{ member.education_level || '—' }}</dd><dt>Situation matrimoniale</dt><dd>{{ member.marital_status || '—' }}</dd><dt>Baptême</dt><dd>{{ baptismLabel(member.baptism_status) }}<span *ngIf="member.baptism_date"> · {{ formatDate(member.baptism_date) }}</span></dd><dt>Contact d’urgence</dt><dd>{{ member.emergency_contact_name || '—' }}<span *ngIf="member.emergency_contact_phone"> · {{ member.emergency_contact_phone }}</span></dd><dt>Église</dt><dd>{{ relationName(member.church) }}</dd><dt>Campus</dt><dd>{{ relationName(member.campus) }}</dd><dt>Adresse</dt><dd>{{ member.address || '—' }}</dd></dl>
      </section>
      <section *ngIf="member" class="history-card"><h2>Mon parcours</h2><p *ngIf="loadingHistory">Chargement de l’historique…</p><p *ngIf="!loadingHistory && !history.length">Aucun événement de parcours enregistré.</p><ol><li *ngFor="let event of history"><strong>{{ event.title }}</strong><span>{{ event.event_type_label }}<span *ngIf="event.event_date"> · {{ formatDate(event.event_date) }}</span></span><p *ngIf="event.description">{{ event.description }}</p></li></ol></section>
      <div class="modal-backdrop" *ngIf="editorOpen" (click)="editorOpen = false"><form class="modal" [formGroup]="form" (ngSubmit)="save()" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="profile-form-title"><div class="editor-heading"><h2 id="profile-form-title">Compléter mon profil</h2><button type="button" aria-label="Fermer" (click)="editorOpen = false">×</button></div>
        <div class="fields"><label class="wide">Photo de profil<input type="file" accept="image/*" (change)="selectPhoto($event)" /><small>Recadrage carré automatique · JPEG, PNG ou WebP · 5 Mo maximum</small><img *ngIf="photoPreview" class="photo-preview" [src]="photoPreview" alt="Aperçu de la photo recadrée" /></label><label>Prénom<input formControlName="first_name" /></label><label>Nom<input formControlName="last_name" /></label><label>Email<input type="email" formControlName="email" /></label><label>Téléphone<input formControlName="phone" /></label><label>Date de naissance<input type="date" formControlName="date_of_birth" /></label><label>Genre<select formControlName="gender"><option value="">Non renseigné</option><option value="M">Homme</option><option value="F">Femme</option></select></label><label>Nationalité<input formControlName="nationality" /></label><label>Profession<input formControlName="profession" /></label><label>Niveau d’étude<input formControlName="education_level" /></label><label>Situation matrimoniale<select formControlName="marital_status"><option value="">Non renseignée</option><option value="single">Célibataire</option><option value="married">Marié(e)</option><option value="divorced">Divorcé(e)</option><option value="widowed">Veuf/veuve</option></select></label><label>Situation baptismale<select formControlName="baptism_status"><option value="UNKNOWN">Non renseignée</option><option value="NOT_BAPTIZED">Non baptisé(e)</option><option value="IN_PREPARATION">En préparation</option><option value="BAPTIZED">Baptisé(e)</option></select></label><label>Date du baptême<input type="date" formControlName="baptism_date" /></label><label>Contact d’urgence<input formControlName="emergency_contact_name" /></label><label>Téléphone d’urgence<input formControlName="emergency_contact_phone" /></label><label class="wide">Lieu d’habitation<textarea formControlName="address"></textarea></label></div>
        <button class="primary" type="submit" [disabled]="form.invalid || saving">{{ saving ? 'Enregistrement…' : 'Enregistrer le profil' }}</button>
      </form></div>
      <p class="empty" *ngIf="loading">Chargement du profil…</p>
    </section>
  `,
  styles: [`
    :host{display:block;color:#1B2A24}.profile-page{max-width:900px;margin:0 auto}.profile-page>header{margin-bottom:20px}.eyebrow{margin:0 0 7px;color:#2A8768;font-size:.72rem;font-weight:800}.profile-page h1{margin:0;font-size:1.8rem}.profile-page>header p:last-child{margin:5px 0 0;color:#7A8A84}.profile-card,.history-card{padding:20px;border:1px solid #E3EAE6;background:white}.history-card{margin-top:16px}.history-card h2{margin:0 0 12px;font-size:1.05rem}.history-card>p{color:#7A8A84;font-size:.84rem}.history-card ol{display:grid;gap:9px;margin:0;padding:0;list-style:none}.history-card li{display:grid;gap:4px;padding:12px;border-left:3px solid #2A8768;background:#F8FAF9}.history-card li strong{font-size:.9rem}.history-card li span,.history-card li p{margin:0;color:#7A8A84;font-size:.8rem}.identity{display:flex;align-items:center;gap:14px;margin-bottom:20px;padding-bottom:18px;border-bottom:1px solid #E3EAE6}.identity>div{flex:1}.avatar{display:grid;place-items:center;width:48px;height:48px;background:#EAF5F1;color:#2A8768;font-weight:800}.avatar.photo{border-radius:50%;object-fit:cover}.identity h2{margin:0 0 4px;font-size:1.05rem}.identity span{color:#7A8A84;font-size:.8rem}.detail-grid{display:grid;grid-template-columns:170px 1fr;gap:10px 14px}.detail-grid dt{color:#7A8A84;font-size:.82rem}.detail-grid dd{margin:0;font-size:.86rem}.fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;margin:18px 0}.fields label{display:grid;gap:6px;color:#7A8A84;font-size:.8rem;font-weight:700}.fields input,.fields select,.fields textarea{min-height:40px;padding:8px 10px;border:1px solid #E3EAE6;font:inherit}.fields textarea{min-height:75px}.fields small{font-weight:400}.photo-preview{width:88px;height:88px;border-radius:50%;object-fit:cover}.wide{grid-column:1/-1}.primary{min-height:40px;padding:9px 14px;border:0;background:#2A8768;color:#fff;font-weight:700}.primary:disabled{opacity:.55}.notice{padding:10px 12px;margin:0 0 14px;font-size:.87rem}.error{background:#fff1ef;color:#dc2626}.success{background:#f0fdf4;color:#23613a}.empty{padding:20px 0;color:#7A8A84}.editor-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}.editor-heading button{border:0;background:none;font-size:1.4rem}@media(max-width:560px){.fields,.detail-grid{grid-template-columns:1fr}.wide{grid-column:auto}.identity{flex-wrap:wrap}.detail-grid dt{font-weight:700}}
  `],
})
export class MemberProfileComponent implements OnInit {
  user: MeResponse | null = null;
  member: Member | null = null;
  photoUpload: File | null = null;
  photoPreview: string | null = null;
  history: MemberHistoryEntry[] = [];
  loadingHistory = true;
  loading = true;
  saving = false;
  errorMessage = '';
  successMessage = '';
  editorOpen = false;
  form = this.fb.group({ first_name: ['', Validators.required], last_name: ['', Validators.required], email: ['', [Validators.required, Validators.email]], phone: [''], gender: [''], date_of_birth: [''], marital_status: [''], address: [''], nationality: [''], profession: [''], education_level: [''], baptism_status: ['UNKNOWN'], baptism_date: [''], emergency_contact_name: [''], emergency_contact_phone: [''] });
  churches: Church[] = [];
  campuses: Campus[] = [];

  constructor(private fb: FormBuilder, private memberService: MemberService, private tenantService: TenantService, private authService: AuthService) {}
  get activeRole(): string | undefined {
    const activeTenantId = this.user?.active_organization?.tenant_id;
    return this.user?.organizations.find((organization) => organization.tenant_id === activeTenantId)?.role;
  }

  ngOnInit(): void {
    this.authService.me().pipe(
      switchMap((user) => this.memberService.getMe().pipe(
        catchError((error: unknown) => error instanceof HttpErrorResponse && error.status === 404
          ? of(null)
          : throwError(() => error)),
        map((member) => ({ user, member })),
      )),
      switchMap(({ user, member }) => member
        ? forkJoin({ churches: this.tenantService.listChurches(), campuses: this.tenantService.listCampuses(), history: this.memberService.getHistory(member.id) }).pipe(
          map(({ churches, campuses, history }) => ({ user, member, churches, campuses, history })),
        )
        : of({ user, member, churches: [], campuses: [], history: [] })),
    ).subscribe({
      next: ({ user, member, churches, campuses, history }) => { this.user = user; this.member = member; this.churches = churches; this.campuses = campuses; this.history = history; this.loadingHistory = false; if (member) this.form.patchValue(member); this.loading = false; },
      error: (error) => { this.errorMessage = this.describeError(error); this.loading = false; },
    });
  }

  save(): void {
    if (!this.member || this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving = true; this.errorMessage = ''; this.successMessage = '';
    const values = this.form.getRawValue();
    const payload: Partial<MemberCreateRequest> = {
      first_name: values.first_name ?? '',
      last_name: values.last_name ?? '',
      email: values.email ?? '',
      phone: values.phone ?? '',
      gender: values.gender ?? '',
      date_of_birth: values.date_of_birth ?? '',
      marital_status: values.marital_status ?? '',
      address: values.address ?? '',
      nationality: values.nationality ?? '',
      profession: values.profession ?? '',
      education_level: values.education_level ?? '',
      baptism_status: values.baptism_status ?? 'UNKNOWN',
      baptism_date: values.baptism_date ?? '',
      emergency_contact_name: values.emergency_contact_name ?? '',
      emergency_contact_phone: values.emergency_contact_phone ?? '',
      photo_upload: this.photoUpload ?? undefined,
    };
    this.memberService.updateMember(this.member.id, payload).subscribe({
      next: (member) => { this.member = member; this.photoUpload = null; this.releasePhotoPreview(); this.successMessage = 'Profil mis à jour.'; this.saving = false; this.editorOpen = false; },
      error: (error) => { this.errorMessage = this.describeError(error); this.saving = false; },
    });
  }

  selectPhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { this.errorMessage = 'Sélectionnez un fichier image.'; input.value = ''; return; }
    if (file.size > 5 * 1024 * 1024) { this.errorMessage = 'La photo ne peut pas dépasser 5 Mo.'; input.value = ''; return; }
    cropImageToSquare(file).then((cropped) => {
      this.photoUpload = cropped;
      this.releasePhotoPreview();
      this.photoPreview = URL.createObjectURL(cropped);
      this.errorMessage = '';
    }).catch((error: unknown) => {
      this.errorMessage = error instanceof Error ? error.message : 'Impossible de préparer cette photo.';
    });
  }

  statusLabel(status?: string): string { return ({ NEW: 'Nouveau membre', PENDING: 'Invitation en attente', ACTIVE: 'Membre actif', INACTIVE: 'Membre inactif', TRANSFERRED: 'Transféré', DECEASED: 'Décédé', SUSPENDED: 'Accès suspendu', ARCHIVED: 'Archivé' } as Record<string, string>)[status ?? ''] ?? status ?? 'Statut inconnu'; }
  genderLabel(value?: string): string { return value === 'M' ? 'Homme' : value === 'F' ? 'Femme' : 'Non renseigné'; }
  baptismLabel(value?: string): string { return ({ UNKNOWN: 'Non renseignée', NOT_BAPTIZED: 'Non baptisé(e)', IN_PREPARATION: 'En préparation', BAPTIZED: 'Baptisé(e)' } as Record<string, string>)[value ?? ''] ?? 'Non renseignée'; }
  formatDate(value?: string | null): string { return value ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00`)) : '—'; }

  private releasePhotoPreview(): void { if (this.photoPreview) URL.revokeObjectURL(this.photoPreview); this.photoPreview = null; }

  relationName(value: Member['church'] | Member['campus']): string {
    if (typeof value !== 'string') return value?.name ?? '—';
    return this.churches.find((church) => church.church_id === value)?.name
      ?? this.campuses.find((campus) => campus.campus_id === value)?.name
      ?? '—';
  }

  private describeError(error: unknown): string { if (error instanceof HttpErrorResponse) { const body = error.error as Record<string, unknown> | string | null; if (typeof body === 'string') return body; if (body && typeof body === 'object') { const detail = body['detail']; if (typeof detail === 'string') return detail; return Object.entries(body).map(([key, value]) => `${key} : ${Array.isArray(value) ? value.join(', ') : value}`).join(' · '); } return `Erreur API (${error.status}).`; } return 'Une erreur inattendue est survenue.'; }
}