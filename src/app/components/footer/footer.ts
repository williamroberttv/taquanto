import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  host: {
    class: 'block',
  },
  templateUrl: './footer.html',
  styles: `
    .footer-link {
      color: var(--tq-ink);
      text-underline-offset: 0.25rem;
    }

    .footer-link:hover {
      text-decoration: underline;
    }
  `,
})
export class Footer {}
