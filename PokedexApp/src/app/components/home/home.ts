import { Component, inject } from '@angular/core';
import { PokemonCard } from '../pokemon-card/pokemon-card';
import { PokemonService } from '../../services/pokemon.service';

@Component({
  selector: 'app-home',
  imports: [PokemonCard],
  templateUrl: './home.html',
})
export class Home {
  protected service = inject(PokemonService);
}