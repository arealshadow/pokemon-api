import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { PokemonDetail, PokemonSummary } from '../models/pokemon.model';

const API = 'https://pokeapi.co/api/v2';
const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
const STORAGE_KEY = 'pokedex.collection.v1';
const FAV_KEY = 'pokedex.favourites.v1';

/**
 * Single source of truth for Pokémon search, detail and the user's
 * collected Pokédex. State is exposed as signals so the UI is reactive
 * (and works in zoneless mode). The collection is persisted to localStorage.
 */
@Injectable({ providedIn: 'root' })
export class PokemonService {
  private http = inject(HttpClient);

  // ---- Search ----
  private all = signal<PokemonSummary[]>([]);
  readonly loadingNames = signal(false);
  readonly searchQuery = signal('');
  /** Filtered results — the first 48 when there is no query. */
  readonly results = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const all = this.all();
    if (!q) return all.slice(0, 48);
    return all.filter(p => p.name.includes(q)).slice(0, 48);
  });

  /** Full loaded name list (exposed for the device's status screen). */
  readonly allNames = this.all;

  // ---- Detail ----
  readonly detail = signal<PokemonDetail | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal('');

  // ---- Collection (My Pokédex) ----
  readonly pokedex = signal<PokemonSummary[]>(this.readStorage());

  /** Index of the D-pad focused card on list screens (search / home). */
  readonly focus = signal(0);

  /** Quick-access favourite slots 1-6 (slot -> Pokémon). */
  readonly favSlots = signal<Record<number, PokemonSummary>>(this.readFavs());

  /**
   * Id of the Pokémon currently in "pick a slot" mode (drives the keypad
   * 1-6 pulse). Null when no Pokémon is waiting to be pinned.
   */
  readonly assigning = signal<number | null>(null);

  constructor() {
    this.loadAll();
  }

  /** Fetch the full name list once, then search happens client-side. */
  private loadAll(): void {
    this.loadingNames.set(true);
    this.http
      .get<{ count: number }>(`${API}/pokemon?limit=1`)
      .subscribe({
        next: ({ count }) => {
          this.http
            .get<{ results: { name: string; url: string }[] }>(`${API}/pokemon?limit=${count}`)
            .subscribe({
              next: res => this.all.set(res.results.map(r => this.toSummary(r.name, r.url))),
              error: () => this.all.set([]),
              complete: () => this.loadingNames.set(false),
            });
        },
        error: () => this.loadingNames.set(false),
      });
  }

  private toSummary(name: string, url: string): PokemonSummary {
    const id = Number(url.match(/pokemon\/(\d+)/)?.[1] ?? 0);
    return { id, name, sprite: `${SPRITES}/${id}.png`, url };
  }

  /** In-flight detail request (cancelled when a new load starts). */
  private detailReq?: Subscription;

  /** Load a Pokémon's full detail by id. */
  loadDetail(id: number): void {
    this.detailReq?.unsubscribe();
    this.detailLoading.set(true);
    this.detailError.set('');
    this.detail.set(null);
    this.detailReq = this.http.get<PokemonDetail>(`${API}/pokemon/${id}`).subscribe({
      next: d => {
        this.detail.set(d);
        this.detailLoading.set(false);
      },
      error: err => {
        this.detailLoading.set(false);
        this.detailError.set(err?.error?.message || 'Something went wrong loading this Pokémon.');
      },
    });
  }

  // ---- Collection (Pokédex) ----
  isCollected(id: number): boolean {
    return this.pokedex().some(p => p.id === id);
  }

  addToPokedex(pokemon: PokemonSummary): void {
    if (!this.isCollected(pokemon.id)) {
      this.pokedex.update(list => [pokemon, ...list]);
      this.saveStorage();
    }
  }

  removeFromPokedex(id: number): void {
    this.pokedex.update(list => list.filter(p => p.id !== id));
    this.saveStorage();
  }

  toggle(pokemon: PokemonSummary): void {
    if (this.isCollected(pokemon.id)) this.removeFromPokedex(pokemon.id);
    else this.addToPokedex(pokemon);
  }

  clearPokedex(): void {
    this.pokedex.set([]);
    this.saveStorage();
  }

  // ---- Favourite quick-access slots (1-6) ----
  favAt(slot: number): PokemonSummary | null {
    return this.favSlots()[slot] ?? null;
  }

  setFavSlot(slot: number, pokemon: PokemonSummary): void {
    this.favSlots.update(m => ({ ...m, [slot]: pokemon }));
    this.saveFavs();
  }

  clearFavSlot(slot: number): void {
    this.favSlots.update(m => {
      const copy = { ...m };
      delete copy[slot];
      return copy;
    });
    this.saveFavs();
  }

  /** Slot (1-6) holding a given Pokémon, or null if it isn't pinned. */
  favSlotFor(id: number): number | null {
    const m = this.favSlots();
    for (let s = 1; s <= 6; s++) if (m[s]?.id === id) return s;
    return null;
  }

  /** Enter "pick a slot" mode for a Pokémon (the keypad 1-6 starts pulsing). */
  beginAssign(id: number): void {
    if (this.favSlotFor(id) == null) this.assigning.set(id);
  }

  /** Leave "pick a slot" mode. */
  cancelAssign(): void {
    this.assigning.set(null);
  }

  /**
   * Three-state favourite toggle for a Pokémon:
   *  - not pinned -> enter "pick a slot" mode
   *  - picking    -> cancel picking
   *  - pinned     -> remove it from its slot
   */
  toggleFav(id: number): void {
    if (this.favSlotFor(id) != null) this.unassign(id);
    else if (this.assigning() === id) this.cancelAssign();
    else this.beginAssign(id);
  }

  /**
   * Pin the current detail Pokémon to a slot. A Pokémon only ever occupies a
   * single slot, so it is moved out of any other slot first.
   */
  assignToSlot(slot: number): void {
    const d = this.detail();
    if (!d) return;
    const summary: PokemonSummary = {
      id: d.id,
      name: d.name,
      sprite:
        d.sprites.front_default ||
        `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${d.id}.png`,
      url: `https://pokeapi.co/api/v2/pokemon/${d.id}/`,
    };
    const m = { ...this.favSlots() };
    for (let s = 1; s <= 6; s++) if (m[s]?.id === d.id) delete m[s];
    m[slot] = summary;
    this.favSlots.set(m);
    this.cancelAssign();
    this.saveFavs();
  }

  /** Remove a Pokémon from every slot. */
  unassign(id: number): void {
    const m = { ...this.favSlots() };
    for (let s = 1; s <= 6; s++) if (m[s]?.id === id) delete m[s];
    this.favSlots.set(m);
    this.cancelAssign();
    this.saveFavs();
  }

  private readFavs(): Record<number, PokemonSummary> {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      return raw ? (JSON.parse(raw) as Record<number, PokemonSummary>) : {};
    } catch {
      return {};
    }
  }

  private saveFavs(): void {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(this.favSlots()));
    } catch {
      /* storage unavailable — ignore */
    }
  }

  private readStorage(): PokemonSummary[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as PokemonSummary[]) : [];
    } catch {
      return [];
    }
  }

  private saveStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.pokedex()));
    } catch {
      /* storage unavailable — ignore */
    }
  }
}