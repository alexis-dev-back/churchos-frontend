import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Campus, ChurchContext } from '../../core/models/tenant';
import {
  ChurchSettings,
  ConfigurationAssignment,
  ConfigurationAuditEntry,
  ConfigurationMembership,
  ConfigurationPermission,
  ConfigurationRole,
} from '../../core/models/configuration';
import { FinanceConfigurationPayload, FinancialConfiguration } from '../../core/models/finance';
import { ConfigurationService } from '../../core/services/configuration.service';
import { FinanceService } from '../../core/services/finance.service';
import { TenantService } from '../../core/services/tenant.service';

type ConfigurationTab = 'church' | 'finance' | 'users' | 'roles' | 'assignments' | 'audit';

@Component({
  selector: 'app-configuration-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './configuration-dashboard.component.html',
})
export class ConfigurationDashboardComponent implements OnInit {
  tab: ConfigurationTab = 'church';
  context: ChurchContext | null = null;
  permissions: ConfigurationPermission[] = [];
  roles: ConfigurationRole[] = [];
  users: ConfigurationMembership[] = [];
  assignments: ConfigurationAssignment[] = [];
  auditLogs: ConfigurationAuditEntry[] = [];
  churchSettings: ChurchSettings | null = null;
  financeConfiguration: FinancialConfiguration | null = null;
  financeConfigurationLoading = false;
  financeConfigurationLoadFailed = false;
  financeConfigurationForm: FinanceConfigurationPayload = {
    level: 1,
    base_currency: 'XOF',
    is_suspended: false,
    suspension_reason: '',
    reason: '',
  };
  socialLinksJson = '{}';
  additionalInformationJson = '{}';
  selectedLogoPrimary: File | null = null;
  selectedLogoSecondary: File | null = null;
  selectedChurchId = '';
  selectedAssignmentUserId: number | null = null;
  searchUsers = '';
  newUsername = '';
  errorMessage = '';
  successMessage = '';
  canResetPasswords = false;
  loading = true;
  saving = false;
  passwordResetModalOpen = false;
  passwordResetUser: ConfigurationMembership | null = null;
  passwordResetForm = { password: '', confirmation: '' };
  private financeConfigurationRequestId = 0;
  roleModalOpen = false;
  roleStep = 1;
  editingRole: ConfigurationRole | null = null;
  roleForm = { name: '', code: '', description: '', is_active: true };
  selectedPermissionCodes: string[] = [];
  assignmentForm: {
    membership_id: number | null;
    role_id: string;
    scope: ConfigurationAssignment['scope'];
    church_id: string;
    campus_id: string;
    expires_on: string;
  } = {
    membership_id: null,
    role_id: '',
    scope: 'ORGANIZATION',
    church_id: '',
    campus_id: '',
    expires_on: '',
  };

  constructor(
    private configurationService: ConfigurationService,
    private financeService: FinanceService,
    private tenantService: TenantService,
  ) {}

  ngOnInit(): void {
    this.context = null;
    this.tenantService.churchContext().subscribe({
      next: (context) => {
        this.context = context;
        this.selectedChurchId = context.default_church_id ?? context.churches[0]?.church_id ?? '';
        this.loadAdminData();
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.getErrorMessage(error, 'Impossible de charger les églises de cette organisation.');
      },
    });
  }

  get churches() {
    return this.context?.churches ?? [];
  }

  get campuses(): Campus[] {
    const churchId = this.assignmentForm.church_id;
    return (this.context?.campuses ?? []).filter((campus) => campus.church === churchId);
  }

  get permissionModules(): Array<{ name: string; permissions: ConfigurationPermission[] }> {
    const grouped = new Map<string, ConfigurationPermission[]>();
    for (const permission of this.permissions) {
      const list = grouped.get(permission.module) ?? [];
      list.push(permission);
      grouped.set(permission.module, list);
    }
    return Array.from(grouped.entries()).map(([name, permissions]) => ({ name, permissions }));
  }

  get selectedRolePermissionLabels(): string[] {
    return this.permissions
      .filter((permission) => this.selectedPermissionCodes.includes(permission.code))
      .map((permission) => permission.label);
  }

  setTab(tab: ConfigurationTab): void {
    this.tab = tab;
    this.clearFeedback();
    if (tab === 'church') this.loadChurchSettings();
    if (tab === 'finance') this.loadFinanceConfiguration();
  }

  onChurchChange(): void {
    this.loadChurchSettings();
    if (this.tab === 'finance') this.loadFinanceConfiguration();
  }

  onFinanceSuspensionChange(): void {
    if (!this.financeConfigurationForm.is_suspended) {
      this.financeConfigurationForm.suspension_reason = '';
    }
  }

  saveFinanceConfiguration(): void {
    if (!this.selectedChurchId || !this.financeConfigurationForm.reason.trim()) return;
    this.saving = true;
    const payload: FinanceConfigurationPayload = {
      ...this.financeConfigurationForm,
      base_currency: this.financeConfigurationForm.base_currency.trim().toUpperCase(),
      reason: this.financeConfigurationForm.reason.trim(),
      suspension_reason: this.financeConfigurationForm.is_suspended
        ? this.financeConfigurationForm.suspension_reason?.trim() ?? ''
        : '',
    };
    const request = this.financeConfiguration
      ? this.financeService.updateConfiguration(this.selectedChurchId, payload)
      : this.financeService.createConfiguration(this.selectedChurchId, payload);
    request.subscribe({
      next: (configuration) => {
        this.financeConfiguration = configuration;
        this.setFinanceConfigurationForm(configuration);
        this.saving = false;
        this.successMessage = 'Les paramètres financiers ont été enregistrés et audités.';
      },
      error: (error: HttpErrorResponse) => this.showError(error, 'Impossible d’enregistrer les paramètres financiers.'),
    });
  }

  search(): void {
    this.configurationService.listUsers(this.searchUsers.trim()).subscribe({
      next: (data) => this.users = data.results,
      error: (error: HttpErrorResponse) => this.showError(error, 'Impossible de rechercher les utilisateurs.'),
    });
  }

  addUser(): void {
    if (!this.newUsername.trim()) return;
    this.saving = true;
    this.configurationService.addUser(this.newUsername.trim()).subscribe({
      next: (user) => {
        this.users = [user, ...this.users];
        this.newUsername = '';
        this.saving = false;
        this.successMessage = 'L’utilisateur a été ajouté à cette organisation.';
        this.reloadAudit();
      },
      error: (error: HttpErrorResponse) => this.showError(error, 'Impossible d’ajouter cet utilisateur.'),
    });
  }

  toggleMembership(user: ConfigurationMembership): void {
    const action = user.is_active ? 'suspendre' : 'réactiver';
    if (!window.confirm(`Confirmer la volonté de ${action} l’accès de ${user.username} à cette organisation ?`)) return;
    this.configurationService.updateUser(user.membership_id, { is_active: !user.is_active }).subscribe({
      next: (updated) => {
        this.users = this.users.map((item) => item.membership_id === updated.membership_id ? updated : item);
        this.successMessage = updated.is_active ? 'Accès à l’organisation réactivé.' : 'Accès à cette organisation suspendu.';
        this.reloadAudit();
      },
      error: (error: HttpErrorResponse) => this.showError(error, 'Impossible de modifier cette appartenance.'),
    });
  }

  openPasswordReset(user: ConfigurationMembership): void {
    this.clearFeedback();
    this.passwordResetUser = user;
    this.passwordResetForm = { password: '', confirmation: '' };
    this.passwordResetModalOpen = true;
  }

  resetPassword(): void {
    const user = this.passwordResetUser;
    const { password, confirmation } = this.passwordResetForm;
    if (!user || password.length < 8 || password !== confirmation) return;
    this.saving = true;
    this.configurationService.resetUserPassword(user.membership_id, password).subscribe({
      next: (response) => {
        this.passwordResetModalOpen = false;
        this.passwordResetUser = null;
        this.passwordResetForm = { password: '', confirmation: '' };
        this.saving = false;
        this.successMessage = response.detail;
        this.reloadAudit();
      },
      error: (error: HttpErrorResponse) => this.showError(error, 'Impossible de réinitialiser ce mot de passe.'),
    });
  }

  openCreateRole(): void {
    this.editingRole = null;
    this.roleForm = { name: '', code: '', description: '', is_active: true };
    this.selectedPermissionCodes = [];
    this.roleStep = 1;
    this.roleModalOpen = true;
  }

  openEditRole(role: ConfigurationRole): void {
    if (role.is_system) return;
    this.editingRole = role;
    this.roleForm = {
      name: role.name,
      code: role.code,
      description: role.description,
      is_active: role.is_active,
    };
    this.selectedPermissionCodes = [...role.permission_codes];
    this.roleStep = 1;
    this.roleModalOpen = true;
  }

  generateRoleCode(): void {
    this.roleForm.code = this.roleForm.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  togglePermission(code: string, checked: boolean): void {
    this.selectedPermissionCodes = checked
      ? [...new Set([...this.selectedPermissionCodes, code])]
      : this.selectedPermissionCodes.filter((permission) => permission !== code);
  }

  toggleModulePermissions(module: { permissions: ConfigurationPermission[] }, checked: boolean): void {
    for (const permission of module.permissions) this.togglePermission(permission.code, checked);
  }

  areModulePermissionsSelected(module: { permissions: ConfigurationPermission[] }): boolean {
    return module.permissions.length > 0
      && module.permissions.every((permission) => this.selectedPermissionCodes.includes(permission.code));
  }

  saveRole(): void {
    if (!this.roleForm.name.trim() || !this.roleForm.code.trim()) return;
    this.saving = true;
    const operation = this.editingRole
      ? this.configurationService.updateRole(this.editingRole.id, this.roleForm)
      : this.configurationService.createRole(this.roleForm);
    operation.subscribe({
      next: (role) => {
        this.configurationService.updateRolePermissions(role.id, this.selectedPermissionCodes).subscribe({
          next: (updated) => {
            this.roles = this.roles.some((item) => item.id === updated.id)
              ? this.roles.map((item) => item.id === updated.id ? updated : item)
              : [...this.roles, updated].sort((a, b) => a.name.localeCompare(b.name));
            this.roleModalOpen = false;
            this.saving = false;
            this.successMessage = 'Le rôle et ses permissions ont été enregistrés.';
            this.reloadAudit();
          },
          error: (error: HttpErrorResponse) => {
            this.saving = false;
            this.showError(error, 'Le rôle est enregistré, mais ses permissions n’ont pas pu être sauvegardées.');
            this.loadAdminData();
          },
        });
      },
      error: (error: HttpErrorResponse) => this.showError(error, 'Impossible d’enregistrer le rôle.'),
    });
  }

  toggleRole(role: ConfigurationRole): void {
    if (role.is_system) return;
    this.configurationService.updateRole(role.id, { is_active: !role.is_active }).subscribe({
      next: (updated) => {
        this.roles = this.roles.map((item) => item.id === updated.id ? updated : item);
        this.successMessage = updated.is_active ? 'Rôle activé.' : 'Rôle désactivé.';
        this.reloadAudit();
      },
      error: (error: HttpErrorResponse) => this.showError(error, 'Impossible de modifier ce rôle.'),
    });
  }

  selectAssignmentUser(userId: number | null): void {
    this.selectedAssignmentUserId = userId;
    this.configurationService.listAssignments(userId ?? undefined).subscribe({
      next: (data) => this.assignments = data.results,
      error: (error: HttpErrorResponse) => this.showError(error, 'Impossible de charger les attributions.'),
    });
  }

  changeAssignmentScope(): void {
    if (this.assignmentForm.scope === 'ORGANIZATION') {
      this.assignmentForm.church_id = '';
      this.assignmentForm.campus_id = '';
    } else if (this.assignmentForm.scope === 'CHURCH') {
      this.assignmentForm.campus_id = '';
      this.assignmentForm.church_id ||= this.selectedChurchId;
    } else {
      this.assignmentForm.church_id ||= this.selectedChurchId;
      this.assignmentForm.campus_id = '';
    }
  }

  assignRole(): void {
    const form = this.assignmentForm;
    if (!form.membership_id || !form.role_id) return;
    this.saving = true;
    const payload: Parameters<ConfigurationService['assignRole']>[0] = {
      membership_id: form.membership_id,
      role_id: form.role_id,
      scope: form.scope,
    };
    if (form.scope !== 'ORGANIZATION') payload.church_id = form.church_id;
    if (form.scope === 'CAMPUS') payload.campus_id = form.campus_id;
    if (form.expires_on) payload.expires_at = new Date(`${form.expires_on}T23:59:59`).toISOString();
    this.configurationService.assignRole(payload).subscribe({
      next: (assignment) => {
        this.assignments = [assignment, ...this.assignments];
        this.assignmentForm.role_id = '';
        this.assignmentForm.expires_on = '';
        this.saving = false;
        this.successMessage = 'Le rôle a été attribué et journalisé.';
        this.reloadAudit();
      },
      error: (error: HttpErrorResponse) => this.showError(error, 'Impossible d’attribuer ce rôle.'),
    });
  }

  revokeAssignment(assignment: ConfigurationAssignment): void {
    if (!window.confirm(`Révoquer le rôle « ${assignment.role_name} » attribué à ${assignment.username} ?`)) return;
    this.configurationService.revokeAssignment(assignment.id).subscribe({
      next: (updated) => {
        this.assignments = this.assignments.map((item) => item.id === updated.id ? updated : item);
        this.successMessage = 'Attribution révoquée.';
        this.reloadAudit();
      },
      error: (error: HttpErrorResponse) => this.showError(error, 'Impossible de révoquer cette attribution.'),
    });
  }

  saveChurchSettings(): void {
    if (!this.churchSettings || !this.selectedChurchId) return;
    let socialLinks: Record<string, string>;
    let additionalInformation: Record<string, unknown>;
    try {
      socialLinks = JSON.parse(this.socialLinksJson) as Record<string, string>;
      additionalInformation = JSON.parse(this.additionalInformationJson) as Record<string, unknown>;
      if (Array.isArray(socialLinks) || !socialLinks || typeof socialLinks !== 'object'
        || Array.isArray(additionalInformation) || !additionalInformation || typeof additionalInformation !== 'object') {
        throw new Error('Les deux valeurs doivent être des objets JSON.');
      }
    } catch {
      this.errorMessage = 'Les liens sociaux et les informations complémentaires doivent être des objets JSON valides.';
      return;
    }
    this.saving = true;
    this.configurationService.updateChurchSettings(this.selectedChurchId, {
      ...this.churchSettings,
      social_links: socialLinks,
      additional_information: additionalInformation,
    }).subscribe({
      next: (settings) => {
        this.churchSettings = settings;
        this.saving = false;
        this.successMessage = 'Les paramètres de l’église ont été enregistrés.';
        this.reloadAudit();
      },
      error: (error: HttpErrorResponse) => this.showError(error, 'Impossible d’enregistrer les paramètres de l’église.'),
    });
  }

  selectLogo(field: 'logo_primary' | 'logo_secondary', event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;
    const validType = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type);
    if (!validType || file.size > 3 * 1024 * 1024) {
      this.errorMessage = 'Choisissez une image PNG, JPEG ou WebP de 3 Mo maximum.';
      input.value = '';
      return;
    }
    this.clearFeedback();
    if (field === 'logo_primary') this.selectedLogoPrimary = file;
    else this.selectedLogoSecondary = file;
  }

  uploadLogo(field: 'logo_primary' | 'logo_secondary'): void {
    const file = field === 'logo_primary' ? this.selectedLogoPrimary : this.selectedLogoSecondary;
    if (!this.selectedChurchId || !file) return;
    this.saving = true;
    this.configurationService.uploadChurchLogo(this.selectedChurchId, field, file).subscribe({
      next: (settings) => {
        this.churchSettings = settings;
        if (field === 'logo_primary') this.selectedLogoPrimary = null;
        else this.selectedLogoSecondary = null;
        this.saving = false;
        this.successMessage = 'Le logo a été enregistré.';
        this.reloadAudit();
      },
      error: (error: HttpErrorResponse) => this.showError(error, 'Impossible d’enregistrer ce logo.'),
    });
  }

  removeLogo(field: 'logo_primary' | 'logo_secondary'): void {
    if (!this.selectedChurchId) return;
    this.saving = true;
    this.configurationService.uploadChurchLogo(this.selectedChurchId, field, null).subscribe({
      next: (settings) => {
        this.churchSettings = settings;
        this.saving = false;
        this.successMessage = 'Le logo a été supprimé.';
        this.reloadAudit();
      },
      error: (error: HttpErrorResponse) => this.showError(error, 'Impossible de supprimer ce logo.'),
    });
  }

  trackPermission(_index: number, item: ConfigurationPermission): string {
    return item.code;
  }

  moduleLabel(module: string): string {
    return {
      church_settings: 'Paramètres de l’église',
      users: 'Utilisateurs',
      roles: 'Rôles',
      audit: 'Audit',
      members: 'Membres',
      people: 'Personnes',
      families: 'Familles',
      ministries: 'Ministères et tribus',
      attendance: 'Présences',
      events: 'Événements',
      finance: 'Finances',
      ecodim: 'ECODIM',
      reports: 'Rapports',
    }[module] ?? module;
  }

  scopeLabel(assignment: ConfigurationAssignment): string {
    if (assignment.scope === 'CAMPUS') return `Campus · ${assignment.campus_name}`;
    if (assignment.scope === 'CHURCH') return `Église · ${assignment.church_name}`;
    return 'Organisation';
  }

  private loadAdminData(): void {
    this.loading = true;
    forkJoin({
      permissions: this.configurationService.listPermissions(),
      roles: this.configurationService.listRoles(),
      users: this.configurationService.listUsers(this.searchUsers),
      assignments: this.configurationService.listAssignments(),
      audit: this.configurationService.listAuditLogs(),
      access: this.configurationService.getAccess(),
    }).subscribe({
      next: (data) => {
        this.permissions = data.permissions;
        this.roles = data.roles.results;
        this.users = data.users.results;
        this.assignments = data.assignments.results;
        this.auditLogs = data.audit.results;
        this.canResetPasswords = data.access.is_organization_admin;
        this.loading = false;
        if (this.selectedChurchId) this.loadChurchSettings();
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.getErrorMessage(error, 'Impossible de charger l’administration.');
      },
    });
  }

  private loadChurchSettings(): void {
    if (!this.selectedChurchId) return;
    this.configurationService.getChurchSettings(this.selectedChurchId).subscribe({
      next: (settings) => {
        this.churchSettings = settings;
        this.socialLinksJson = JSON.stringify(settings.social_links ?? {}, null, 2);
        this.additionalInformationJson = JSON.stringify(settings.additional_information ?? {}, null, 2);
      },
      error: (error: HttpErrorResponse) => this.showError(error, 'Impossible de charger les paramètres de l’église.'),
    });
  }

  private loadFinanceConfiguration(): void {
    if (!this.selectedChurchId) {
      this.financeConfiguration = null;
      this.financeConfigurationLoading = false;
      this.financeConfigurationLoadFailed = false;
      this.financeConfigurationRequestId += 1;
      return;
    }
    const requestId = ++this.financeConfigurationRequestId;
    this.financeConfigurationLoading = true;
    this.financeConfigurationLoadFailed = false;
    this.financeConfiguration = null;
    this.financeService.getConfiguration(this.selectedChurchId).subscribe({
      next: (configuration) => {
        if (requestId !== this.financeConfigurationRequestId) return;
        this.financeConfiguration = configuration;
        this.financeConfigurationForm = configuration
          ? this.createFinanceConfigurationForm(configuration)
          : {
              level: 1,
              base_currency: 'XOF',
              is_suspended: false,
              suspension_reason: '',
              reason: '',
            };
        this.financeConfigurationLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        if (requestId !== this.financeConfigurationRequestId) return;
        this.financeConfigurationLoading = false;
        this.financeConfigurationLoadFailed = true;
        this.showError(error, 'Impossible de charger les paramètres financiers.');
      },
    });
  }

  private setFinanceConfigurationForm(configuration: FinancialConfiguration): void {
    this.financeConfigurationForm = this.createFinanceConfigurationForm(configuration);
  }

  private createFinanceConfigurationForm(configuration: FinancialConfiguration): FinanceConfigurationPayload {
    return {
      level: configuration.level,
      base_currency: configuration.base_currency,
      is_suspended: configuration.is_suspended,
      suspension_reason: configuration.suspension_reason,
      reason: '',
    };
  }

  private reloadAudit(): void {
    this.configurationService.listAuditLogs().subscribe({
      next: (data) => this.auditLogs = data.results,
      error: (error: HttpErrorResponse) => this.showError(error, 'Impossible de rafraîchir le journal d’audit.'),
    });
  }

  private showError(error: HttpErrorResponse, fallback: string): void {
    this.saving = false;
    this.errorMessage = this.getErrorMessage(error, fallback);
  }

  private getErrorMessage(error: HttpErrorResponse, fallback: string): string {
    const detail = error.error?.detail;
    if (typeof detail === 'string') return detail;
    if (error.error && typeof error.error === 'object') {
      const firstMessage = Object.values(error.error).flat().find((value) => typeof value === 'string');
      if (typeof firstMessage === 'string') return firstMessage;
    }
    return fallback;
  }

  private clearFeedback(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }
}
