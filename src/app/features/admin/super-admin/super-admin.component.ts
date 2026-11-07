import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { MeResponse } from '../../../core/models/auth';
import { Church, Organization, OrganizationWriteRequest, PlatformUser, TenantSiteWriteRequest } from '../../../core/models/tenant';
import { AuthService } from '../../../core/services/auth.service';
import {
  PlatformInvoice,
  PlatformPlan,
  PlatformService,
  PlatformSettings,
  PlatformStats,
  PlatformSubscription,
  PlatformTicket,
} from '../../../core/services/platform.service';
import { TenantService } from '../../../core/services/tenant.service';

type Tab =
  | 'dashboard'
  | 'stats'
  | 'organizations'
  | 'churches'
  | 'users'
  | 'subscriptions'
  | 'revenue'
  | 'billing'
  | 'settings'
  | 'support';

@Component({
  selector: 'app-super-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './super-admin.component.html',
  styleUrl: './super-admin.component.scss',
})
export class SuperAdminComponent implements OnInit {
  tab: Tab = 'dashboard';
  organizations: Organization[] = [];
  churches: Church[] = [];
  users: PlatformUser[] = [];
  plans: PlatformPlan[] = [];
  subscriptions: PlatformSubscription[] = [];
  invoices: PlatformInvoice[] = [];
  tickets: PlatformTicket[] = [];
  stats: PlatformStats | null = null;
  currentUser: MeResponse | null = null;
  selectedOrganization: Organization | null = null;
  selectedOrganizationId = '';
  loading = false;
  saving = false;
  sidebarOpen = false;
  organizationModal = false;
  churchModal = false;
  userModal = false;
  invoiceModal = false;
  orgMenuId: string | null = null;
  userMenuId: string | number | null = null;
  subMenuId: string | null = null;
  editingOrganization: string | null = null;
  editingChurch: string | null = null;
  errorMessage = '';
  successMessage = '';
  orgQuery = '';
  orgStatus = '';
  orgPlan = '';
  churchQuery = '';
  churchOrg = '';
  userQuery = '';
  userRole = '';
  userOrg = '';
  globalQuery = '';
  chartMonths = ['Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct'];
  revenueBars = [55, 40, 62, 48, 70, 52, 78, 58, 85, 62, 92, 68];
  growthBars = [30, 45, 40, 55, 50, 65, 60, 70, 75, 80, 85, 90];

  orgForm = this.fb.group({
    name: ['', Validators.required],
    slug: ['', Validators.required],
    email: [''],
    phone: [''],
    address: [''],
    country: [''],
  });
  churchForm = this.fb.group({
    organization: ['', Validators.required],
    name: ['', Validators.required],
    slug: ['', Validators.required],
    pastor_name: [''],
    email: [''],
    phone: [''],
    address: [''],
  });
  accountForm = this.fb.group({
    tenant_id: [''],
    role: ['admin' as 'admin' | 'member', Validators.required],
    username: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });
  invoiceForm = this.fb.group({
    organization: ['', Validators.required],
    amount: ['', Validators.required],
    issued_at: ['', Validators.required],
    due_at: ['', Validators.required],
  });
  settingsForm = this.fb.group({
    platform_name: ['ChurchOS'],
    support_email: ['support@churchos.io'],
    default_currency: ['XAF'],
    default_language: ['fr'],
  });

  readonly crumbs: Record<Tab, string> = {
    dashboard: 'Tableau de bord',
    stats: 'Statistiques',
    organizations: 'Organisations',
    churches: 'Églises',
    users: 'Utilisateurs',
    subscriptions: 'Abonnements',
    revenue: "Chiffre d'affaires",
    billing: 'Facturation',
    settings: 'Paramètres',
    support: 'Support',
  };

  constructor(
    private fb: FormBuilder,
    private tenant: TenantService,
    private platform: PlatformService,
    private auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.auth.me().subscribe({ next: (user) => (this.currentUser = user) });
    this.reload();
  }

  get breadcrumb(): string {
    return this.crumbs[this.tab];
  }

  get initials(): string {
    const source = this.currentUser?.username || 'SA';
    return source.slice(0, 2).toUpperCase();
  }

  get activeOrganizations(): number {
    return this.organizations.filter((org) => org.is_active !== false).length;
  }

  get trialOrganizations(): number {
    return this.subscriptions.filter((item) => item.status === 'TRIAL').length;
  }

  get suspendedOrganizations(): number {
    return this.organizations.filter((org) => org.is_active === false).length;
  }

  get pendingUsers(): number {
    return this.users.filter((user) => !user.last_login && user.is_active).length;
  }

  get suspendedUsers(): number {
    return this.users.filter((user) => !user.is_active).length;
  }

  get filteredOrganizations(): Organization[] {
    const query = this.normalized(this.orgQuery || this.globalQuery);
    return this.organizations.filter((org) => {
      const sub = this.subscriptionFor(org);
      const status = this.orgStatusValue(org, sub);
      const plan = sub?.plan_name || '';
      const haystack = `${org.name} ${org.slug} ${org.email}`.toLowerCase();
      const matchQuery = !query || haystack.includes(query);
      const matchStatus = !this.orgStatus || status === this.orgStatus;
      const matchPlan = !this.orgPlan || plan.toLowerCase() === this.orgPlan.toLowerCase();
      return matchQuery && matchStatus && matchPlan;
    });
  }

  get filteredChurches(): Church[] {
    const query = this.normalized(this.churchQuery || this.globalQuery);
    return this.churches.filter((church) => {
      const haystack = `${church.name} ${church.organization_name} ${church.pastor_name} ${church.country}`.toLowerCase();
      const matchQuery = !query || haystack.includes(query);
      const matchOrg = !this.churchOrg || church.organization === this.churchOrg;
      return matchQuery && matchOrg;
    });
  }

  get filteredUsers(): PlatformUser[] {
    const query = this.normalized(this.userQuery || this.globalQuery);
    return this.users.filter((user) => {
      const haystack = `${user.username} ${user.email} ${user.organization} ${user.role}`.toLowerCase();
      const matchQuery = !query || haystack.includes(query);
      const matchRole = !this.userRole || this.roleValue(user) === this.userRole;
      const matchOrg = !this.userOrg || user.organization_id === this.userOrg;
      return matchQuery && matchOrg && matchRole;
    });
  }

  get recentOrganizations(): Organization[] {
    return this.organizations.slice(0, 3);
  }

  get planShare(): { name: string; count: number; percent: number; tone: string }[] {
    const total = Math.max(this.organizations.length, 1);
    const counts = this.plans.map((plan) => ({
      name: plan.name,
      count: this.subscriptions.filter((item) => item.plan === plan.id || item.plan_name === plan.name).length,
      tone: plan.tier === 'ENTERPRISE' || plan.name === 'Enterprise' ? 'purple' : 'blue',
    }));
    return counts.map((item) => ({ ...item, percent: Math.round((item.count / total) * 100) }));
  }

  get topRevenue(): { org: Organization; plan: string; mrr: string; churches: number }[] {
    return this.organizations
      .map((org) => {
        const sub = this.subscriptionFor(org);
        const plan = this.plans.find((item) => item.id === sub?.plan || item.name === sub?.plan_name);
        return {
          org,
          plan: plan?.name || sub?.plan_name || '—',
          mrr: plan?.price || '0',
          churches: this.churches.filter((church) => church.organization === org.tenant_id).length,
        };
      })
      .sort((a, b) => Number(b.mrr) - Number(a.mrr))
      .slice(0, 8);
  }

  setTab(tab: Tab): void {
    this.tab = tab;
    this.sidebarOpen = false;
    this.orgMenuId = null;
    this.userMenuId = null;
    this.subMenuId = null;
    this.errorMessage = '';
    this.successMessage = '';
  }

  reload(): void {
    this.loading = true;
    forkJoin({
      organizations: this.tenant.listPlatformOrganizations(),
      churches: this.tenant.listAllPlatformChurches().pipe(catchError(() => of([]))),
      users: this.tenant.listPlatformUsers().pipe(catchError(() => of([]))),
      plans: this.platform.getPlans().pipe(catchError(() => of([]))),
      stats: this.platform.getStats().pipe(catchError(() => of(null))),
      subscriptions: this.platform.getSubscriptions().pipe(catchError(() => of([]))),
      invoices: this.platform.getInvoices().pipe(catchError(() => of([]))),
      tickets: this.platform.getTickets().pipe(catchError(() => of([]))),
      settings: this.platform.getSettings().pipe(catchError(() => of(this.settingsForm.getRawValue() as PlatformSettings))),
    }).subscribe({
      next: (bundle) => {
        this.organizations = bundle.organizations;
        this.churches = bundle.churches;
        this.users = bundle.users;
        this.plans = bundle.plans;
        this.stats = bundle.stats;
        this.subscriptions = bundle.subscriptions;
        this.invoices = bundle.invoices;
        this.tickets = bundle.tickets;
        this.settingsForm.patchValue(bundle.settings);
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = this.errorText(error);
        this.loading = false;
      },
    });
  }

  logout(): void {
    this.auth.logout().subscribe({
      next: () => this.router.navigateByUrl('/login-super-admin'),
      error: () => {
        this.auth.clearSession();
        this.router.navigateByUrl('/login-super-admin');
      },
    });
  }

  openOrganization(): void {
    this.editingOrganization = null;
    this.orgForm.reset({ name: '', slug: '', email: '', phone: '', address: '', country: '' });
    this.organizationModal = true;
  }

  editOrganization(org: Organization): void {
    this.editingOrganization = org.tenant_id;
    this.orgForm.patchValue(org);
    this.organizationModal = true;
    this.orgMenuId = null;
  }

  saveOrganization(): void {
    if (this.orgForm.invalid) {
      this.orgForm.markAllAsTouched();
      return;
    }
    const value = this.orgForm.getRawValue();
    const payload: OrganizationWriteRequest = {
      name: value.name ?? '',
      slug: value.slug ?? '',
      email: value.email ?? '',
      phone: value.phone ?? '',
      address: value.address ?? '',
      country: value.country ?? '',
    };
    this.saving = true;
    const req = this.editingOrganization
      ? this.tenant.updatePlatformOrganization(this.editingOrganization, payload)
      : this.tenant.createPlatformOrganization(payload);
    req.subscribe({
      next: () => {
        this.saving = false;
        this.organizationModal = false;
        this.successMessage = 'Organisation enregistrée.';
        this.reload();
      },
      error: (error) => {
        this.saving = false;
        this.errorMessage = this.errorText(error);
      },
    });
  }

  deleteOrganization(org: Organization): void {
    this.orgMenuId = null;
    if (!window.confirm(`Supprimer « ${org.name} » et ses données ?`)) return;
    this.tenant.deletePlatformOrganization(org.tenant_id).subscribe({
      next: () => {
        this.successMessage = 'Organisation supprimée.';
        this.reload();
      },
      error: (error) => (this.errorMessage = this.errorText(error)),
    });
  }

  viewOrganizationChurches(org: Organization): void {
    this.selectedOrganization = org;
    this.selectedOrganizationId = org.tenant_id;
    this.churchOrg = org.tenant_id;
    this.setTab('churches');
  }

  openChurch(org?: Organization): void {
    const organizationId = org?.tenant_id || this.churchOrg || this.selectedOrganizationId || this.organizations[0]?.tenant_id || '';
    this.editingChurch = null;
    this.churchForm.reset({
      organization: organizationId,
      name: '',
      slug: '',
      pastor_name: '',
      email: '',
      phone: '',
      address: '',
    });
    this.churchModal = true;
  }

  editChurch(church: Church): void {
    this.editingChurch = church.church_id;
    this.churchForm.patchValue({
      organization: church.organization || '',
      name: church.name,
      slug: church.slug || '',
      pastor_name: church.pastor_name || '',
      email: church.email || '',
      phone: church.phone || '',
      address: church.address || '',
    });
    this.churchModal = true;
  }

  saveChurch(): void {
    if (this.churchForm.invalid) {
      this.churchForm.markAllAsTouched();
      return;
    }
    const value = this.churchForm.getRawValue();
    const organizationId = value.organization ?? '';
    const payload: TenantSiteWriteRequest = {
      name: value.name ?? '',
      slug: value.slug ?? '',
      pastor_name: value.pastor_name ?? '',
      email: value.email ?? '',
      phone: value.phone ?? '',
      address: value.address ?? '',
      organization: organizationId,
    };
    this.saving = true;
    const req = this.editingChurch
      ? this.tenant.updatePlatformChurch(this.editingChurch, payload)
      : this.tenant.createPlatformChurch(organizationId, payload);
    req.subscribe({
      next: () => {
        this.saving = false;
        this.churchModal = false;
        this.successMessage = 'Église enregistrée.';
        this.reload();
      },
      error: (error) => {
        this.saving = false;
        this.errorMessage = this.errorText(error);
      },
    });
  }

  deleteChurch(church: Church): void {
    if (!window.confirm(`Supprimer l'église « ${church.name} » ?`)) return;
    this.tenant.deletePlatformChurch(church.church_id).subscribe({
      next: () => {
        this.successMessage = 'Église supprimée.';
        this.reload();
      },
      error: (error) => (this.errorMessage = this.errorText(error)),
    });
  }

  openUser(): void {
    this.accountForm.reset({ tenant_id: '', role: 'admin', username: '', email: '', password: '' });
    this.userModal = true;
  }

  createAccount(): void {
    if (this.accountForm.invalid) {
      this.accountForm.markAllAsTouched();
      return;
    }
    const value = this.accountForm.getRawValue();
    const payload = {
      username: value.username ?? '',
      email: value.email ?? '',
      password: value.password ?? '',
      ...(value.tenant_id ? { tenant_id: value.tenant_id, role: value.role ?? 'admin' } : {}),
    };
    this.saving = true;
    this.tenant.createPlatformUser(payload).subscribe({
      next: (result) => {
        this.saving = false;
        this.userModal = false;
        this.successMessage = result.organization_id
          ? `Compte ${result.username} créé, rôle ${result.role}.`
          : `Compte ${result.username} créé sans tenant.`;
        this.reload();
      },
      error: (error) => {
        this.saving = false;
        this.errorMessage = this.errorText(error);
      },
    });
  }

  openInvoice(): void {
    const today = new Date();
    const due = new Date(today);
    due.setDate(due.getDate() + 14);
    this.invoiceForm.reset({
      organization: this.organizations[0]?.tenant_id || '',
      amount: '',
      issued_at: this.isoDate(today),
      due_at: this.isoDate(due),
    });
    this.invoiceModal = true;
  }

  saveInvoice(): void {
    if (this.invoiceForm.invalid) {
      this.invoiceForm.markAllAsTouched();
      return;
    }
    const value = this.invoiceForm.getRawValue();
    const year = new Date().getFullYear();
    const number = `INV-${year}-${String(this.invoices.length + 1).padStart(3, '0')}`;
    this.saving = true;
    this.platform
      .createInvoice({
        number,
        organization: value.organization ?? '',
        amount: value.amount ?? 0,
        issued_at: value.issued_at ?? '',
        due_at: value.due_at ?? '',
        status: 'PENDING',
        currency: 'XAF',
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.invoiceModal = false;
          this.successMessage = 'Facture créée.';
          this.reload();
        },
        error: (error) => {
          this.saving = false;
          this.errorMessage = this.errorText(error);
        },
      });
  }

  saveSettings(): void {
    this.saving = true;
    this.platform.saveSettings(this.settingsForm.getRawValue() as PlatformSettings).subscribe({
      next: (settings) => {
        this.saving = false;
        this.settingsForm.patchValue(settings);
        this.successMessage = 'Paramètres enregistrés.';
      },
      error: (error) => {
        this.saving = false;
        this.errorMessage = this.errorText(error);
      },
    });
  }

  resetSettings(): void {
    this.platform.getSettings().subscribe({
      next: (settings) => this.settingsForm.patchValue(settings),
    });
  }

  subscriptionFor(org: Organization): PlatformSubscription | undefined {
    return this.subscriptions.find((item) => item.organization === org.tenant_id);
  }

  orgStatusValue(org: Organization, sub?: PlatformSubscription): string {
    if (org.is_active === false) return 'suspended';
    if (sub?.status === 'TRIAL') return 'trial';
    return 'active';
  }

  orgStatusLabel(org: Organization): string {
    const status = this.orgStatusValue(org, this.subscriptionFor(org));
    if (status === 'suspended') return 'Suspendu';
    if (status === 'trial') return 'Essai';
    return 'Actif';
  }

  orgStatusClass(org: Organization): string {
    const status = this.orgStatusValue(org, this.subscriptionFor(org));
    if (status === 'suspended') return 'suspended';
    if (status === 'trial') return 'pending';
    return 'active';
  }

  planLabel(org: Organization): string {
    return this.subscriptionFor(org)?.plan_name || '—';
  }

  planChip(name: string | null | undefined): string {
    const value = (name || '').toLowerCase();
    if (value.includes('enterprise')) return 'purple';
    if (value.includes('essai') || value.includes('trial')) return 'amber';
    if (value.includes('pro') || value.includes('basic')) return 'blue';
    return '';
  }

  churchCount(org: Organization): number {
    return this.churches.filter((church) => church.organization === org.tenant_id).length;
  }

  ownerName(org: Organization): string {
    const admin = this.users.find((user) => user.organization_id === org.tenant_id && (user.role === 'admin' || user.role === 'owner'));
    return admin?.username || '—';
  }

  roleLabel(user: PlatformUser): string {
    if (user.is_superuser || user.role === 'superadmin') return 'Super Admin';
    if (user.role === 'admin' || user.role === 'owner') return 'Admin Org';
    if (user.role === 'member') return 'Membre';
    return user.role || '—';
  }

  roleValue(user: PlatformUser): string {
    if (user.is_superuser || user.role === 'superadmin') return 'superadmin';
    if (user.role === 'admin' || user.role === 'owner') return 'admin';
    return user.role || '';
  }

  roleChip(user: PlatformUser): string {
    if (user.is_superuser || user.role === 'superadmin') return 'purple';
    return 'blue';
  }

  statusClass(status: string): string {
    const value = status.toUpperCase();
    if (['ACTIVE', 'PAID', 'RESOLVED', 'CLOSED'].includes(value)) return 'active';
    if (['TRIAL', 'PENDING', 'IN_PROGRESS', 'OPEN', 'DRAFT'].includes(value)) return 'pending';
    if (['SUSPENDED', 'CANCELLED', 'OVERDUE'].includes(value)) return 'suspended';
    return '';
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      ACTIVE: 'Actif',
      TRIAL: 'Essai',
      SUSPENDED: 'Suspendu',
      CANCELLED: 'Annulé',
      PAID: 'Payée',
      PENDING: 'En attente',
      DRAFT: 'Brouillon',
      OVERDUE: 'En retard',
      OPEN: 'Ouvert',
      IN_PROGRESS: 'En cours',
      RESOLVED: 'Résolu',
      CLOSED: 'Fermé',
    };
    return labels[status] || status;
  }

  priorityLabel(priority: string): string {
    const labels: Record<string, string> = { LOW: 'Basse', NORMAL: 'Normale', HIGH: 'Haute', URGENT: 'Urgente' };
    return labels[priority] || priority;
  }

  lastLoginLabel(value: string | null): string {
    if (!value) return 'Jamais';
    const date = new Date(value);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
    return this.formatDate(value);
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  }

  formatMoney(value: string | number | null | undefined): string {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount)) return '0';
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace('.0', '')}M`;
    if (amount >= 1_000) return `${Math.round(amount / 1000)}K`;
    return amount.toLocaleString('fr-FR');
  }

  formatAmount(value: string | number | null | undefined): string {
    return Number(value || 0).toLocaleString('fr-FR');
  }

  initialsOf(name: string | null | undefined): string {
    return (name || '??').replace(/[^A-Za-zÀ-ÿ]/g, '').slice(0, 2).toUpperCase() || '??';
  }

  avatarTone(index: number): string {
    return ['var(--accent)', 'var(--purple)', 'var(--success)'][index % 3];
  }

  featuredPlan(plan: PlatformPlan): boolean {
    return plan.tier === 'PRO' || plan.name.toLowerCase() === 'pro';
  }

  planCount(plan: PlatformPlan): number {
    return this.subscriptions.filter((item) => item.plan === plan.id || item.plan_name === plan.name).length;
  }

  private normalized(value: string): string {
    return value.trim().toLowerCase();
  }

  private isoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private errorText(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as Record<string, unknown> | string | null;
      if (typeof body === 'string') return body;
      if (body && typeof body === 'object') {
        const detail = body['detail'];
        if (typeof detail === 'string') return detail;
        return Object.entries(body)
          .map(([key, value]) => `${key} : ${Array.isArray(value) ? value.join(', ') : value}`)
          .join(' · ');
      }
      return `Erreur API (${error.status}).`;
    }
    return 'Erreur inattendue.';
  }
}
