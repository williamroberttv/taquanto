import { Component } from '@angular/core';

@Component({
  selector: 'app-header',
  host: {
    class: 'block',
  },
  templateUrl: './header.html',
})
export class Header {
  protected readonly navigation = ['Sobre', 'Pesquisar', 'Contato'];
}
