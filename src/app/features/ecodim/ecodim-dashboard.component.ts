import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  EcodimChild,
  EcodimChildDetail,
  EcodimClass,
  EcodimContext,
  EcodimDashboard,
  EcodimFamily,
  EcodimMember,
  EcodimPage,
  EcodimStaffAssignment,
} from '../../core/models/ecodim';
import { EcodimService } from '../../core/services/ecodim.service';

type EcodimTab = 'overview' | 'children' | 'classes' | 'staff';

@Component({
  selector: 'app-ecodim-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ecodim-dashboard.component.html',
})
export class EcodimDashboardComponent implements OnInit {
  context: EcodimContext | null = null;
  dashboard: EcodimDashboard | null = null;
  childrenPage: EcodimPage<EcodimChild> | null = null;
  classes: EcodimClass[] = [];
  staff: EcodimStaffAssignment[] = [];
  members: EcodimMember[] = [];
  families: EcodimFamily[] = [];
  selectedChild: EcodimChildDetail | null = null;
  selectedChurchId = '';
  selectedTab: EcodimTab = 'overview';
  search = '';
  familySearch = '';
  familyOptionsOpen = false;
  page = 1;
  loading = true;
  saving = false;
  loadingChild = false;
  showChildForm = false;
  showClassForm = false;
  showStaffForm = false;
  showIdentityForm = false;
  showEnrollmentForm = false;
  showGuardianForm = false;
  showPickupForm = false;
  showSessionForm = false;
  pendingHandoffId = '';
  pendingRevokeAuthorizationId = '';
  handoffNote = '';
  selectedEnrollmentClassId = '';
  errorMessage = '';
  successMessage = '';
  childForm = { first_name: '', last_name: '', date_of_birth: '', gender: '', member: '', family: '' };
  classForm = { name: '', level: '', minimum_age: '', maximum_age: '', capacity: '' };
  pickupForm = { name: '', phone: '', relationship: '', valid_until: '', member: '' };
  guardianForm = { name: '', phone: '', relationship: '', is_legal_guardian: true, is_primary_contact: false, member: '' };
  sessionForm = { title: '', starts_at: '', ends_at: '', location: '', ecodim_class: '' };
  childIdentityForm = { member: '', family: '' };
  staffForm = { member: '', role: 'CHECK_IN' as EcodimStaffAssignment['role'] };

  constructor(private ecodimService: EcodimService) {}

  ngOnInit(): void {
    this.ecodimService.getContext().subscribe({
      next: (context) => {
        this.context = context;
        this.selectedChurchId = context.default_church_id ?? context.churches[0]?.church_id ?? '';
        if (!this.selectedChurchId) {
          this.errorMessage = 'Aucune église ECODIM ne vous est accessible.';
          this.loading = false;
          return;
        }
        this.loadMembers();
        this.loadFamilies();
        this.loadDashboard();
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.handleError(error);
      },
    });
  }

  get selectedChurchName(): string {
    return this.context?.churches.find((church) => church.church_id === this.selectedChurchId)?.name ?? '';
  }

  get hasMultipleChurches(): boolean {
    return (this.context?.churches.length ?? 0) > 1;
  }

  get filteredFamilies(): EcodimFamily[] {
    const query = this.familySearch.trim().toLocaleLowerCase();
    return query
      ? this.families.filter((family) => family.name.toLocaleLowerCase().includes(query))
      : this.families;
  }

  selectFamily(family: EcodimFamily | null): void {
    this.childForm.family = family?.id ?? '';
    this.familySearch = family?.name ?? '';
    this.familyOptionsOpen = false;
  }

  closeEcodimModals(): void {
    this.showChildForm = false;
    this.showClassForm = false;
    this.showSessionForm = false;
    this.showStaffForm = false;
    this.showIdentityForm = false;
    this.showEnrollmentForm = false;
    this.showGuardianForm = false;
    this.showPickupForm = false;
    this.pendingHandoffId = '';
    this.pendingRevokeAuthorizationId = '';
  }

  searchFamilyNames(query: string): void {
    this.familySearch = query;
    this.childForm.family = '';
    this.familyOptionsOpen = true;
  }

  get maxRegistrationCount(): number {
    return Math.max(1, ...(this.dashboard?.registrations_by_month.flatMap((item) => [item.children, item.adolescents]) ?? []));
  }

  get ageDonutBackground(): string {
    const counts = this.dashboard?.age_distribution.map((item) => item.count) ?? [];
    const total = counts.reduce((sum, count) => sum + count, 0);
    if (!total) {
      return '#edf2ef';
    }
    const colors = ['#2879ef', '#20b685', '#7a56df', '#f28b27', '#e879a9', '#b3bfba'];
    let offset = 0;
    const segments = counts.map((count, index) => {
      const start = offset;
      offset += count / total * 100;
      return `${colors[index % colors.length]} ${start}% ${offset}%`;
    });
    return `conic-gradient(${segments.join(', ')})`;
  }

  registrationLine(series: 'children' | 'adolescents'): string {
    const values = this.dashboard?.registrations_by_month ?? [];
    if (!values.length) {
      return '';
    }
    return values.map((item, index) => {
      const x = values.length === 1 ? 50 : index * (100 / (values.length - 1));
      const y = 82 - (item[series] / this.maxRegistrationCount) * 65;
      return `${x},${y}`;
    }).join(' ');
  }

  setTab(tab: EcodimTab): void {
    this.selectedTab = tab;
    this.errorMessage = '';
    this.successMessage = '';
    if (tab === 'children') {
      this.page = 1;
      this.loadChildren();
    } else if (tab === 'classes') {
      this.loadClasses();
    } else if (tab === 'staff') {
      this.loadStaff();
    }
  }

  onChurchChange(): void {
    this.dashboard = null;
    this.childrenPage = null;
    this.classes = [];
    this.members = [];
    this.families = [];
    this.loadMembers();
    this.loadFamilies();
    this.loadDashboard();
  }

  loadMembers(): void {
    if (!this.selectedChurchId) {
      return;
    }
    this.ecodimService.getLinkableMembers(this.selectedChurchId).subscribe({
      next: (members) => this.members = members,
      error: (error: HttpErrorResponse) => this.handleError(error),
    });
  }

  loadFamilies(): void {
    if (!this.selectedChurchId) {
      return;
    }
    this.ecodimService.getLinkableFamilies(this.selectedChurchId).subscribe({
      next: (families) => this.families = families,
      error: (error: HttpErrorResponse) => this.handleError(error),
    });
  }

  loadDashboard(): void {
    if (!this.selectedChurchId) {
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.ecodimService.getDashboard(this.selectedChurchId).subscribe({
      next: (dashboard) => {
        this.dashboard = dashboard;
        this.loading = false;
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.handleError(error);
      },
    });
  }

  loadChildren(): void {
    if (!this.selectedChurchId) {
      return;
    }
    this.loading = true;
    this.ecodimService.getChildren(this.selectedChurchId, this.page, this.search).subscribe({
      next: (page) => {
        this.childrenPage = page;
        this.loading = false;
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.handleError(error);
      },
    });
  }

  loadClasses(): void {
    if (!this.selectedChurchId) {
      return;
    }
    this.loading = true;
    this.ecodimService.getClasses(this.selectedChurchId).subscribe({
      next: (classes) => {
        this.classes = classes;
        this.loading = false;
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.handleError(error);
      },
    });
  }

  loadStaff(): void {
    if (!this.selectedChurchId) {
      return;
    }
    this.loading = true;
    this.ecodimService.getStaff(this.selectedChurchId).subscribe({
      next: (staff) => {
        this.staff = staff;
        this.loading = false;
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.handleError(error);
      },
    });
  }

  submitStaff(): void {
    if (!this.selectedChurchId || !this.staffForm.member || this.saving) {
      return;
    }
    this.saving = true;
    this.errorMessage = '';
    this.ecodimService.assignStaff(this.selectedChurchId, this.staffForm.member, this.staffForm.role).subscribe({
      next: () => {
        this.saving = false;
        this.showStaffForm = false;
        this.staffForm = { member: '', role: 'CHECK_IN' };
        this.successMessage = 'Le membre a été affecté à l’équipe ECODIM.';
        this.loadStaff();
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.handleError(error);
      },
    });
  }

  toggleStaff(assignment: EcodimStaffAssignment): void {
    this.ecodimService.updateStaff(assignment.id, !assignment.is_active).subscribe({
      next: () => {
        this.successMessage = assignment.is_active ? 'L’affectation a été désactivée.' : 'L’affectation a été réactivée.';
        this.loadStaff();
      },
      error: (error: HttpErrorResponse) => this.handleError(error),
    });
  }

  openChild(child: EcodimChild): void {
    this.loadingChild = true;
    this.selectedChild = null;
    this.showPickupForm = false;
    this.showGuardianForm = false;
    this.showIdentityForm = false;
    this.showEnrollmentForm = false;
    this.pendingHandoffId = '';
    this.pendingRevokeAuthorizationId = '';
    this.selectedEnrollmentClassId = child.current_class_id ?? '';
    if (this.context?.can_manage) {
      this.ecodimService.getClasses(this.selectedChurchId).subscribe({
        next: (classes) => this.classes = classes,
        error: (error: HttpErrorResponse) => this.handleError(error),
      });
    }
    this.ecodimService.getChild(child.id).subscribe({
      next: (detail) => {
        this.selectedChild = detail;
        this.selectedEnrollmentClassId = detail.current_class_id ?? '';
        this.childIdentityForm = { member: detail.member ?? '', family: detail.family ?? '' };
        this.loadingChild = false;
      },
      error: (error: HttpErrorResponse) => {
        this.loadingChild = false;
        this.handleError(error);
      },
    });
  }

  closeChild(): void {
    this.selectedChild = null;
    this.showPickupForm = false;
    this.showGuardianForm = false;
    this.showIdentityForm = false;
    this.showEnrollmentForm = false;
    this.pendingHandoffId = '';
    this.pendingRevokeAuthorizationId = '';
  }

  submitPickupAuthorization(): void {
    const child = this.selectedChild;
    if (!child || this.saving) {
      return;
    }
    this.saving = true;
    this.errorMessage = '';
    this.ecodimService.createPickupAuthorization(child.id, {
      name: this.pickupForm.name.trim(),
      phone: this.pickupForm.phone.trim(),
      relationship: this.pickupForm.relationship.trim(),
      valid_until: this.pickupForm.valid_until || null,
      member: this.pickupForm.member || null,
    }).subscribe({
      next: () => {
        this.saving = false;
        this.showPickupForm = false;
        this.pickupForm = { name: '', phone: '', relationship: '', valid_until: '', member: '' };
        this.successMessage = 'La personne a été ajoutée à la liste des personnes autorisées.';
        this.openChild(child);
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.handleError(error);
      },
    });
  }

  submitGuardian(): void {
    const child = this.selectedChild;
    if (!child || this.saving) {
      return;
    }
    this.saving = true;
    this.errorMessage = '';
    this.ecodimService.createGuardian(child.id, {
      ...this.guardianForm,
      name: this.guardianForm.name.trim(),
      phone: this.guardianForm.phone.trim(),
      relationship: this.guardianForm.relationship.trim(),
      member: this.guardianForm.member || null,
    }).subscribe({
      next: () => {
        this.saving = false;
        this.showGuardianForm = false;
        this.guardianForm = { name: '', phone: '', relationship: '', is_legal_guardian: true, is_primary_contact: false, member: '' };
        this.successMessage = 'Le responsable a été ajouté au dossier.';
        this.openChild(child);
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.handleError(error);
      },
    });
  }

  confirmHandoff(): void {
    const child = this.selectedChild;
    if (!child || !this.pendingHandoffId || this.saving) {
      return;
    }
    this.saving = true;
    this.errorMessage = '';
    this.ecodimService.recordHandoff(child.id, this.pendingHandoffId, this.handoffNote.trim()).subscribe({
      next: () => {
        this.saving = false;
        this.pendingHandoffId = '';
        this.handoffNote = '';
        this.successMessage = 'La remise de l’enfant a été enregistrée.';
        this.openChild(child);
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.handleError(error);
      },
    });
  }

  confirmRevokeAuthorization(): void {
    const child = this.selectedChild;
    const authorizationId = this.pendingRevokeAuthorizationId;
    if (!child || !authorizationId || this.saving) {
      return;
    }
    this.saving = true;
    this.errorMessage = '';
    this.ecodimService.revokePickupAuthorization(child.id, authorizationId).subscribe({
      next: () => {
        this.saving = false;
        this.pendingRevokeAuthorizationId = '';
        this.successMessage = 'L’autorisation de récupération a été révoquée.';
        this.openChild(child);
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.handleError(error);
      },
    });
  }

  enrollSelectedChild(): void {
    const child = this.selectedChild;
    if (!child || !this.selectedEnrollmentClassId || this.saving) {
      return;
    }
    this.saving = true;
    this.errorMessage = '';
    this.ecodimService.enrollChild(child.id, this.selectedEnrollmentClassId).subscribe({
      next: () => {
        this.saving = false;
        this.showEnrollmentForm = false;
        this.successMessage = 'L’enfant a été affecté à la classe.';
        this.loadDashboard();
        this.openChild(child);
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.handleError(error);
      },
    });
  }

  updateChildIdentity(): void {
    const child = this.selectedChild;
    if (!child || this.saving) {
      return;
    }
    this.saving = true;
    this.errorMessage = '';
    this.ecodimService.updateChildIdentity(child.id, {
      member: this.childIdentityForm.member || null,
      family: this.childIdentityForm.family || null,
    }).subscribe({
      next: () => {
        this.saving = false;
        this.showIdentityForm = false;
        this.successMessage = 'Le rattachement au répertoire a été mis à jour.';
        this.loadDashboard();
        this.openChild(child);
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.handleError(error);
      },
    });
  }

  submitChild(): void {
    if (!this.selectedChurchId || this.saving) {
      return;
    }
    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.ecodimService.createChild({
      church_id: this.selectedChurchId,
      first_name: this.childForm.first_name.trim(),
      last_name: this.childForm.last_name.trim(),
      date_of_birth: this.childForm.date_of_birth || null,
      gender: this.childForm.gender,
      member: this.childForm.member || null,
      family: this.childForm.family || null,
    }).subscribe({
      next: () => {
        this.saving = false;
        this.showChildForm = false;
        this.childForm = { first_name: '', last_name: '', date_of_birth: '', gender: '', member: '', family: '' };
        this.familySearch = '';
        this.familyOptionsOpen = false;
        this.successMessage = 'Le dossier de l’enfant a été créé.';
        this.loadDashboard();
        if (this.selectedTab === 'children') {
          this.loadChildren();
        }
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.handleError(error);
      },
    });
  }

  submitClass(): void {
    if (!this.selectedChurchId || this.saving) {
      return;
    }
    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.ecodimService.createClass({
      church_id: this.selectedChurchId,
      name: this.classForm.name.trim(),
      level: this.classForm.level.trim(),
      minimum_age: this.classForm.minimum_age ? Number(this.classForm.minimum_age) : null,
      maximum_age: this.classForm.maximum_age ? Number(this.classForm.maximum_age) : null,
      capacity: this.classForm.capacity ? Number(this.classForm.capacity) : null,
    }).subscribe({
      next: () => {
        this.saving = false;
        this.showClassForm = false;
        this.classForm = { name: '', level: '', minimum_age: '', maximum_age: '', capacity: '' };
        this.successMessage = 'La classe a été créée.';
        this.loadDashboard();
        if (this.selectedTab === 'classes') {
          this.loadClasses();
        }
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.handleError(error);
      },
    });
  }

  submitSession(): void {
    if (!this.selectedChurchId || this.saving) {
      return;
    }
    this.saving = true;
    this.errorMessage = '';
    this.ecodimService.createSession({
      church_id: this.selectedChurchId,
      title: this.sessionForm.title.trim(),
      starts_at: this.sessionForm.starts_at,
      ends_at: this.sessionForm.ends_at,
      location: this.sessionForm.location.trim(),
      ecodim_class: this.sessionForm.ecodim_class || null,
    }).subscribe({
      next: () => {
        this.saving = false;
        this.showSessionForm = false;
        this.sessionForm = { title: '', starts_at: '', ends_at: '', location: '', ecodim_class: '' };
        this.successMessage = 'La séance a été programmée.';
        this.loadDashboard();
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.handleError(error);
      },
    });
  }

  searchChildren(): void {
    this.page = 1;
    this.loadChildren();
  }

  searchDashboardChildren(): void {
    this.setTab('children');
  }

  changePage(delta: number): void {
    const nextPage = this.page + delta;
    if (nextPage < 1 || (this.childrenPage && !this.childrenPage.next && delta > 0)) {
      return;
    }
    this.page = nextPage;
    this.loadChildren();
  }

  isPickupAuthorizationCurrentlyValid(authorization: EcodimChildDetail['pickup_authorizations'][number]): boolean {
    const today = new Date();
    const todayLocal = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return authorization.status === 'ACTIVE'
      && authorization.valid_from <= todayLocal
      && (!authorization.valid_until || authorization.valid_until >= todayLocal);
  }

  private handleError(error: HttpErrorResponse): void {
    const detail = error.error?.detail;
    const fieldError = error.error && typeof error.error === 'object'
      ? Object.values(error.error).flat().find((value) => typeof value === 'string')
      : null;
    this.errorMessage = typeof detail === 'string'
      ? detail
      : typeof fieldError === 'string'
        ? fieldError
        : 'Une erreur est survenue lors du chargement des données ECODIM.';
  }
}