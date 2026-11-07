import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-super-admin-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="sa-login-shell">
      <div class="sa-login-card">
        <div class="brand-row">
          <div class="brand-mark">S</div>
          <div>
            <strong>ChurchOS</strong>
            <small>Console plateforme</small>
          </div>
        </div>
        <h1>Accès Super Administrateur</h1>
        <p class="subtitle">Espace réservé à l'administration de la plateforme SaaS.</p>
        <p class="error" *ngIf="errorMessage" role="alert">{{ errorMessage }}</p>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <label>
            <span>Nom d'utilisateur</span>
            <input formControlName="username" type="text" placeholder="superadmin" autocomplete="username" />
          </label>
          <label>
            <span>Mot de passe</span>
            <input formControlName="password" type="password" placeholder="••••••••" autocomplete="current-password" />
          </label>
          <button type="submit" [disabled]="form.invalid || loading">
            {{ loading ? 'Connexion...' : 'Accéder à la console' }}
          </button>
        </form>
        <p class="back-link"><a routerLink="/login">← Retour à la connexion standard</a></p>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .sa-login-shell {
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
      padding: 24px;
    }
    .sa-login-card {
      width: min(440px, 100%);
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 40px 32px;
      box-shadow: 0 24px 60px rgba(0,0,0,.5);
    }
    .brand-row { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
    .brand-mark { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: #fff; font-size: 22px; font-weight: 700; }
    .brand-row strong { display: block; font-size: 1.2rem; color: #f1f5f9; }
    .brand-row small { color: #94a3b8; font-size: .85rem; }
    h1 { margin: 0 0 8px; font-size: 1.6rem; color: #f1f5f9; }
    .subtitle { color: #94a3b8; font-size: .9rem; margin: 0 0 24px; }
    form { display: flex; flex-direction: column; gap: 16px; }
    label { display: flex; flex-direction: column; gap: 8px; font-size: .85rem; color: #cbd5e1; }
    input { height: 46px; border: 1px solid #334155; border-radius: 8px; padding: 0 14px; font-size: .95rem; background: #0f172a; color: #f1f5f9; }
    input:focus { outline: 2px solid rgba(59,130,246,.3); border-color: #3b82f6; }
    button { height: 48px; border: none; border-radius: 8px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: #fff; font-weight: 700; font-size: .95rem; cursor: pointer; transition: opacity .15s; }
    button:disabled { opacity: 0.6; cursor: wait; }
    .error { margin: 0 0 16px; color: #ef4444; font-size: .85rem; padding: 10px 12px; background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.3); border-radius: 8px; }
    .back-link { margin-top: 24px; text-align: center; font-size: .85rem; }
    .back-link a { color: #3b82f6; text-decoration: none; }
    .back-link a:hover { text-decoration: underline; }
  `],
})
export class SuperAdminLoginComponent {
  form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });
  loading = false;
  errorMessage = '';

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {}

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
          if (user.is_superuser) {
            this.router.navigateByUrl('/admin');
          } else {
            this.authService.clearSession();
            this.errorMessage = 'Ce compte n\'est pas un compte Super Administrateur.';
          }
        },
        error: (error) => (this.errorMessage = error.error?.detail ?? 'Identifiants invalides.'),
      });
  }
}
