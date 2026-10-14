import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PokemonService } from '../../services/pokemon.service';
import { PokemonSummary } from '../../models/pokemon.model';

/** A single Pokémon tile: sprite, name, id, and an add/remove toggle. */
@Component({
  selector: 'app-pokemon-card',
  imports: [RouterLink],
  template: `
    <div class="card" [class.focused]="focused()">
      <a class="card-media" [routerLink]="['/pokemon', pokemon().id]">
        <span class="card-sprite">
          <img [src]="pokemon().sprite" [alt]="pokemon().name" loading="lazy" />
        </span>
        <span class="card-name">{{ pokemon().name }}</span>
        <span class="card-id">#{{ pokemon().id }}</span>
      </a>
      <button
        class="card-btn"
        [class.added]="service.isCollected(pokemon().id)"
        [attr.aria-pressed]="service.isCollected(pokemon().id)"
        (click)="service.toggle(pokemon())"
      >
        {{ service.isCollected(pokemon().id) ? '✓ Added' : '+ Add' }}
      </button>
    </div>
  `,
})
export class PokemonCard {
  protected service = inject(PokemonService);
  public pokemon = input.required<PokemonSummary>();
  /** Driven by the D-pad focus on list screens. */
  public focused = input(false);
}