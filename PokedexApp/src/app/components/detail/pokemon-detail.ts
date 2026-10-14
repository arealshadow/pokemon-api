import { Component, inject, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { PokemonService } from '../../services/pokemon.service';
import { PokemonDetail, PokemonSummary } from '../../models/pokemon.model';
import { TitleCasePipe } from '@angular/common';

const TYPE_COLORS: Record<string, string> = {
  normal: '#A8A77A', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C',
  grass: '#7AC74C', ice: '#96D9D6', fighting: '#C22E28', poison: '#A33EA1',
  ground: '#E2BF65', flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
  rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC', dark: '#705746',
  steel: '#B7B7CE', fairy: '#D683AD',
};

/** Detail page for a single Pokémon, reached at /pokemon/:id. */
@Component({
  selector: 'app-pokemon-detail',
  imports: [RouterLink, TitleCasePipe],
  templateUrl: './pokemon-detail.html',
})
export class PokemonDetailPage implements OnDestroy {
  protected service = inject(PokemonService);
  private route = inject(ActivatedRoute);

  /** Shiny variant of the sprite (front_shiny) is shown. */
  protected readonly shiny = signal(false);
  /** The Pokémon's cry is currently playing. */
  protected readonly crying = signal(false);
  private audio: HTMLAudioElement | null = null;
  /** Subscription to the :id route param (drives re-fetching on navigation). */
  private paramSub?: Subscription;

  constructor() {
    // Load the detail now AND whenever the :id route param changes. Navigating
    // between /pokemon/:id routes (prev/next, random, favourites, card-to-card)
    // reuses this component — the constructor only runs once — so the fresh
    // fetch must be driven by the param change, not by construction.
    this.paramSub = this.route.paramMap.subscribe(params => {
      const id = Number(params.get('id'));
      if (id) this.service.loadDetail(id);
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
    this.stopCry();
  }

  protected colorFor(type: string): string {
    return TYPE_COLORS[type] ?? '#757EC7';
  }

  /** Padded Pokédex number, e.g. "#009". */
  protected idLabel(d: PokemonDetail): string {
    return '#' + String(d.id).padStart(3, '0');
  }

  /**
   * Legible text colour for a type chip, chosen from the type's background
   * luminance — dark text on light types (electric/grass/…), white on dark.
   */
  protected textFor(type: string): string {
    const hex = TYPE_COLORS[type] ?? '#757EC7';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.62 ? '#17181f' : '#ffffff';
  }

  protected heightLabel(d: PokemonDetail): string {
    return (d.height / 10).toFixed(1) + ' m';
  }

  protected weightLabel(d: PokemonDetail): string {
    return (d.weight / 10).toFixed(1) + ' kg';
  }

  protected collected(id: number): boolean {
    return this.service.isCollected(id);
  }

  protected toggleShiny(): void {
    this.shiny.update(v => !v);
  }

  protected hasShiny(d: PokemonDetail): boolean {
    return !!d.sprites.front_shiny;
  }

  /** Which sprite to show — shiny variant when toggled on. */
  protected spriteFor(d: PokemonDetail): string {
    if (this.shiny() && d.sprites.front_shiny) return d.sprites.front_shiny;
    return (
      d.sprites.front_default ||
      `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${d.id}.png`
    );
  }

  // ---- Cry audio (latest, falling back to legacy) ----
  protected playCry(d: PokemonDetail): void {
    if (!d.cries) return;
    if (this.crying()) {
      this.stopCry();
      return;
    }
    const url = d.cries.latest || d.cries.legacy;
    if (!url) return;
    const audio = new Audio(url);
    this.audio = audio;
    audio
      .play()
      .then(() => this.crying.set(true))
      .catch(() => this.crying.set(false));
    audio.onended = () => this.crying.set(false);
    audio.onerror = () => this.crying.set(false);
  }

  private stopCry(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
    }
    this.crying.set(false);
  }

  private summaryFor(d: PokemonDetail): PokemonSummary {
    return {
      id: d.id,
      name: d.name,
      sprite: this.spriteFor(d),
      url: `https://pokeapi.co/api/v2/pokemon/${d.id}/`,
    };
  }

  protected toggle(d: PokemonDetail): void {
    this.service.toggle(this.summaryFor(d));
  }

  // ---- Favourite: pin this Pokémon to a quick-access slot (1-6) ----
  protected favSlotFor(d: PokemonDetail): number | null {
    return this.service.favSlotFor(d.id);
  }

  protected isAssigning(d: PokemonDetail): boolean {
    return this.service.assigning() === d.id;
  }

  protected toggleFav(d: PokemonDetail): void {
    this.service.toggleFav(d.id);
  }
}