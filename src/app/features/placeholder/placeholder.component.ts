import { Component } from '@angular/core';

@Component({
  selector: 'app-placeholder',
  standalone: true,
  template: `
    <section class="placeholder-page">
      <div class="placeholder-card">
        <h1>{{ title }}</h1>
        <p>Cette page est temporairement en préparation pour ce module ChurchOS.</p>
      </div>
    </section>
  `,
  styles: [
    `
      :host { display: block; }
      .placeholder-page { display: grid; place-items: center; min-height: 420px; }
      .placeholder-card {
        width: min(520px, 100%);
        background: #fff; border: 1px solid var(--border); border-radius: 18px; padding: 32px; box-shadow: 0 12px 28px rgba(15,23,42,0.06);
      }
      h1 { margin: 0 0 12px; font-size: 2rem; color: var(--text-primary); }
      p { margin: 0; font-size: 1rem; color: var(--text-secondary); }
    `,
  ],
})
export class PlaceholderComponent {
  title = 'Module ChurchOS';
}
