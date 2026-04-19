export interface RoomSettings {
  format: number;
  allowMega: boolean;
  allowZMove: boolean;
  noLimit: boolean;
}
export interface RoomData {
  id: string;
  host: string;
  settings: RoomSettings;
  status: "room" | "selection" | "battle";
  players: { id: string; ready: boolean; hasTeam: boolean }[];
}
export interface AvailableRoom {
  id: string;
  settings: RoomSettings;
  playersCount: number;
}

export interface PokemonStats {
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}
export interface PokemonStatus {
  ident: string;
  details: string;
  condition: string;
  active: boolean;
  stats?: PokemonStats;
  boosts?: Record<string, number>;
  item?: string;
  baseAbility?: string;
}
export interface OppPokemon {
  ident: string;
  name: string;
  details: string;
  condition: string;
  boosts?: Record<string, number>;
  revealed: boolean;
  fainted: boolean;
}
export interface MoveData {
  move: string;
  id: string;
  disabled?: boolean;
}
