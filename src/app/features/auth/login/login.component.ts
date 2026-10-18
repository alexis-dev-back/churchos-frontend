import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { finalize, switchMap } from 'rxjs';
import { OrganizationSummary } from '../../../core/models/auth';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="auth-shell">
      <div class="auth-card">
        <div class="brand-row">
          <div class="brand-mark">+</div>
          <div>
            <strong>ChurchOS</strong>
            <small>Connexion</small>
          </div>
        </div>

        <h1>Accéder à votre espace</h1>

        <p class="error" *ngIf="errorMessage" role="alert">{{ errorMessage }}</p>

        <form *ngIf="organizations.length" (ngSubmit)="chooseOrganization()">
          <label><span>Organisation</span><select [(ngModel)]="selectedOrganizationId" name="organization" required><option value="">Choisir une organisation</option><option *ngFor="let organization of organizations" [value]="organization.tenant_id">{{ organization.name }} · {{ organization.role }}</option></select></label>
          <button type="submit" [disabled]="!selectedOrganizationId || loading">Ouvrir cette organisation</button>
        </form>

        <form *ngIf="!organizations.length" [formGroup]="form" (ngSubmit)="submit()">
          <label>
            <span>Nom d'utilisateur</span>
            <input formControlName="username" type="text" placeholder="ex: owner1" />
          </label>

          <label>
            <span>Mot de passe</span>
            <input formControlName="password" type="password" placeholder="••••••••" />
          </label>

          <button type="submit" [disabled]="form.invalid || loading">
            {{ loading ? 'Connexion...' : 'Se connecter' }}
          </button>
        </form>

        <p class="auth-links"><a routerLink="/accept-invitation">Accepter une invitation</a></p>
      </div>
    </section>
  `,
  styles: [
    `
      :host { display: block; }
      .auth-shell {
        min-height: calc(100vh - 82px);
        display: grid;
        place-items: center;
        background: linear-gradient(135deg, #e5efe9, #f5f7f6);
      }
      .auth-card {
        width: min(420px, 100%);
        background: #fff;
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 32px 26px;
        box-shadow: 0 18px 40px rgba(18, 30, 52, 0.08);
      }
      .brand-row { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
      .brand-mark { width: 36px; height: 36px; border-radius: 4px; display: grid; place-items: center; background: #0b4939; color: #fff; font-size: 24px; font-weight: 700; }
      .brand-row strong { display: block; font-size: 1.1rem; }
      .brand-row small { color: var(--text-secondary); }
      h1 { margin: 0 0 20px; font-size: 1.9rem; }
      form { display: flex; flex-direction: column; gap: 16px; }
      label { display: flex; flex-direction: column; gap: 8px; font-size: 0.82rem; color: var(--text-secondary); }
      input { height: 46px; border: 1px solid var(--border); border-radius: 12px; padding: 0 14px; font-size: 0.95rem; }
      select { height: 46px; border: 1px solid var(--border); border-radius: 12px; padding: 0 14px; font-size: 0.95rem; background: white; }
      input:focus { outline: 2px solid rgba(11,73,57,.15); border-color: rgba(11,73,57,.55); }
      button { height: 48px; border: none; border-radius: 4px; background: #0b4939; color: #fff; font-weight: 700; }
      button:disabled { opacity: 0.7; cursor: wait; }
      .error { margin-top: 16px; color: #d14343; font-size: 0.85rem; }
      .auth-links { display:flex; justify-content:space-between; gap:12px; margin-top:18px; font-size:.82rem; }
      .auth-links a { color:#16665f; }
    `,
  ],
})
export class LoginComponent implements OnInit {
  form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });
  loading = false;
  errorMessage = '';
  organizations: OrganizationSummary[] = [];
  selectedOrganizationId = '';

  constructor(private fb: FormBuilder, private authService: AuthService, private tenantService: TenantService, private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) return;
    this.authService.me().subscribe({
      next: (user) => {
        if (user.is_superuser) { this.router.navigateByUrl('/admin'); return; }
        if (user.active_organization) { this.router.navigateByUrl('/dashboard'); return; }
        this.organizations = user.organizations ?? [];
        if (this.organizations.length === 1) {
          this.selectedOrganizationId = this.organizations[0].tenant_id;
          this.chooseOrganization();
        } else if (this.organizations.length > 1 && this.route.snapshot.queryParamMap.get('chooseOrganization') !== '1') {
          this.router.navigate(['/login'], { queryParams: { chooseOrganization: '1' }, replaceUrl: true });
        } else if (!this.organizations.length) {
          this.errorMessage = 'Aucune église ne vous est associée. Contactez le superadministrateur pour obtenir un accès.';
        }
      },
      error: () => this.authService.clearSession(),
    });
  }

  hasSession(): boolean { return this.authService.isAuthenticated(); }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.authService
      .login(this.form.value as { username: string; password: string })
      .pipe(switchMap(() => this.authService.me()))
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (user) => {
          this.organizations = user.organizations ?? [];
          if (user.is_superuser) {
            this.router.navigateByUrl('/admin');
          } else if (this.organizations.length === 1) {
            this.selectedOrganizationId = this.organizations[0].tenant_id;
            this.chooseOrganization();
          } else if (!this.organizations.length) {
            this.errorMessage = 'Aucune église ne vous est associée. Contactez le superadministrateur pour obtenir un accès.';
          }
        },
        error: (error) => (this.errorMessage = error.error?.detail ?? 'Identifiants invalides.'),
      });
  }

  chooseOrganization(): void {
    const organization = this.organizations.find((item) => item.tenant_id === this.selectedOrganizationId);
    if (!organization) return;
    this.loading = true;
    this.authService.selectOrganization({ tenant_id: organization.tenant_id }).pipe(finalize(() => this.loading = false)).subscribe({
      next: () => { this.tenantService.setOrganization({ tenant_id: organization.tenant_id, name: organization.name }); this.router.navigateByUrl('/dashboard'); },
      error: (error) => this.errorMessage = error.error?.detail ?? 'Impossible de sélectionner cette organisation.',
    });
  }
}
