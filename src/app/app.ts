import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Analytics } from './services/analytics';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  constructor() {
    inject(Analytics);
  }
}
