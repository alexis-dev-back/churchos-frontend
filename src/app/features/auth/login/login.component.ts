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
      <aside class="auth-brand">
        <div class="brand-lockup">
          <div class="brand-mark">+</div>
          <div>
            <strong>churchos</strong>
            <small>Gestion d'église</small>
          </div>
        </div>

        <div class="brand-copy">
          <p class="brand-eyebrow">Plateforme de gestion</p>
          <h2>Pilotez votre église avec clarté.</h2>
          <p>Membres, familles, finances et événements réunis dans un espace simple et sécurisé.</p>
        </div>

        <ul class="brand-points">
          <li><span>✓</span>Vision consolidée de votre organisation</li>
          <li><span>✓</span>Suivi des membres et des familles</li>
          <li><span>✓</span>Finances et rapports en temps réel</li>
        </ul>

        <small class="brand-footer">© 2026 ChurchOS</small>
      </aside>

      <main class="auth-main">
        <div class="auth-card">
          <div class="brand-row">
            <div class="brand-mark">+</div>
            <div>
              <strong>ChurchOS</strong>
              <small>Connexion</small>
            </div>
          </div>

          <p class="eyebrow">Connexion</p>
          <h1>Accéder à votre espace</h1>
          <p class="subtitle">Entrez vos identifiants pour continuer.</p>

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
      </main>
    </section>
  `,
  styles: [
    `
      :host { display: block; }
      .auth-shell {
        min-height: 100vh;
        display: grid;
        grid-template-columns: minmax(0, 1.05fr) minmax(420px, .95fr);
        background: #F8F9FA;
      }
      .auth-brand {
        position: relative;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        padding: 44px 48px;
        background: linear-gradient(155deg, #114232 0%, #164A38 62%, #1E5642 100%);
        color: #fff;
      }
      .auth-brand::before {
        position: absolute;
        top: -150px;
        right: -120px;
        width: 430px;
        height: 430px;
        border: 56px solid rgba(255, 255, 255, .05);
        border-radius: 50%;
        content: '';
      }
      .auth-brand::after {
        position: absolute;
        right: -60px;
        bottom: -110px;
        width: 280px;
        height: 280px;
        border: 38px solid rgba(240, 112, 32, .18);
        border-radius: 50%;
        content: '';
      }
      .brand-lockup { position: relative; z-index: 1; display: flex; align-items: center; gap: 12px; }
      .brand-mark {
        display: grid;
        width: 38px;
        height: 38px;
        place-items: center;
        border-radius: 8px;
        background: #fff;
        color: #114232;
        font-size: 23px;
        font-weight: 700;
        line-height: 1;
      }
      .brand-lockup strong { display: block; font-family: var(--font-display); font-size: 18px; font-weight: 600; letter-spacing: .01em; }
      .brand-lockup small { display: block; margin-top: 2px; color: #9FC0B1; font-size: 11px; }
      .brand-copy { position: relative; z-index: 1; max-width: 480px; margin: auto 0 28px; }
      .brand-eyebrow { margin: 0 0 10px; color: #6FCFA8; font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
      .brand-copy h2 { margin: 0 0 14px; font-family: var(--font-display); font-size: clamp(1.7rem, 3vw, 2.4rem); font-weight: 600; line-height: 1.12; letter-spacing: -.02em; }
      .brand-copy p:last-child { margin: 0; max-width: 400px; color: #C7DAD2; font-size: 13px; line-height: 1.65; }
      .brand-points { position: relative; z-index: 1; display: grid; gap: 10px; margin: 0 0 auto; padding: 0; list-style: none; }
      .brand-points li { display: flex; align-items: center; gap: 9px; color: #DCE8E2; font-size: 12px; }
      .brand-points span { display: grid; width: 18px; height: 18px; place-items: center; border-radius: 50%; background: rgba(111, 207, 168, .16); color: #6FCFA8; font-size: 10px; font-weight: 700; }
      .brand-footer { position: relative; z-index: 1; margin-top: 32px; color: #7FA392; font-size: 10px; }
      .auth-main { display: grid; place-items: center; padding: 40px 24px; }
      .auth-card {
        width: min(430px, 100%);
        padding: 34px 30px;
        border: 1px solid #E6EBE8;
        border-radius: 12px;
        background: #fff;
        box-shadow: 0 18px 40px rgba(17, 66, 50, .08);
      }
      .brand-row { display: none; align-items: center; gap: 10px; margin-bottom: 22px; }
      .brand-row .brand-mark { width: 34px; height: 34px; background: #114232; color: #fff; font-size: 20px; }
      .brand-row strong { display: block; font-family: var(--font-display); font-size: 15px; }
      .brand-row small { color: #7A8A84; font-size: 11px; }
      .eyebrow { margin: 0 0 6px; color: #2A8768; font-size: 10px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase; }
      h1 { margin: 0 0 6px; font-family: var(--font-display); font-size: 1.65rem; font-weight: 600; letter-spacing: -.02em; }
      .subtitle { margin: 0 0 24px; color: #7A8A84; font-size: 12px; }
      form { display: flex; flex-direction: column; gap: 15px; }
      label { display: flex; flex-direction: column; gap: 7px; color: #3F5049; font-size: .8rem; font-weight: 600; }
      input, select {
        height: 44px;
        padding: 0 13px;
        border: 1px solid #E3EAE6;
        border-radius: 8px;
        background: #fff;
        color: #1B2A24;
        font: inherit;
        font-size: .9rem;
        font-weight: 400;
      }
      input:focus, select:focus { outline: 2px solid rgba(42, 135, 104, .16); border-color: #2A8768; }
      button {
        height: 46px;
        border: 1px solid #2A8768;
        border-radius: 8px;
        background: #2A8768;
        color: #fff;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
        transition: background-color .12s ease;
      }
      button:hover { background: #1F6B52; }
      button:disabled { opacity: .65; cursor: wait; }
      .error { margin: 0 0 14px; padding: 9px 11px; border: 1px solid #F1C9C7; border-radius: 6px; background: #FFF4F3; color: #d14343; font-size: .82rem; }
      .auth-links { display: flex; justify-content: space-between; gap: 12px; margin: 18px 0 0; font-size: .8rem; }
      .auth-links a { color: #2A8768; font-weight: 600; text-decoration: none; }
      @media (max-width: 900px) {
        .auth-shell { grid-template-columns: 1fr; }
        .auth-brand { display: none; }
        .brand-row { display: flex; }
        .auth-main { padding: 28px 16px; }
      }
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
