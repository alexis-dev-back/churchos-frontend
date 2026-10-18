import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, startWith } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ConfigurationService } from '../../core/services/configuration.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent implements OnInit {
  @Input() open = false;
  @Output() closeSidebar = new EventEmitter<void>();
  showAdminItems = false;
  showSuperAdminLink = false;
  private showAllModules = false;
  private permissionCodes: string[] = [];

  constructor(
    private authService: AuthService,
    private configurationService: ConfigurationService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd), startWith(null)).subscribe(() => this.loadAdminAccess());
  }

  private loadAdminAccess(): void {
    if (!this.authService.isAuthenticated()) {
      this.showAdminItems = false;
      this.showSuperAdminLink = false;
      this.showAllModules = false;
      this.permissionCodes = [];
      return;
    }
    this.authService.me().subscribe({
      next: (user) => {
        const activeId = user.active_organization?.tenant_id;
        const role = user.organizations.find((organization) => organization.tenant_id === activeId)?.role;
        this.showSuperAdminLink = !!user.is_superuser;
        this.showAdminItems = !user.is_superuser && (role === 'owner' || role === 'admin');
        this.showAllModules = this.showAdminItems;
        if (user.is_superuser || this.showAllModules) {
          this.permissionCodes = [];
          return;
        }
        this.configurationService.getAccess().subscribe({
          next: (access) => this.permissionCodes = access.permission_codes,
          error: () => this.permissionCodes = [],
        });
      },
      error: () => {
        this.showAdminItems = false;
        this.showSuperAdminLink = false;
        this.showAllModules = false;
        this.permissionCodes = [];
      },
    });
  }

  get visibleNavItems(): typeof this.navItems {
    return this.navItems.filter((item) => {
      if (item.dashboardOnly || item.adminOnly) return this.showAdminItems;
      if (item.alwaysVisible) return true;
      if (item.reportOnly) {
        return this.showAllModules
          || this.permissionCodes.includes('finance.read')
          || this.permissionCodes.includes('finance.report.read');
      }
      return !item.permissionModule || this.hasModuleAccess(item.permissionModule);
    });
  }

  isSectionStart(index: number): boolean {
    return index === 0 || this.visibleNavItems[index - 1].section !== this.visibleNavItems[index].section;
  }

  private hasModuleAccess(module: string): boolean {
    return this.showAllModules || this.permissionCodes.some((code) => code.startsWith(`${module}.`));
  }

  navItems: Array<{
    section: string;
    label: string;
    path: string;
    icon: string;
    adminOnly?: boolean;
    alwaysVisible?: boolean;
    dashboardOnly?: boolean;
    reportOnly?: boolean;
    permissionModule?: string;
  }> = [
    { section: 'Administration', label: 'Tableau de bord', path: '/dashboard', icon: '⌂', dashboardOnly: true },
    { section: 'Annuaire', label: 'Membres', path: '/members', icon: 'M', permissionModule: 'members' },
    { section: 'Annuaire', label: 'Personnes', path: '/people', icon: 'P', permissionModule: 'people' },
    { section: 'Annuaire', label: 'Familles', path: '/families', icon: 'F', permissionModule: 'families' },
    { section: 'Annuaire', label: 'Événements', path: '/events', icon: 'É', permissionModule: 'events' },
    { section: 'Annuaire', label: 'Présence et assiduité', path: '/attendance', icon: '✓', permissionModule: 'attendance' },
    { section: 'Finances', label: 'Finances', path: '/finance', icon: '$', permissionModule: 'finance' },
    { section: 'Finances', label: 'Rapports', path: '/finance/reports', icon: '▤', permissionModule: 'finance', reportOnly: true },
    { section: 'Finances', label: 'Journal de caisse', path: '/finance/cash-journal', icon: '↔', permissionModule: 'finance', reportOnly: true },
    { section: 'Formation', label: 'ECODIM', path: '/ecodim', icon: 'E', permissionModule: 'ecodim' },
    { section: 'Annuaire', label: 'Ministères', path: '/ministries', icon: 'Mi', permissionModule: 'ministries' },
    { section: 'Annuaire', label: 'Tribus', path: '/tribes', icon: 'T', permissionModule: 'ministries' },
    { section: 'Mon espace', label: 'Mon profil', path: '/profile', icon: 'U', alwaysVisible: true },
  ];

  adminItems = [
    { label: 'Configuration & administration', path: '/configuration', icon: '⚙' },
    { label: 'Églises', path: '/admin/churches', icon: 'É' },
    { label: 'Campus', path: '/admin/campuses', icon: 'C' },
  ];
}
