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
    <section class="auth"><form [formGroup]="form" (ngSubmit)="submit()"><p class="eyebrow">CHURCHOS</p><h1>Créer un compte</h1><p class="intro">Après l’inscription, créez l’organisation à laquelle vous administrez l’accès.</p>
      <label>Nom d’utilisateur<input formControlName="username" autocomplete="username" /></label><label>Email<input type="email" formControlName="email" autocomplete="email" /></label><label>Mot de passe<input type="password" formControlName="password" autocomplete="new-password" /></label>
      <p class="error" *ngIf="errorMessage" role="alert">{{ errorMessage }}</p><button type="submit" [disabled]="form.invalid || loading">{{ loading ? 'Création…' : 'Créer mon compte' }}</button><a routerLink="/login">J’ai déjà un compte</a>
    </form></section>
  `,
  styles: [`
    :host{display:block}.auth{min-height:calc(100vh - 82px);display:grid;place-items:center;background:#EFF5F2}.auth form{width:min(440px,100%);display:grid;gap:14px;padding:30px;background:white;border:1px solid #E3EAE6}.eyebrow{margin:0;color:#2A8768;font-size:.72rem;font-weight:800}.auth h1{margin:0;font-size:1.8rem}.intro{margin:0;color:#7A8A84;font-size:.9rem;line-height:1.5}.auth label{display:grid;gap:6px;color:#7A8A84;font-size:.82rem;font-weight:700}.auth input{min-height:42px;padding:9px 11px;border:1px solid #E3EAE6;font:inherit}.auth button{min-height:44px;border:0;background:#2A8768;color:white;font-weight:700;cursor:pointer}.auth button:disabled{opacity:.55}.auth a{color:#2A8768;font-size:.85rem}.error{margin:0;color:#dc2626;font-size:.85rem}
  `],
})
export class RegisterComponent {
  form = this.fb.group({ username: ['', Validators.required], email: ['', [Validators.required, Validators.email]], password: ['', [Validators.required, Validators.minLength(8)]] });
  loading = false;
  errorMessage = '';

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {}

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true; this.errorMessage = '';
    this.authService.register(this.form.getRawValue() as { username: string; email: string; password: string }).subscribe({
      next: () => this.router.navigateByUrl('/admin/organizations'),
      error: (error: HttpErrorResponse) => { this.errorMessage = this.formatError(error); this.loading = false; },
    });
  }

  private formatError(error: HttpErrorResponse): string { const body = error.error as Record<string, unknown> | null; return body ? Object.entries(body).map(([field, value]) => `${field} : ${Array.isArray(value) ? value.join(', ') : value}`).join(' · ') : `Erreur API (${error.status}).`; }
}