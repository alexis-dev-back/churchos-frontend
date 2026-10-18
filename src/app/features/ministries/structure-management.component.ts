import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Member } from '../../core/models/member';
import {
  ChurchStructure,
  LeadershipRole,
  StructureAssignment,
  StructureKind,
  StructureLeadership,
  StructureStatus,
  StructureWriteRequest,
} from '../../core/models/ministry-tribe';
import { ChurchEvent } from '../../core/models/event';
import { MemberService } from '../../core/services/member.service';
import { MinistryTribeService } from '../../core/services/ministry-tribe.service';
import { TenantService } from '../../core/services/tenant.service';
import { EventService } from '../../core/services/event.service';
import { Church } from '../../core/models/tenant';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="page" [class.ministry-page]="kind === 'ministries' && !structureId">
      <ng-container *ngIf="!structureId; else detailPage">
        <ng-container *ngIf="kind === 'ministries'; else legacyList">
          <nav class="breadcrumbs"><a routerLink="/dashboard">Accueil</a><span>›</span><strong>Ministères</strong></nav>
          <header class="ministry-heading">
            <div class="ministry-title"><span class="title-icon">✥</span><div><h1>Ministères</h1><p>Organisez et gérez les différents ministères de votre église.</p></div></div>
            <div class="heading-actions"><button class="primary" type="button" (click)="openCreate()" [disabled]="!selectedChurchId"><span>＋</span> Créer un ministère</button><button class="icon-button" type="button" aria-label="Actualiser" (click)="refreshStructures()">···</button></div>
          </header>
          <p class="notice error" *ngIf="errorMessage" role="alert">{{ errorMessage }}</p>
          <p class="notice success" *ngIf="successMessage" role="status">{{ successMessage }}</p>
          <div class="ministry-layout">
            <div class="ministry-main">
              <div class="metric-grid">
                <article class="metric-card"><span class="metric-icon blue">♟</span><small>Total des ministères</small><strong>{{ structures.length }}</strong><span class="metric-note">Dans l’église sélectionnée</span></article>
                <article class="metric-card"><span class="metric-icon green">♟</span><small>Affectations actives</small><strong>{{ totalActiveAssignments }}</strong><span class="metric-note">Membres impliqués</span></article>
                <article class="metric-card"><span class="metric-icon purple">♙</span><small>Responsables</small><strong>{{ totalActiveLeaders }}</strong><span class="metric-note">Responsabilités actives</span></article>
                <article class="metric-card"><span class="metric-icon orange">◉</span><small>Événements ce mois</small><strong>{{ ministryEventsAvailable ? ministryEvents.length : '—' }}</strong><span class="metric-note">{{ ministryEventsAvailable ? 'Pour cette église' : 'Accès événements requis' }}</span></article>
              </div>
              <section class="ministry-table-panel">
                <div class="ministry-filters">
                  <label class="search-control"><span>⌕</span><input type="search" aria-label="Rechercher un ministère" placeholder="Rechercher un ministère, un responsable..." [value]="search" (input)="search = inputValue($event); ministryPage = 0" /></label>
                  <select aria-label="Filtrer par statut" [value]="statusFilter" (change)="setStatusFilter($event)"><option value="ALL">Tous les statuts</option><option value="ACTIVE">Actifs</option><option value="INACTIVE">Inactifs</option><option value="ARCHIVED">Archivés</option></select>
                  <select aria-label="Filtrer par secteur" [value]="sectorFilter" (change)="sectorFilter = selectValue($event); ministryPage = 0"><option value="ALL">Tous les secteurs</option><option *ngFor="let sector of ministrySectors" [value]="sector">{{ sector }}</option></select>
                  <select aria-label="Filtrer par responsable" [value]="leaderFilter" (change)="leaderFilter = selectValue($event); ministryPage = 0"><option value="ALL">Tous les responsables</option><option *ngFor="let leader of ministryLeaders" [value]="leader">{{ leader }}</option></select>
                  <select *ngIf="!churchSelectionFixed" aria-label="Choisir une église" [value]="selectedChurchId" (change)="selectChurch($event)"><option value="">Choisir une église</option><option *ngFor="let church of churches" [value]="church.church_id">{{ church.name }}</option></select>
                  <button class="filter-button" type="button" (click)="toggleInactive()">{{ showInactive ? 'Masquer inactifs' : 'Filtres' }} <span>☷</span></button>
                </div>
                <div class="table-wrap">
                  <table class="ministry-table">
                    <thead><tr><th><input type="checkbox" aria-label="Sélectionner tous les ministères" [checked]="allVisibleSelected" (change)="toggleVisibleSelection($event)" /></th><th>Nom du ministère</th><th>Responsable</th><th>Membres</th><th>Statut</th><th>Secteur</th><th>Actions</th></tr></thead>
                    <tbody>
                      <tr *ngFor="let item of pagedMinistries; let i = index" [class.selected-row]="selectedMinistry?.id === item.id" (click)="selectMinistry(item)">
                        <td><input type="checkbox" [attr.aria-label]="'Sélectionner ' + item.name" [checked]="selectedMinistryIds.has(item.id)" (click)="$event.stopPropagation()" (change)="toggleMinistrySelection(item.id, $event)" /></td>
                        <td><div class="ministry-name-cell"><span class="ministry-symbol" [ngClass]="'tone-' + (i % 6)">{{ ministryIcon(item.name) }}</span><span><strong>{{ item.name }}</strong><small>{{ item.description || 'Ministère de l’église' }}</small></span></div></td>
                        <td><div class="leader-cell"><span class="mini-avatar">{{ initials(item.leader_name) }}</span><span><strong>{{ item.leader_name || 'À désigner' }}</strong><small>{{ item.leader_name ? 'Responsable principal' : 'Aucun responsable' }}</small></span></div></td>
                        <td>{{ item.active_members_count || 0 }}</td>
                        <td><span class="ministry-status" [attr.data-status]="item.status">{{ statusText(item.status) }}</span></td>
                        <td class="sector-cell">{{ item.sector || '—' }}</td>
                        <td><button class="row-action" type="button" [attr.aria-label]="'Ouvrir ' + item.name" (click)="$event.stopPropagation(); selectMinistry(item)">···</button></td>
                      </tr>
                      <tr *ngIf="!loading && !pagedMinistries.length"><td colspan="7" class="empty-cell">{{ selectedChurchId ? 'Aucun ministère correspondant.' : 'Choisissez une église pour afficher ses ministères.' }}</td></tr>
                      <tr *ngIf="loading"><td colspan="7" class="empty-cell">Chargement des ministères…</td></tr>
                    </tbody>
                  </table>
                </div>
                <footer class="table-footer"><span>Affichage de {{ ministryRangeStart }} à {{ ministryRangeEnd }} sur {{ filteredStructures.length }} ministère(s)</span><div class="pagination"><button type="button" aria-label="Page précédente" [disabled]="ministryPage === 0" (click)="ministryPage = ministryPage - 1">‹</button><button type="button" class="current-page">{{ ministryPage + 1 }}</button><button type="button" aria-label="Page suivante" [disabled]="ministryPage + 1 >= ministryPageCount" (click)="ministryPage = ministryPage + 1">›</button></div></footer>
              </section>
            </div>
            <aside class="ministry-details" *ngIf="selectedMinistry as item">
              <div class="ministry-cover"><span class="cover-note">✦ Ministère de l’église</span><span class="cover-music">{{ ministryIcon(item.name) }}</span></div>
              <div class="detail-summary"><div class="detail-name"><div><h2>{{ item.name }}</h2><p>{{ item.description || 'Servir et grandir ensemble dans la foi.' }}</p></div><span class="ministry-status" [attr.data-status]="item.status">{{ statusText(item.status) }}</span></div>
                <nav class="detail-tabs" aria-label="Sections du ministère"><button type="button" [class.active]="ministryPanelTab === 'DETAILS'" (click)="ministryPanelTab = 'DETAILS'">Détails</button><button type="button" [class.active]="ministryPanelTab === 'MEMBERS'" (click)="ministryPanelTab = 'MEMBERS'">Membres</button><button type="button" [class.active]="ministryPanelTab === 'EVENTS'" (click)="ministryPanelTab = 'EVENTS'">Événements</button><button type="button" [class.active]="ministryPanelTab === 'ACTIVITIES'" (click)="ministryPanelTab = 'ACTIVITIES'">Activités</button></nav>
              </div>
              <section class="detail-card" *ngIf="ministryPanelTab === 'DETAILS'"><h3>Informations générales</h3><div class="info-row"><span class="info-icon">♙</span><div><small>Responsable</small><strong>{{ selectedMinistryLeader?.member_name || 'À désigner' }}</strong><small *ngIf="selectedMinistryLeaderMember">{{ selectedMinistryLeaderMember.email }}</small></div></div><div class="info-row" *ngIf="selectedMinistryLeaderMember?.phone"><span class="info-icon">☎</span><div><small>Téléphone</small><strong>{{ selectedMinistryLeaderMember?.phone }}</strong></div></div><div class="info-row"><span class="info-icon">✉</span><div><small>Description</small><strong>{{ item.description || 'Non renseignée' }}</strong></div></div><div class="info-row"><span class="info-icon">◉</span><div><small>Secteur</small><strong>{{ item.sector || 'Non renseigné' }}</strong></div></div><div class="info-row"><span class="info-icon">✓</span><div><small>Statut</small><strong><span class="ministry-status" [attr.data-status]="item.status">{{ statusText(item.status) }}</span></strong></div></div></section>
              <section class="detail-card" *ngIf="ministryPanelTab === 'MEMBERS'"><header class="side-card-heading"><h3>Membres du ministère ({{ activeMinistryAssignments.length }})</h3><a [routerLink]="['/', kind, item.id]">Gérer</a></header><div class="member-list"><div class="member-list-row" *ngFor="let assignment of activeMinistryAssignments.slice(0, 8)"><span class="mini-avatar">{{ initials(assignment.member_name) }}</span><span><strong>{{ assignment.member_name }}</strong><small>{{ memberRole(assignment.member) }}</small></span></div><p class="empty-cell" *ngIf="!activeMinistryAssignments.length">Aucun membre affecté.</p></div></section>
              <section class="detail-card" *ngIf="ministryPanelTab === 'EVENTS'"><header class="side-card-heading"><h3>Événements de l’église</h3><a routerLink="/events">Voir tout</a></header><div class="side-event" *ngFor="let event of ministryEvents.slice(0, 4)"><strong>{{ event.title }}</strong><small>{{ event.occurrences.length ? (event.occurrences[0].starts_at | date:'dd/MM/yyyy HH:mm') : 'Date à définir' }}</small></div><p class="empty-cell" *ngIf="!ministryEvents.length">{{ ministryEventsAvailable ? 'Aucun événement prévu ce mois-ci.' : 'Les droits de gestion des événements sont nécessaires pour consulter cette liste.' }}</p></section>
              <section class="detail-card" *ngIf="ministryPanelTab === 'ACTIVITIES'"><h3>Activités récentes</h3><div class="activity-row"><span class="activity-dot"></span><span><strong>Ministère créé</strong><small>{{ item.created_at | date:'dd/MM/yyyy HH:mm' }}</small></span></div><div class="activity-row"><span class="activity-dot"></span><span><strong>Dernière mise à jour</strong><small>{{ item.updated_at | date:'dd/MM/yyyy HH:mm' }}</small></span></div></section>
              <section class="detail-card quick-actions"><h3>Actions rapides</h3><a [routerLink]="['/', kind, item.id]"><span>♟</span> Voir les membres</a><a routerLink="/events"><span>▦</span> Planifier un événement</a><a routerLink="/events"><span>▦</span> Voir le calendrier</a><blockquote>« Louez l’Éternel, car il est bon, car sa miséricorde dure à toujours. »<small>Psaume 136:1</small></blockquote></section>
            </aside>
            <aside class="ministry-details ministry-placeholder" *ngIf="!selectedMinistry"><p>Sélectionnez un ministère pour afficher ses informations.</p></aside>
          </div>
          <div class="backdrop" *ngIf="formOpen" (click)="formOpen = false"><form class="modal" [formGroup]="structureForm" (ngSubmit)="saveStructure()" (click)="$event.stopPropagation()"><header><h2>{{ editing ? 'Modifier' : 'Créer' }} un ministère</h2><button type="button" class="close" (click)="formOpen = false">×</button></header><label *ngIf="!churchSelectionFixed">Église<select formControlName="church_id"><option value="">Choisir une église</option><option *ngFor="let church of churches" [value]="church.church_id">{{ church.name }}</option></select></label><label>Nom *<input formControlName="name" /></label><label>Secteur<select formControlName="sector"><option value="">Choisir un secteur</option><option *ngFor="let sector of availableSectors" [value]="sector">{{ sector }}</option></select></label><label>Description<textarea formControlName="description"></textarea></label><label *ngIf="editing">Statut<select formControlName="status"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="ARCHIVED">Archivée</option></select></label><div class="actions"><button class="primary" type="submit" [disabled]="structureForm.invalid || saving">{{ saving ? 'Enregistrement…' : 'Enregistrer' }}</button><button class="secondary" type="button" (click)="formOpen = false">Annuler</button></div></form></div>
        </ng-container>
        <ng-template #legacyList>
        <header class="heading">
          <div><p class="eyebrow">VIE DE L’ÉGLISE</p><h1>{{ title }}</h1><p>Gérez les structures, leurs membres et leurs responsables.</p></div>
          <button class="primary" type="button" (click)="openCreate()" [disabled]="!selectedChurchId">Nouvelle {{ singular }}</button>
        </header>
        <p class="notice error" *ngIf="errorMessage" role="alert">{{ errorMessage }}</p>
        <p class="notice success" *ngIf="successMessage" role="status">{{ successMessage }}</p>
        <div class="toolbar">
          <label *ngIf="!churchSelectionFixed">Église<select [value]="selectedChurchId" (change)="selectChurch($event)"><option value="">Choisir une église</option><option *ngFor="let church of churches" [value]="church.church_id">{{ church.name }}</option></select></label>
          <label>Recherche<input type="search" [value]="search" (input)="search = inputValue($event)" placeholder="Nom de la structure" /></label>
          <label>Statut<select [value]="statusFilter" (change)="setStatusFilter($event)"><option value="ALL">Tous</option><option value="ACTIVE">Actives</option><option value="INACTIVE">Inactives</option><option value="ARCHIVED">Archivées</option></select></label>
        </div>
        <p *ngIf="loading" class="empty">Chargement…</p>
        <div class="cards" *ngIf="!loading">
          <article class="card" *ngFor="let item of filteredStructures">
            <div class="card-heading"><div><h2>{{ item.name }}</h2><p>{{ item.church_name }}</p></div><span class="status" [attr.data-status]="item.status">{{ statusText(item.status) }}</span></div>
            <p class="description">{{ item.description || 'Aucune description.' }}</p>
            <a [routerLink]="['/', kind, item.id]">Ouvrir le dossier →</a>
          </article>
          <p class="empty" *ngIf="!filteredStructures.length">{{ selectedChurchId ? 'Aucune structure correspondante.' : 'Choisissez une église pour afficher ses structures.' }}</p>
        </div>
        <div class="backdrop" *ngIf="formOpen" (click)="formOpen = false">
          <form class="modal" [formGroup]="structureForm" (ngSubmit)="saveStructure()" (click)="$event.stopPropagation()">
            <header><h2>{{ editing ? 'Modifier' : 'Créer' }} {{ singular }}</h2><button type="button" class="close" (click)="formOpen = false">×</button></header>
            <label *ngIf="!churchSelectionFixed">Église<select formControlName="church_id"><option value="">Choisir une église</option><option *ngFor="let church of churches" [value]="church.church_id">{{ church.name }}</option></select></label>
            <label>Nom *<input formControlName="name" /></label>
            <label>Secteur<select formControlName="sector"><option value="">Choisir un secteur</option><option *ngFor="let sector of availableSectors" [value]="sector">{{ sector }}</option></select></label>
            <label>Description<textarea formControlName="description"></textarea></label>
            <label *ngIf="editing">Statut<select formControlName="status"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="ARCHIVED">Archivée</option></select></label>
            <div class="actions"><button class="primary" type="submit" [disabled]="structureForm.invalid || saving">{{ saving ? 'Enregistrement…' : 'Enregistrer' }}</button><button class="secondary" type="button" (click)="formOpen = false">Annuler</button></div>
          </form>
        </div>
        </ng-template>
      </ng-container>

      <ng-template #detailPage>
        <a class="back-link" [routerLink]="['/', kind]">← Retour aux {{ title.toLocaleLowerCase() }}</a>
        <p class="notice error" *ngIf="errorMessage" role="alert">{{ errorMessage }}</p>
        <p class="notice success" *ngIf="successMessage" role="status">{{ successMessage }}</p>
        <p class="empty" *ngIf="loading">Chargement du dossier…</p>
        <ng-container *ngIf="structure as item">
          <header class="heading detail-heading">
            <div><p class="eyebrow">{{ item.church_name }}</p><h1>{{ item.name }}</h1><p>{{ item.description || 'Aucune description.' }}</p></div>
            <button class="secondary" type="button" (click)="editStructure(item)">Modifier la fiche</button>
          </header>
          <div class="status-actions">
            <span>Statut : <strong>{{ statusText(item.status) }}</strong></span>
            <button type="button" class="quiet" *ngIf="item.status === 'ACTIVE'" (click)="changeStatus('INACTIVE')">Désactiver</button>
            <button type="button" class="quiet" *ngIf="item.status !== 'ACTIVE'" (click)="changeStatus('ACTIVE')">Réactiver</button>
            <button type="button" class="danger" *ngIf="item.status !== 'ARCHIVED'" (click)="changeStatus('ARCHIVED')">Archiver</button>
          </div>
          <div class="detail-grid">
            <section class="panel">
              <header><div><h2>Membres affectés</h2><p>Les périodes clôturées restent dans l’historique.</p></div></header>
              <div class="form-row">
                <select [value]="selectedMemberId" (change)="selectedMemberId = selectValue($event)"><option value="">Choisir un membre actif</option><option *ngFor="let member of eligibleMembers" [value]="member.id">{{ member.first_name }} {{ member.last_name }}</option></select>
                <label class="checkbox" *ngIf="kind === 'tribes'"><input type="checkbox" [checked]="replaceTribeAssignment" (change)="replaceTribeAssignment = checkboxValue($event)" /> Changer sa tribu actuelle</label>
                <button type="button" class="primary" [disabled]="!selectedMemberId || saving || item.status !== 'ACTIVE'" (click)="assignMember()">Affecter</button>
              </div>
              <div class="record" *ngFor="let assignment of assignments">
                <div><strong>{{ assignment.member_name }}</strong><small>{{ assignment.joined_at | date:'dd/MM/yyyy HH:mm' }}<ng-container *ngIf="assignment.left_at"> → {{ assignment.left_at | date:'dd/MM/yyyy HH:mm' }}</ng-container></small><small *ngIf="assignment.ended_reason">{{ assignment.ended_reason }}</small></div>
                <button *ngIf="!assignment.left_at" type="button" class="quiet" (click)="endAssignment(assignment)">Clôturer</button>
                <span *ngIf="assignment.left_at" class="historic">Historique</span>
              </div>
              <p class="empty" *ngIf="!assignments.length">Aucune affectation enregistrée.</p>
            </section>
            <section class="panel">
              <header><div><h2>Responsables et adjoints</h2><p>Les responsabilités sont historisées.</p></div></header>
              <div class="form-row">
                <select [value]="selectedLeaderId" (change)="selectedLeaderId = selectValue($event)"><option value="">Choisir un membre actif</option><option *ngFor="let member of eligibleMembers" [value]="member.id">{{ member.first_name }} {{ member.last_name }}</option></select>
                <select [value]="selectedLeaderRole" (change)="selectLeaderRole($event)"><option value="LEADER">Responsable principal</option><option value="ADJOINT">Adjoint</option></select>
                <button type="button" class="primary" [disabled]="!selectedLeaderId || saving || item.status !== 'ACTIVE'" (click)="appointLeader()">Désigner</button>
              </div>
              <div class="record" *ngFor="let leader of leadership">
                <div><strong>{{ leader.member_name }}</strong><small>{{ leader.role === 'LEADER' ? 'Responsable principal' : 'Adjoint' }} · {{ leader.started_at | date:'dd/MM/yyyy' }}<ng-container *ngIf="leader.ended_at"> → {{ leader.ended_at | date:'dd/MM/yyyy' }}</ng-container></small><small *ngIf="leader.ended_reason">{{ leader.ended_reason }}</small></div>
                <button *ngIf="!leader.ended_at" type="button" class="quiet" (click)="endLeadership(leader)">Retirer</button>
                <span *ngIf="leader.ended_at" class="historic">Historique</span>
              </div>
              <p class="empty" *ngIf="!leadership.length">Aucun responsable ou adjoint enregistré.</p>
            </section>
          </div>
        </ng-container>
      </ng-template>
    </section>
  `,
  styles: [`
    :host{display:block;color:#25323a}.page{max-width:1320px;margin:0 auto;padding-bottom:30px}.heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}.eyebrow{margin:0 0 6px;color:#148451;font-size:.72rem;font-weight:800}.heading h1{margin:0;font-size:1.7rem}.heading p:not(.eyebrow){margin:5px 0 0;color:#718087}.primary,.secondary,.quiet,.danger{min-height:38px;padding:8px 12px;border:1px solid #176b50;background:#176b50;color:white;font-weight:700;cursor:pointer}.secondary,.quiet{border-color:#d4dfdc;background:#fff;color:#34434a}.danger{border-color:#bb4444;background:#fff;color:#a33434}.primary:disabled{opacity:.55;cursor:not-allowed}.toolbar{display:flex;align-items:end;gap:12px;margin-bottom:16px;padding:14px;background:#fff;border:1px solid #e0e6e6}.toolbar label,.modal label{display:grid;gap:6px;color:#53615e;font-size:.8rem;font-weight:700}.toolbar select,.toolbar input,.modal input,.modal textarea,.modal select,.form-row select{min-height:38px;padding:8px 10px;border:1px solid #cfd9d6;background:#fff;color:#25323a;font:inherit}.toolbar input{min-width:200px}.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:14px}.card,.panel{padding:17px;background:#fff;border:1px solid #e0e6e6}.card-heading{display:flex;justify-content:space-between;gap:10px}.card h2{margin:0;font-size:1rem}.card p{margin:5px 0;color:#738087;font-size:.8rem}.card .description{min-height:38px;margin:14px 0;color:#55636a;line-height:1.45}.card a,.back-link{color:#176b50;font-size:.82rem;font-weight:700;text-decoration:none}.status{height:max-content;padding:5px 8px;background:#e6f3e9;color:#256844;font-size:.7rem;font-weight:800}.status[data-status=INACTIVE]{background:#fff2d8;color:#8a5a0a}.status[data-status=ARCHIVED]{background:#f1e9e9;color:#834747}.empty{padding:20px;color:#748188;text-align:center}.notice{padding:10px 12px;margin:0 0 14px}.notice.error{background:#fff0ef;color:#a13333}.notice.success{background:#e9f5ed;color:#23613a}.back-link{display:inline-block;margin:0 0 18px}.status-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap;padding:12px 14px;margin-bottom:14px;background:#fff;border:1px solid #e0e6e6;font-size:.83rem}.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.panel>header{margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #edf0f0}.panel h2{margin:0;font-size:1rem}.panel header p{margin:5px 0 0;color:#748188;font-size:.78rem}.form-row{display:flex;align-items:center;gap:8px;margin-bottom:12px}.form-row select:first-child{flex:1;min-width:140px}.checkbox{display:flex;align-items:center;gap:5px;font-size:.76rem;color:#53615e}.record{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid #edf0f0}.record>div{display:grid;gap:4px}.record strong{font-size:.82rem}.record small,.historic{color:#738087;font-size:.72rem}.historic{font-style:italic}.backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:16px;background:#17262480}.modal{width:min(520px,100%);display:grid;gap:13px;padding:20px;background:#fff}.modal header{display:flex;justify-content:space-between;align-items:center}.modal h2{margin:0;font-size:1.1rem}.close{border:0;background:none;font-size:1.4rem}.modal textarea{min-height:80px}.actions{display:flex;gap:8px;justify-content:flex-end;margin-top:4px}@media(max-width:780px){.detail-grid{grid-template-columns:1fr}.heading{align-items:flex-start;flex-direction:column}.toolbar{align-items:stretch;flex-direction:column}.toolbar input{min-width:0}.form-row{align-items:stretch;flex-wrap:wrap}.form-row select:first-child{flex-basis:100%}}
  `],
})
export class StructureManagementComponent implements OnInit {
  kind: StructureKind = 'ministries';
  structureId: string | null = null;
  churches: Church[] = [];
  selectedChurchId = '';
  churchSelectionFixed = false;
  structures: ChurchStructure[] = [];
  ministryEvents: ChurchEvent[] = [];
  ministryEventsAvailable = false;
  ministryPanelTab: 'DETAILS' | 'MEMBERS' | 'EVENTS' | 'ACTIVITIES' = 'DETAILS';
  selectedMinistry: ChurchStructure | null = null;
  selectedMinistryAssignments: StructureAssignment[] = [];
  selectedMinistryLeadership: StructureLeadership[] = [];
  selectedMinistryMembers: Member[] = [];
  selectedMinistryIds = new Set<string>();
  ministryPage = 0;
  readonly ministryPageSize = 10;
  showInactive = true;
  structure: ChurchStructure | null = null;
  members: Member[] = [];
  assignments: StructureAssignment[] = [];
  leadership: StructureLeadership[] = [];
  search = '';
  statusFilter: StructureStatus | 'ALL' = 'ALL';
  sectorFilter = 'ALL';
  leaderFilter = 'ALL';
  readonly availableSectors = ['Spiritualité', 'Éducation', 'Jeunesse', 'Mission', 'Service', 'Famille', 'Enfance', 'Communauté', 'Communication', 'Autre'];
  selectedMemberId = '';
  selectedLeaderId = '';
  selectedLeaderRole: LeadershipRole = 'LEADER';
  replaceTribeAssignment = false;
  formOpen = false;
  editing = false;
  loading = false;
  saving = false;
  errorMessage = '';
  successMessage = '';
  structureForm = this.fb.group({
    church_id: ['', Validators.required],
    name: ['', Validators.required],
    sector: [''],
    description: [''],
    status: ['ACTIVE' as StructureStatus, Validators.required],
  });

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private tenantService: TenantService,
    private memberService: MemberService,
    private structureService: MinistryTribeService,
      private eventService: EventService,
    ) {}

  ngOnInit(): void {
    this.route.data.subscribe((data) => {
      this.kind = data['structureKind'] as StructureKind;
      this.route.paramMap.subscribe((params) => {
        this.structureId = params.get('id');
        this.loadChurches();
      });
    });
  }

  get title(): string { return this.kind === 'ministries' ? 'Ministères' : 'Tribus'; }
  get singular(): string { return this.kind === 'ministries' ? 'ministère' : 'tribu'; }
  get filteredStructures(): ChurchStructure[] {
    const term = this.search.trim().toLocaleLowerCase();
    return this.structures.filter((item) =>
      (!term || item.name.toLocaleLowerCase().includes(term)
        || item.description.toLocaleLowerCase().includes(term)
        || (item.leader_name || '').toLocaleLowerCase().includes(term))
      && (this.statusFilter === 'ALL' || item.status === this.statusFilter)
      && (this.sectorFilter === 'ALL' || item.sector === this.sectorFilter)
      && (this.leaderFilter === 'ALL' || item.leader_name === this.leaderFilter),
    );
  }
  get ministrySectors(): string[] {
    return Array.from(new Set(this.structures.map((item) => item.sector).filter(Boolean))).sort((left, right) => left.localeCompare(right, 'fr'));
  }
  get ministryLeaders(): string[] {
    return Array.from(new Set(this.structures.map((item) => item.leader_name).filter((name): name is string => !!name))).sort((left, right) => left.localeCompare(right, 'fr'));
  }
  get pagedMinistries(): ChurchStructure[] {
    const start = this.ministryPage * this.ministryPageSize;
    return this.filteredStructures.slice(start, start + this.ministryPageSize);
  }
  get ministryPageCount(): number { return Math.max(1, Math.ceil(this.filteredStructures.length / this.ministryPageSize)); }
  get ministryRangeStart(): number { return this.filteredStructures.length ? this.ministryPage * this.ministryPageSize + 1 : 0; }
  get ministryRangeEnd(): number { return Math.min((this.ministryPage + 1) * this.ministryPageSize, this.filteredStructures.length); }
  get allVisibleSelected(): boolean {
    return this.pagedMinistries.length > 0 && this.pagedMinistries.every((item) => this.selectedMinistryIds.has(item.id));
  }
  get totalActiveAssignments(): number {
    return this.structures.reduce((count, item) => count + (item.active_members_count || 0), 0);
  }
  get totalActiveLeaders(): number {
    return this.structures.filter((item) => !!item.leader_name).length;
  }
  get activeMinistryAssignments(): StructureAssignment[] {
    return this.selectedMinistryAssignments.filter((assignment) => !assignment.left_at);
  }
  get selectedMinistryLeader(): StructureLeadership | undefined {
    return this.selectedMinistryLeadership.find((leader) => !leader.ended_at && leader.role === 'LEADER');
  }
  get selectedMinistryLeaderMember(): Member | undefined {
    const leaderId = this.selectedMinistryLeader?.member;
    return this.selectedMinistryMembers.find((member) => member.id === leaderId);
  }
  get eligibleMembers(): Member[] {
    return this.members.filter((member) => member.status === 'ACTIVE' && this.memberChurchId(member) === this.structure?.church);
  }

  selectChurch(event: Event): void {
    this.selectedChurchId = this.selectValue(event);
    this.search = '';
    this.statusFilter = 'ALL';
    this.sectorFilter = 'ALL';
    this.leaderFilter = 'ALL';
    this.ministryPage = 0;
    this.loadStructures();
  }

  selectMinistry(item: ChurchStructure): void {
    this.selectedMinistry = item;
    this.ministryPanelTab = 'DETAILS';
    this.selectedMinistryAssignments = [];
    this.selectedMinistryLeadership = [];
    this.selectedMinistryMembers = [];
    forkJoin({
      assignments: this.structureService.listAssignments('ministries', item.id),
      leadership: this.structureService.listLeadership('ministries', item.id),
      members: this.memberService.getMembers(),
    }).subscribe({
      next: ({ assignments, leadership, members }) => {
        if (this.selectedMinistry?.id !== item.id) return;
        this.selectedMinistryAssignments = assignments;
        this.selectedMinistryLeadership = leadership;
        this.selectedMinistryMembers = members;
      },
      error: (error) => this.errorMessage = this.errorText(error),
    });
  }

  toggleMinistrySelection(id: string, event: Event): void {
    const next = new Set(this.selectedMinistryIds);
    if ((event.target as HTMLInputElement).checked) next.add(id);
    else next.delete(id);
    this.selectedMinistryIds = next;
  }

  toggleVisibleSelection(event: Event): void {
    const next = new Set(this.selectedMinistryIds);
    const checked = (event.target as HTMLInputElement).checked;
    this.pagedMinistries.forEach((item) => checked ? next.add(item.id) : next.delete(item.id));
    this.selectedMinistryIds = next;
  }

  toggleInactive(): void {
    this.showInactive = !this.showInactive;
    this.statusFilter = this.showInactive ? 'ALL' : 'ACTIVE';
    this.ministryPage = 0;
  }

  refreshStructures(): void {
    this.loadStructures();
  }

  initials(name?: string | null): string {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part.charAt(0)).join('').toLocaleUpperCase() || '—';
  }

  ministryIcon(name: string): string {
    const normalized = name.toLocaleLowerCase();
    if (/louange|adoration|musique|chant/.test(normalized)) return '♫';
    if (/jeunesse|enfant|école/.test(normalized)) return '♟';
    if (/évangél|mission/.test(normalized)) return '⚑';
    if (/diacon|service|aide/.test(normalized)) return '♡';
    if (/famille/.test(normalized)) return '⌂';
    if (/communication|média/.test(normalized)) return '▣';
    return '✥';
  }

  memberRole(memberId: string): string {
    const role = this.selectedMinistryLeadership.find((leader) =>
      leader.member === memberId && !leader.ended_at,
    )?.role;
    return role === 'LEADER' ? 'Responsable' : role === 'ADJOINT' ? 'Adjoint(e)' : 'Membre';
  }

  openCreate(): void {
    this.editing = false;
    this.structureForm.reset({ church_id: this.selectedChurchId, name: '', sector: '', description: '', status: 'ACTIVE' });
    this.formOpen = true;
  }

  editStructure(item: ChurchStructure): void {
    this.editing = true;
    this.structureForm.reset({ church_id: item.church, name: item.name, sector: item.sector || '', description: item.description, status: item.status });
    this.formOpen = true;
  }

  saveStructure(): void {
    if (this.structureForm.invalid) { this.structureForm.markAllAsTouched(); return; }
    const raw = this.structureForm.getRawValue();
    const payload: StructureWriteRequest = {
      church_id: raw.church_id ?? '',
      name: raw.name ?? '',
      sector: raw.sector ?? '',
      description: raw.description ?? '',
      status: raw.status ?? 'ACTIVE',
    };
    const request = this.editing && this.structure
      ? this.structureService.update(this.kind, this.structure.id, { name: payload.name, sector: payload.sector, description: payload.description, status: payload.status })
      : this.structureService.create(this.kind, payload);
    this.saving = true;
    request.subscribe({
      next: (item) => {
        this.saving = false;
        this.formOpen = false;
        this.successMessage = `${this.singular} enregistré${this.kind === 'tribes' ? 'e' : ''}.`;
        if (this.structureId) this.loadDetail();
        else { this.selectedChurchId = item.church; this.loadStructures(); }
      },
      error: (error) => { this.saving = false; this.errorMessage = this.errorText(error); },
    });
  }

  changeStatus(status: StructureStatus): void {
    if (!this.structure) return;
    const text = status === 'ARCHIVED' ? 'archiver' : status === 'INACTIVE' ? 'désactiver' : 'réactiver';
    if (status !== 'ACTIVE' && !window.confirm(`Confirmer : ${text} ce(tte) ${this.singular} ? L’historique sera conservé.`)) return;
    this.structureService.update(this.kind, this.structure.id, { status }).subscribe({
      next: (item) => { this.structure = item; this.successMessage = `${this.singular} ${text === 'réactiver' ? 'réactivé(e)' : text + 'e'}.`; },
      error: (error) => this.errorMessage = this.errorText(error),
    });
  }

  assignMember(): void {
    if (!this.structure || !this.selectedMemberId) return;
    this.saving = true;
    this.structureService.assign(this.kind, this.structure.id, this.selectedMemberId, this.replaceTribeAssignment).subscribe({
      next: () => { this.saving = false; this.selectedMemberId = ''; this.replaceTribeAssignment = false; this.successMessage = 'Affectation enregistrée.'; this.loadDetail(); },
      error: (error) => { this.saving = false; this.errorMessage = this.errorText(error); },
    });
  }

  endAssignment(assignment: StructureAssignment): void {
    if (!window.confirm(`Clôturer l’affectation de ${assignment.member_name} ?`)) return;
    this.structureService.closeAssignment(this.kind, assignment.id, 'Fin d’affectation').subscribe({
      next: () => { this.successMessage = 'Affectation clôturée et conservée dans l’historique.'; this.loadDetail(); },
      error: (error) => this.errorMessage = this.errorText(error),
    });
  }

  appointLeader(): void {
    if (!this.structure || !this.selectedLeaderId) return;
    this.saving = true;
    this.structureService.appoint(this.kind, this.structure.id, this.selectedLeaderId, this.selectedLeaderRole).subscribe({
      next: () => { this.saving = false; this.selectedLeaderId = ''; this.successMessage = 'Responsabilité enregistrée.'; this.loadDetail(); },
      error: (error) => { this.saving = false; this.errorMessage = this.errorText(error); },
    });
  }

  endLeadership(leader: StructureLeadership): void {
    if (!window.confirm(`Retirer ${leader.member_name} de cette fonction ?`)) return;
    this.structureService.closeLeadership(this.kind, leader.id, 'Fin de fonction').subscribe({
      next: () => { this.successMessage = 'Fonction clôturée et conservée dans l’historique.'; this.loadDetail(); },
      error: (error) => this.errorMessage = this.errorText(error),
    });
  }

  statusText(status: StructureStatus): string {
    return ({ ACTIVE: 'Active', INACTIVE: 'Inactive', ARCHIVED: 'Archivée' } as Record<StructureStatus, string>)[status];
  }

  inputValue(event: Event): string { return (event.target as HTMLInputElement).value; }
  selectValue(event: Event): string { return (event.target as HTMLSelectElement).value; }
  checkboxValue(event: Event): boolean { return (event.target as HTMLInputElement).checked; }
  selectLeaderRole(event: Event): void {
    const value = this.selectValue(event);
    if (value === 'LEADER' || value === 'ADJOINT') this.selectedLeaderRole = value;
  }
  setStatusFilter(event: Event): void {
    const value = this.selectValue(event);
    if (value === 'ALL' || value === 'ACTIVE' || value === 'INACTIVE' || value === 'ARCHIVED') {
      this.statusFilter = value;
      this.ministryPage = 0;
    }
  }

  private loadChurches(): void {
    this.loading = true;
    this.tenantService.churchContext().subscribe({
      next: (context) => {
        this.churches = context.churches;
        this.churchSelectionFixed = context.church_selection_fixed;
        if (this.structureId) this.loadDetail();
        else {
          const storedChurchId = localStorage.getItem('churchos_preferred_church');
          const defaultChurchId = this.churchSelectionFixed ? context.default_church_id : null;
          this.selectedChurchId = defaultChurchId
            ?? this.churches.find((church) => church.church_id === storedChurchId)?.church_id
            ?? (this.churches.length === 1 ? this.churches[0].church_id : '');
          this.loadStructures();
        }
      },
      error: (error) => { this.errorMessage = this.errorText(error); this.loading = false; },
    });
  }

  private loadStructures(): void {
    if (!this.selectedChurchId) {
      this.structures = [];
      this.selectedMinistry = null;
      this.ministryEvents = [];
      this.ministryEventsAvailable = false;
      this.loading = false;
      return;
    }
    this.loading = true;
    this.structureService.list(this.kind, this.selectedChurchId).subscribe({
      next: (items) => {
        this.structures = items;
        this.loading = false;
        this.ministryPage = Math.min(this.ministryPage, Math.max(0, this.ministryPageCount - 1));
        if (this.kind === 'ministries') {
          const selected = items.find((item) => item.id === this.selectedMinistry?.id) || items[0] || null;
          this.selectedMinistry = selected;
          if (selected) this.selectMinistry(selected);
          else {
            this.selectedMinistryAssignments = [];
            this.selectedMinistryLeadership = [];
            this.selectedMinistryMembers = [];
          }
          this.loadMinistryEvents();
        }
      },
      error: (error) => { this.errorMessage = this.errorText(error); this.loading = false; },
    });
  }

  private loadMinistryEvents(): void {
    this.ministryEvents = [];
    this.ministryEventsAvailable = false;
    const now = new Date();
    const startsAfter = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const startsBefore = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
    this.eventService.managerAccess().subscribe({
      next: (access) => {
        if (!access.can_manage) return;
        this.eventService.list({ starts_after: startsAfter, starts_before: startsBefore }).subscribe({
          next: (events) => {
            this.ministryEvents = events.filter((event) =>
              event.church === this.selectedChurchId
              || event.included_churches.some((church) => church.church_id === this.selectedChurchId),
            );
            this.ministryEventsAvailable = true;
          },
          error: (error) => this.errorMessage = this.errorText(error),
        });
      },
      error: (error) => this.errorMessage = this.errorText(error),
    });
  }

  private loadDetail(): void {
    if (!this.structureId) return;
    this.loading = true;
    forkJoin({
      structure: this.structureService.get(this.kind, this.structureId),
      assignments: this.structureService.listAssignments(this.kind, this.structureId, true),
      leadership: this.structureService.listLeadership(this.kind, this.structureId, true),
      members: this.memberService.getMembers(),
    }).subscribe({
      next: ({ structure, assignments, leadership, members }) => {
        this.structure = structure;
        this.assignments = assignments;
        this.leadership = leadership;
        this.members = members;
        this.loading = false;
      },
      error: (error) => { this.errorMessage = this.errorText(error); this.loading = false; },
    });
  }

  private memberChurchId(member: Member): string | undefined {
    return typeof member.church === 'string' ? member.church : member.church?.church_id;
  }

  private errorText(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as Record<string, unknown> | string | null;
      if (typeof body === 'string') return body;
      if (body && typeof body === 'object') {
        if (typeof body['detail'] === 'string') return body['detail'];
        return Object.entries(body).map(([key, value]) => `${key} : ${Array.isArray(value) ? value.join(', ') : value}`).join(' · ');
      }
      return `Erreur API (${error.status}).`;
    }
    return 'Une erreur inattendue est survenue.';
  }
}
