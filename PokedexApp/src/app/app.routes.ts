import { Routes } from '@angular/router';
import { Home } from './components/home/home';
import { Pokedex } from './components/pokedex/pokedex';
import { PokemonDetailPage } from './components/detail/pokemon-detail';

export const routes: Routes = [
  { path: '', component: Pokedex }, // HOME — the collection (always loads, even when empty)
  { path: 'pokedex', redirectTo: '' }, // legacy alias -> home
  { path: 'search', component: Home }, // SEARCH page
  { path: 'pokemon/:id', component: PokemonDetailPage },
  { path: '**', redirectTo: '' },
];