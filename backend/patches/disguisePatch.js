export function applyDisguisePatch(Dex) {
  if (!Dex.data.Abilities || !Dex.data.Abilities.disguise) return;

  const originalDisguise = Dex.data.Abilities.disguise;

  Dex.data.Abilities.disguise = {
    ...originalDisguise,
    onDamage(damage, target, source, effect) {
      if (effect?.effectType === "Move" && ["mimikyu", "mimikyutotem", "mimikyumane"].includes(target.species.id) && !target.transformed) {
        this.add("-activate", target, "ability: Disguise");
        this.effectState.busted = true;
        return 0;
      }
    },
    onCriticalHit(target, source, move) {
      if (!target || !["mimikyu", "mimikyutotem", "mimikyumane"].includes(target.species.id)) {
        return;
      }
      const hitSub = target.volatiles["substitute"] && !move.flags["bypasssub"] && !(move.infiltrates && this.gen >= 6);
      if (hitSub) return;

      if (!target.runImmunity(move.type)) return;
      return false;
    },
    onEffectiveness(typeMod, target, type, move) {
      if (!target || move.category === "Status" || !["mimikyu", "mimikyutotem", "mimikyumane"].includes(target.species.id)) {
        return;
      }

      const hitSub = target.volatiles["substitute"] && !move.flags["bypasssub"] && !(move.infiltrates && this.gen >= 6);
      if (hitSub) return;

      if (!target.runImmunity(move.type)) return;
      return 0;
    },
    onUpdate(pokemon) {
      if (["mimikyu", "mimikyutotem", "mimikyumane"].includes(pokemon.species.id) && this.effectState.busted) {
        let speciesid = "Mimikyu-Busted";
        if (pokemon.species.id === "mimikyutotem") speciesid = "Mimikyu-Busted-Totem";
        
        if (pokemon.species.id === "mimikyumane") speciesid = "mimikyumanebusted";

        this.effectState.busted = false;
        pokemon.formeChange(speciesid, this.effect, true);
        // this.damage(pokemon.baseMaxhp / 8, pokemon, pokemon, this.dex.species.get(speciesid));
      }
    },
  };
}