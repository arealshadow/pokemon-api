import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PokemonCard } from '../pokemon-card/pokemon-card';
import { PokemonService } from '../../services/pokemon.service';

@Component({
  selector: 'app-pokedex',
  imports: [RouterLink, PokemonCard],
  templateUrl: './pokedex.html',
})
export class Pokedex {
  protected service = inject(PokemonService);
}