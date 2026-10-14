/** Lightweight Pokémon entry used for search results and the collection. */
export interface PokemonSummary {
  id: number;
  name: string;
  sprite: string;
  url: string;
}

export interface PokemonType {
  slot: number;
  type: { name: string; url: string };
}

export interface PokemonAbility {
  ability: { name: string; url: string };
  is_hidden: boolean;
  slot: number;
}

export interface PokemonStat {
  base_stat: number;
  stat: { name: string; url: string };
}

export interface PokemonSprites {
  front_default: string | null;
  back_default: string | null;
  front_shiny: string | null;
}

export interface PokemonCries {
  latest: string;
  legacy: string;
}

/** Full detail returned by GET /pokemon/{id}. */
export interface PokemonDetail {
  id: number;
  name: string;
  height: number; // decimetres
  weight: number; // hectograms
  base_experience: number;
  types: PokemonType[];
  abilities: PokemonAbility[];
  stats: PokemonStat[];
  sprites: PokemonSprites;
  cries: PokemonCries;
}