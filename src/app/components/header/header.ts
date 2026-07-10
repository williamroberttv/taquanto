import { Component } from '@angular/core';

interface NavigationItem {
  label: string;
  href: string;
}

@Component({
  selector: 'app-header',
  host: {
    class: 'block',
  },
  templateUrl: './header.html',
})
export class Header {
  protected readonly navigation: NavigationItem[] = [
    { label: 'Como funciona', href: '#como-funciona' },
    { label: 'Vantagens', href: '#dados' },
    { label: 'Buscar', href: '#pesquisa' },
  ];
}
