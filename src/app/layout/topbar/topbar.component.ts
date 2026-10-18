import { CommonModule } from '@angular/common';
import { Component, DestroyRef, EventEmitter, OnInit, Output } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NavigationEnd } from '@angular/router';
import { filter, startWith } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';
import { MeResponse } from '../../core/models/auth';
import { TenantService } from '../../core/services/tenant.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent implements OnInit {
  @Output() menuToggle = new EventEmitter<void>();
  profileOpen = false;
  user: MeResponse | null = null;

  constructor(private authService: AuthService, private tenantService: TenantService, private router: Router, private destroyRef: DestroyRef) {}

  ngOnInit(): void {
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.loadUser());
  }

  get isTenantAdmin(): boolean {
    const activeTenantId = this.user?.active_organization?.tenant_id;
    if (!activeTenantId || !this.user) return false;
    const role = this.user.organizations.find((organization) => organization.tenant_id === activeTenantId)?.role;
    return role === 'owner' || role === 'admin';
  }

  get isFamilyPage(): boolean {
    return this.router.url.startsWith('/families');
  }

  get isMemberPage(): boolean {
    return this.router.url.startsWith('/members');
  }

  toggleProfile(): void {
    this.profileOpen = !this.profileOpen;
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => this.finishLogout(),
      error: () => { this.authService.clearSession(); this.finishLogout(); },
    });
  }

  private finishLogout(): void {
    this.tenantService.setOrganization(null);
    this.router.navigateByUrl('/login');
  }

  private loadUser(): void {
    if (!this.authService.isAuthenticated()) { this.user = null; return; }
    this.authService.me().subscribe({
      next: (user) => {
        this.user = user;
        if (user.active_organization) this.tenantService.setOrganization({ tenant_id: user.active_organization.tenant_id, name: user.active_organization.name });
      },
      error: () => this.user = null,
    });
  }
}
