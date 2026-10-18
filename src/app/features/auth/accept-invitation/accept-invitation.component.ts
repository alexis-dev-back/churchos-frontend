import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="auth"><form [formGroup]="form" (ngSubmit)="submit()"><p class="eyebrow">CHURCHOS</p><h1>Activer mon compte</h1><p class="intro">Saisissez l’adresse e-mail associée à votre invitation et le code à 5 chiffres transmis par l’administrateur. Choisissez ensuite votre nom d’utilisateur et votre mot de passe.</p>
      <label>Adresse e-mail<input type="email" formControlName="email" autocomplete="email" /></label><label>Code d’invitation (5 chiffres)<input type="text" formControlName="token" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" autocomplete="one-time-code" /></label><label>Nom d’utilisateur<input type="text" formControlName="username" autocomplete="username" autocapitalize="none" /></label><label>Nouveau mot de passe<input type="password" formControlName="password" autocomplete="new-password" /></label><label>Confirmer le mot de passe<input type="password" formControlName="password_confirmation" autocomplete="new-password" /></label>
      <p class="error" *ngIf="errorMessage" role="alert">{{ errorMessage }}</p><p class="success" *ngIf="successMessage" role="status">{{ successMessage }}</p><button type="submit" [disabled]="form.invalid || loading">{{ loading ? 'Activation…' : 'Activer le compte' }}</button><a routerLink="/login">Retour à la connexion</a>
    </form></section>
  `,
  styles: [`
    :host{display:block}.auth{min-height:calc(100vh - 82px);display:grid;place-items:center;background:#eff5f2}.auth form{width:min(440px,100%);display:grid;gap:14px;padding:30px;background:white;border:1px solid #dce4e2}.eyebrow{margin:0;color:#157c72;font-size:.72rem;font-weight:800}.auth h1{margin:0;font-size:1.8rem}.intro{margin:0;color:#69757a;font-size:.9rem;line-height:1.5}.auth label{display:grid;gap:6px;color:#53615e;font-size:.82rem;font-weight:700}.auth input{min-height:42px;padding:9px 11px;border:1px solid #cfd9d6;font:inherit}.auth button{min-height:44px;border:0;background:#166d65;color:white;font-weight:700;cursor:pointer}.auth button:disabled{opacity:.55}.auth a{color:#16665f;font-size:.85rem}.error{margin:0;color:#a33434;font-size:.85rem}.success{margin:0;color:#23613a;font-size:.85rem}
  `],
})
export class AcceptInvitationComponent {
  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    token: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
    username: ['', [Validators.required, Validators.maxLength(150)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    password_confirmation: ['', Validators.required],
  });
  loading = false;
  errorMessage = '';
  successMessage = '';

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {}

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const payload = this.form.getRawValue() as { token: string; email: string; username: string; password: string; password_confirmation: string };
    if (payload.password !== payload.password_confirmation) { this.errorMessage = 'Les mots de passe ne correspondent pas.'; return; }
    this.loading = true; this.errorMessage = '';
    this.authService.acceptInvitation(payload).subscribe({
      next: (response) => { this.successMessage = response.detail; this.loading = false; window.setTimeout(() => this.router.navigateByUrl('/login'), 900); },
      error: (error: HttpErrorResponse) => { const body = error.error as Record<string, unknown> | null; this.errorMessage = body ? Object.entries(body).map(([key, value]) => `${key} : ${Array.isArray(value) ? value.join(', ') : value}`).join(' · ') : `Erreur API (${error.status}).`; this.loading = false; },
    });
  }
}