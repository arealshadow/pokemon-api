import { Component, inject, OnDestroy, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { PokemonService } from './services/pokemon.service';
import { PokemonDetail, PokemonSummary } from './models/pokemon.model';

const MAX_ID = 1351;

/**
 * Abilities that became iconic in the Pokémon anime — curated from the show's
 * most-remembered moments. `name` is the PokéAPI ability id (lower-case);
 * `why` is the anime connection shown on the DATA screen.
 */
const ANIME_ICONIC: { name: string; why: string }[] = [
  { name: 'static', why: 'Pikachu — the classic spark that jolts a first hit.' },
  { name: 'serene-grace', why: 'Swablu / Altaria — doubles the critical-hit rate.' },
  { name: 'sturdy', why: 'Tangela — survives a would-be knockout blow.' },
  { name: 'disguise', why: 'Mimikyu — its disguise shrugs off the first hit.' },
  { name: 'illusion', why: 'Zorua — disguises itself as rival Pokémon.' },
  { name: 'intimidate', why: 'The intimidating glare that weakens Attack.' },
  { name: 'mold-breaker', why: 'Garchomp — bypasses an opponent’s ability.' },
  { name: 'air-lock', why: 'Rayquaza — nullifies every weather effect.' },
  { name: 'levitate', why: 'Gengar & floating Ghost-types that hover.' },
  { name: 'pressure', why: 'Mewtwo — every move costs extra PP.' },
];


/**
 * App shell styled as a physical Pokédex: left half is the screen (routed
 * content) plus a functional D-pad and A/B controls, right half is the
 * control deck (keypad, status + stats screens).
 *
 * Controls:
 *  - Lens (blue, top-left) + HOME key -> the Pokédex collection (home).
 *  - SEARCH key -> the search page.
 *  - D-pad: Up/Down/Left/Right navigate the card grid (2D), or scroll &
 *    prev/next on a Pokémon.  A = select/forward, B = back.
 *  - 1-6 keys -> favourite quick-access slots.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
})
export class App implements OnDestroy {
  protected service = inject(PokemonService);
  private router = inject(Router);

  /** Upper bound of the national Pokédex (Gen 1-9). */
  protected readonly maxId = MAX_ID;
  /** Favourite quick-access slots on the keypad. */
  protected readonly jumpKeys = [1, 2, 3, 4, 5, 6];

  /** ID of the last Pokémon viewed — drives PREV/NEXT. */
  protected currentId = signal<number | null>(null);
  /** Normalized current route (after redirects). */
  private route = signal('');

  private unsubNav?: Subscription;

  constructor() {
    this.unsubNav = this.router.events.subscribe(e => {
      if (e instanceof NavigationEnd) {
        this.route.set(e.urlAfterRedirects);
        const m = e.urlAfterRedirects.match(/\/pokemon\/(\d+)/);
        if (m) this.currentId.set(Number(m[1]));
        this.service.focus.set(0);
        this.service.cancelAssign();
        this.scrollScreenTo(0);
      }
    });
    window.addEventListener('keydown', this.onKey);
  }

  ngOnDestroy(): void {
    this.unsubNav?.unsubscribe();
    window.removeEventListener('keydown', this.onKey);
  }

  // ---- Routing helpers ----
  protected goHome(): void {
    this.router.navigate(['/']);
  }

  protected goSearch(): void {
    this.router.navigate(['/search']);
  }

  protected clearAll(): void {
    this.service.clearPokedex();
  }

  protected random(): void {
    this.router.navigate(['/pokemon', Math.floor(Math.random() * MAX_ID) + 1]);
  }

  // ---- Prev / Next (relative to the current Pokémon) ----
  private current(): number {
    return this.currentId() ?? this.service.results()[0]?.id ?? 1;
  }

  protected next(): void {
    this.router.navigate(['/pokemon', Math.min(MAX_ID, this.current() + 1)]);
  }

  protected prev(): void {
    this.router.navigate(['/pokemon', Math.max(1, this.current() - 1)]);
  }

  // ---- Active card list for the current route ----
  private onListRoute(): boolean {
    const r = this.route();
    return r === '/' || r === '/search';
  }

  private list(): PokemonSummary[] {
    const r = this.route();
    if (r.startsWith('/pokemon/')) return [];
    if (r === '/search') return this.service.results();
    return this.service.pokedex();
  }

  // ---- D-pad ----
  protected dpad(dir: 'up' | 'down' | 'left' | 'right'): void {
    if (this.route().startsWith('/pokemon/')) {
      if (dir === 'up') this.scrollScreen(-1);
      else if (dir === 'down') this.scrollScreen(1);
      else if (dir === 'left') this.prev();
      else if (dir === 'right') this.next();
      return;
    }
    if (!this.onListRoute()) return;

    const list = this.list();
    if (!list.length) return;
    const cols = this.gridColumns();
    let i = this.service.focus();
    if (dir === 'up') i -= cols;
    else if (dir === 'down') i += cols;
    else if (dir === 'left') i -= 1;
    else if (dir === 'right') i += 1;
    i = Math.max(0, Math.min(list.length - 1, i));
    this.service.focus.set(i);
    this.focusScrollIntoView();
  }

  private gridColumns(): number {
    const grid = document.querySelector('.grid');
    if (!grid) return 1;
    const tracks = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
    return tracks || 1;
  }

  private focusScrollIntoView(): void {
    requestAnimationFrame(() => {
      document
        .querySelector('.card.focused')
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    });
  }

  // ---- A (select / forward) and B (back) ----
  protected aAction(): void {
    if (this.route().startsWith('/pokemon/')) {
      this.addCurrent();
      return;
    }
    const p = this.list()[this.service.focus()];
    if (p) this.router.navigate(['/pokemon', p.id]);
  }

  protected bAction(): void {
    if (this.route() !== '/' && window.history.length > 1) window.history.back();
    else this.router.navigate(['/']);
  }

  // ---- Favourite quick-access slots (1-6) ----
  /** True while the keypad is pulsing to pick a favourite slot. */
  protected isAssigning(): boolean {
    return this.service.assigning() != null;
  }

  protected loadSlot(slot: number): void {
    // A filled slot is always a quick jump to its saved Pokémon.
    const f = this.service.favAt(slot);
    if (f) {
      this.service.cancelAssign();
      this.router.navigate(['/pokemon', f.id]);
      return;
    }
    // Empty slot: only act while explicitly choosing a slot to pin a Pokémon.
    if (this.isAssigning()) this.service.assignToSlot(slot);
  }

  protected addCurrent(): void {
    const d = this.service.detail();
    if (!d) return;
    this.service.toggle({
      id: d.id,
      name: d.name,
      sprite: d.sprites.front_default || '',
      url: `https://pokeapi.co/api/v2/pokemon/${d.id}/`,
    });
  }

  protected status(): string {
    if (this.service.loadingNames() || this.service.detailLoading()) return 'LOADING…';
    if (this.service.detailError()) return 'ERROR';
    return 'READY';
  }

  protected mode(): string {
    const r = this.route();
    if (r.startsWith('/pokemon/')) return 'POKÉMON';
    if (r === '/search') return 'SEARCH';
    if (r === '/') return 'HOME';
    return 'IDLE';
  }

  protected currentName(): string {
    const id = this.currentId();
    if (!id) return '—';
    const p =
      this.service.detail()?.id === id
        ? this.service.detail()!.name
        : this.service.allNames().find(n => n.id === id)?.name;
    return (p ?? '—').toUpperCase();
  }

  // ---- Stats screen (bottom-right) ----
  protected currentDetail(): PokemonDetail | null {
    return this.route().startsWith('/pokemon/') ? this.service.detail() : null;
  }

  /** Percentage width for a stat bar (stats max out at 255). */
  protected barWidth(base: number): number {
    return (Math.min(base, 255) * 100) / 255;
  }

  protected baseStatTotal(): number {
    return this.currentDetail()?.stats.reduce((sum, s) => sum + s.base_stat, 0) ?? 0;
  }

  protected heightLabel(): string {
    const d = this.currentDetail();
    return d ? `${(d.height / 10).toFixed(1)} m` : '—';
  }

  protected weightLabel(): string {
    const d = this.currentDetail();
    return d ? `${(d.weight / 10).toFixed(1)} kg` : '—';
  }

  // ---- Anime-iconic abilities (right DATA screen) ----
  /** The anime-iconic abilities the given Pokémon actually has (usually 0-2). */
  protected animeMatches(d: PokemonDetail): { name: string; why: string }[] {
    return ANIME_ICONIC.filter(a => d.abilities.some(ab => ab.ability.name === a.name));
  }

  protected isAnimeIconic(name: string): boolean {
    return ANIME_ICONIC.some(a => a.name === name.toLowerCase());
  }

  /** Short anime blurb for an ability, or empty if it isn't an iconic one. */
  protected animeNote(name: string): string {
    return ANIME_ICONIC.find(a => a.name === name.toLowerCase())?.why ?? '';
  }

  // ---- Screen scrolling ----
  private screenEl(): HTMLElement | null {
    return document.querySelector('.screen');
  }

  protected scrollScreen(dir: number): void {
    this.screenEl()?.scrollBy({ top: dir * 240, behavior: 'smooth' });
  }

  private scrollScreenTo(top: number): void {
    this.screenEl()?.scrollTo({ top });
  }

  // ---- Keyboard support (arrows + A/B), ignored while typing ----
  private onKey = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        this.dpad('up');
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.dpad('down');
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this.dpad('left');
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.dpad('right');
        break;
      case 'a':
      case 'A':
        this.aAction();
        break;
      case 'b':
      case 'B':
      case 'Backspace':
        this.bAction();
        break;
    }
  };
}