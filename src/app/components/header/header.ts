import { Component, computed, inject } from '@angular/core';
import { ThemeService } from '../../services/theme';

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
  private readonly theme = inject(ThemeService);

  protected readonly isDark = this.theme.isDark;
  protected readonly themeToggleLabel = computed(() =>
    this.isDark() ? 'Ativar modo claro' : 'Ativar modo escuro',
  );
  protected readonly navigation: NavigationItem[] = [
    { label: 'Como funciona', href: '/#como-funciona' },
    { label: 'Vantagens', href: '/#dados' },
    { label: 'Buscar', href: '/buscar' },
    { label: 'Favoritos', href: '/favoritos' },
  ];

  protected toggleTheme(): void {
    this.theme.toggle();
  }
}
