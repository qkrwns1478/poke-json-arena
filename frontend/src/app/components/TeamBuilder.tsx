"use client";

import { useState, useMemo, useCallback, Fragment } from "react";
import Link from "next/link";
import { Generations } from "@smogon/calc";
import { ArrowLeft, Download, Plus, Trash2, Edit2, X } from "lucide-react";
import * as DICT from "@/data/dict";
import { TYPE_ENG_TO_KOR, TypeBadge } from "@/app/utils/Types";

// ─── Nature modifiers ──────────────────────────────────────────────────────────

type StatKey = "HP" | "ATK" | "DEF" | "SpA" | "SpD" | "SPE";

// Indexed in same order as NATURE_KOR / NATURE_ENG arrays
const NATURE_MODIFIERS: [StatKey | null, StatKey | null][] = [
  [null, null],   // Hardy   노력
  ["ATK", "DEF"], // Lonely  외로움
  ["ATK", "SPE"], // Brave   용감
  ["ATK", "SpA"], // Adamant 고집
  ["ATK", "SpD"], // Naughty 개구쟁이
  ["DEF", "ATK"], // Bold    대담
  [null, null],   // Docile  온순
  ["DEF", "SPE"], // Relaxed 무사태평
  ["DEF", "SpA"], // Impish  장난꾸러기
  ["DEF", "SpD"], // Lax     촐랑
  ["SPE", "ATK"], // Timid   겁쟁이
  ["SPE", "DEF"], // Hasty   성급
  [null, null],   // Serious 성실
  ["SPE", "SpA"], // Jolly   명랑
  ["SPE", "SpD"], // Naive   천진난만
  ["SpA", "ATK"], // Modest  조심
  ["SpA", "DEF"], // Mild    의젓
  ["SpA", "SPE"], // Quiet   냉정
  [null, null],   // Bashful 수줍음
  ["SpA", "SpD"], // Rash    덜렁
  ["SpD", "ATK"], // Calm    차분
  ["SpD", "DEF"], // Gentle  얌전
  ["SpD", "SPE"], // Sassy   건방
  ["SpD", "SpA"], // Careful 신중
  [null, null],   // Quirky  변덕
];

function getNatureMod(natureKor: string, stat: StatKey): number {
  const idx = DICT.NATURE_KOR.indexOf(natureKor);
  if (idx < 0) return 1;
  const [boost, drop] = NATURE_MODIFIERS[idx];
  if (stat === boost) return 1.1;
  if (stat === drop) return 0.9;
  return 1;
}

function getNatureBoostDrop(natureKor: string): [StatKey | null, StatKey | null] {
  const idx = DICT.NATURE_KOR.indexOf(natureKor);
  if (idx < 0) return [null, null];
  return NATURE_MODIFIERS[idx];
}

// ─── Stat calculation ──────────────────────────────────────────────────────────

export interface Stats {
  HP: number;
  ATK: number;
  DEF: number;
  SpA: number;
  SpD: number;
  SPE: number;
}

const STAT_KEYS: StatKey[] = ["HP", "ATK", "DEF", "SpA", "SpD", "SPE"];
const EMPTY_STATS: Stats = { HP: 0, ATK: 0, DEF: 0, SpA: 0, SpD: 0, SPE: 0 };
const DEFAULT_IVS: Stats = { HP: 31, ATK: 31, DEF: 31, SpA: 31, SpD: 31, SPE: 31 };

const calcHP = (base: number, iv: number, ev: number, level: number): number =>
  Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100 + level + 10);

const calcOther = (base: number, iv: number, ev: number, level: number, mod: number): number =>
  Math.floor(Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100 + 5) * mod);

function calcFinalStats(base: Stats, ivs: Stats, evs: Stats, nature: string, level: number): Stats {
  return {
    HP: calcHP(base.HP, ivs.HP, evs.HP, level),
    ATK: calcOther(base.ATK, ivs.ATK, evs.ATK, level, getNatureMod(nature, "ATK")),
    DEF: calcOther(base.DEF, ivs.DEF, evs.DEF, level, getNatureMod(nature, "DEF")),
    SpA: calcOther(base.SpA, ivs.SpA, evs.SpA, level, getNatureMod(nature, "SpA")),
    SpD: calcOther(base.SpD, ivs.SpD, evs.SpD, level, getNatureMod(nature, "SpD")),
    SPE: calcOther(base.SPE, ivs.SPE, evs.SPE, level, getNatureMod(nature, "SPE")),
  };
}

// ─── @smogon/calc helpers ──────────────────────────────────────────────────────

function smogonToStats(b: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }): Stats {
  return { HP: b.hp, ATK: b.atk, DEF: b.def, SpA: b.spa, SpD: b.spd, SPE: b.spe };
}

function getSpeciesData(engName: string, genNum: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 = 9) {
  try {
    const gen = Generations.get(genNum);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return gen.species.get(engName.toLowerCase() as any) ?? null;
  } catch {
    return null;
  }
}

function detectMegaForms(engName: string): string[] {
  const forms: string[] = [];
  if (getSpeciesData(engName + "-Mega", 7)) forms.push(engName + "-Mega");
  if (getSpeciesData(engName + "-Mega-X", 7)) forms.push(engName + "-Mega-X");
  if (getSpeciesData(engName + "-Mega-Y", 7)) forms.push(engName + "-Mega-Y");
  return forms;
}

function speciesAbilitiesKor(engName: string): string[] {
  const species = getSpeciesData(engName);
  if (!species) return [];
  const abilities = Object.values(species.abilities as Record<string, string>)
    .filter(Boolean)
    .map((a: string) => {
      const normalized = a.toLowerCase().replace(/[\s-]/g, "");
      const idx = DICT.ABILITY_ENG.indexOf(normalized);
      return idx >= 0 ? DICT.ABILITY_KOR[idx] : a;
    });
  return [...new Set(abilities)];
}

// ─── Pokemon entry type ────────────────────────────────────────────────────────

export interface PokemonEntry {
  species_eng: string;
  species_kor: string;
  types: string[];
  gender: string;
  nature: string;
  ability: string;
  item: string;
  moves: string[];
  level: number;
  base_stats: Stats;
  final_stats: Stats;
  IVs: Stats;
  EVs: Stats;
  mega_types?: string[];
  mega_ability?: string;
  mega_base_stats?: Stats;
  mega_final_stats?: Stats;
}

// ─── Combobox component ────────────────────────────────────────────────────────

function Combobox({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!value) return [];
    const q = value.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q)).slice(0, 8);
  }, [options, value]);

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full bg-slate-900/60 text-slate-100 placeholder-slate-500 px-3 py-2 rounded-xl border border-slate-700/50 focus:outline-none focus:border-blue-500/60 text-sm"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
          {filtered.map((o) => (
            <li
              key={o}
              onMouseDown={() => {
                onChange(o);
                setOpen(false);
              }}
              className="px-3 py-2 text-sm text-slate-200 hover:bg-slate-700/60 cursor-pointer"
            >
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Species search combobox ───────────────────────────────────────────────────

function SpeciesCombobox({ value, onSelect }: { value: string; onSelect: (kor: string, eng: string) => void }) {
  const [input, setInput] = useState(value);
  const [open, setOpen] = useState(false);
  const [prevValue, setPrevValue] = useState(value);

  if (prevValue !== value) {
    setPrevValue(value);
    setInput(value);
  }

  const suggestions = useMemo(() => {
    if (!input) return [];
    const q = input.toLowerCase();
    const results: { kor: string; eng: string }[] = [];
    for (let i = 0; i < DICT.POKEMON_KOR.length; i++) {
      if (DICT.POKEMON_KOR[i].includes(input) || DICT.POKEMON_ENG[i].toLowerCase().includes(q)) {
        results.push({ kor: DICT.POKEMON_KOR[i], eng: DICT.POKEMON_ENG[i] });
      }
      if (results.length >= 8) break;
    }
    return results;
  }, [input]);

  return (
    <div className="relative">
      <input
        type="text"
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="포켓몬 이름으로 검색 (한/영)"
        className="w-full bg-slate-900/60 text-slate-100 placeholder-slate-500 px-3 py-2 rounded-xl border border-slate-700/50 focus:outline-none focus:border-blue-500/60 text-sm"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
          {suggestions.map((s) => (
            <li
              key={s.eng}
              onMouseDown={() => {
                onSelect(s.kor, s.eng);
                setOpen(false);
              }}
              className="px-3 py-2 text-sm text-slate-200 hover:bg-slate-700/60 cursor-pointer flex justify-between items-center"
            >
              <span>{s.kor}</span>
              <span className="text-slate-500 text-xs ml-2">{s.eng}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── EV input ──────────────────────────────────────────────────────────────────

function EVInput({
  label,
  value,
  onChange,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max: number;
}) {
  return (
    <div className="flex flex-col gap-1 items-center">
      <span className="text-[10px] text-slate-400 font-semibold tracking-wider">{label}</span>
      <input
        type="number"
        min={0}
        max={Math.min(252, max + value)}
        value={value}
        onChange={(e) => {
          const v = Math.max(0, Math.min(252, Number(e.target.value) || 0));
          onChange(v);
        }}
        className="w-full bg-slate-900/60 text-slate-100 text-center px-1 py-1.5 rounded-lg border border-slate-700/50 focus:outline-none focus:border-blue-500/60 text-xs"
      />
    </div>
  );
}

// ─── IV input ──────────────────────────────────────────────────────────────────

function IVInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1 items-center">
      <span className="text-[10px] text-slate-400 font-semibold tracking-wider">{label}</span>
      <input
        type="number"
        min={0}
        max={31}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(31, Number(e.target.value) || 0)))}
        className="w-full bg-slate-900/60 text-slate-100 text-center px-1 py-1.5 rounded-lg border border-slate-700/50 focus:outline-none focus:border-blue-500/60 text-xs"
      />
    </div>
  );
}

// ─── Stats table ───────────────────────────────────────────────────────────────

function StatsTable({
  base,
  final: finalStats,
  nature,
  label,
}: {
  base: Stats;
  final: Stats;
  nature: string;
  label?: string;
}) {
  const [boost, drop] = getNatureBoostDrop(nature);
  return (
    <div>
      {label && <p className="text-[11px] text-slate-400 font-semibold mb-2">{label}</p>}
      <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 text-[11px]">
        <span className="text-slate-500">스탯</span>
        <span className="text-slate-500 text-center">종족값</span>
        <span className="text-slate-500 text-center">실수치</span>
        {STAT_KEYS.map((k) => (
          <Fragment key={k}>
            <span
              className={`font-semibold ${k === boost ? "text-red-400" : k === drop ? "text-blue-400" : "text-slate-300"}`}
            >
              {k}
            </span>
            <span className="text-slate-400 text-center">{base[k]}</span>
            <span
              className={`text-center font-semibold ${k === boost ? "text-red-400" : k === drop ? "text-blue-400" : "text-slate-200"}`}
            >
              {finalStats[k]}
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

// ─── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  species_kor: string;
  species_eng: string;
  types: string[];
  gender: string;
  nature: string;
  ability: string;
  item: string;
  moves: [string, string, string, string];
  level: number;
  base_stats: Stats;
  IVs: Stats;
  EVs: Stats;
  megaForms: string[];
  selectedMegaForm: string;
  mega_ability: string;
  mega_types: string[];
  mega_base_stats: Stats | null;
  abilityOptions: string[];
}

const DEFAULT_EVS: Stats = { HP: 0, ATK: 0, DEF: 0, SpA: 0, SpD: 0, SPE: 0 };

const DEFAULT_FORM: FormState = {
  species_kor: "",
  species_eng: "",
  types: [],
  gender: "수컷",
  nature: "명랑",
  ability: "",
  item: "",
  moves: ["", "", "", ""],
  level: 50,
  base_stats: EMPTY_STATS,
  IVs: { ...DEFAULT_IVS },
  EVs: { ...DEFAULT_EVS },
  megaForms: [],
  selectedMegaForm: "",
  mega_ability: "",
  mega_types: [],
  mega_base_stats: null,
  abilityOptions: [],
};

// ─── Main component ────────────────────────────────────────────────────────────

export default function TeamBuilder() {
  const [team, setTeam] = useState<PokemonEntry[]>([]);
  const [form, setForm] = useState<FormState>({ ...DEFAULT_FORM });
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const evTotal = STAT_KEYS.reduce((s, k) => s + form.EVs[k], 0);
  const evRemaining = 510 - evTotal;

  const hasMegaEnabled = form.selectedMegaForm !== "";

  const currentFinal = useMemo(
    () => calcFinalStats(form.base_stats, form.IVs, form.EVs, form.nature, form.level),
    [form.base_stats, form.IVs, form.EVs, form.nature, form.level],
  );

  const currentMegaFinal = useMemo(() => {
    if (!hasMegaEnabled || !form.mega_base_stats) return null;
    return calcFinalStats(form.mega_base_stats, form.IVs, form.EVs, form.nature, form.level);
  }, [hasMegaEnabled, form.mega_base_stats, form.IVs, form.EVs, form.nature, form.level]);

  // When a species is selected from the combobox
  const handleSpeciesSelect = useCallback((kor: string, eng: string) => {
    const species = getSpeciesData(eng);
    const base_stats = species ? smogonToStats(species.baseStats) : EMPTY_STATS;
    const types = species ? (species.types as string[]).map((t) => TYPE_ENG_TO_KOR[t] ?? t) : [];

    const megaForms = detectMegaForms(eng);
    const firstMega = megaForms[0] ?? "";
    let mega_base_stats: Stats | null = null;
    let mega_types: string[] = [];
    if (firstMega) {
      const megaSpecies = getSpeciesData(firstMega, 7);
      if (megaSpecies) {
        mega_base_stats = smogonToStats(megaSpecies.baseStats);
        mega_types = (megaSpecies.types as string[]).map((t) => TYPE_ENG_TO_KOR[t] ?? t);
      }
    }

    const abilityOptions = speciesAbilitiesKor(eng);

    setForm((prev) => ({
      ...prev,
      species_kor: kor,
      species_eng: eng,
      types,
      base_stats,
      megaForms,
      selectedMegaForm: "",
      mega_ability: "",
      mega_types,
      mega_base_stats,
      abilityOptions,
      ability: abilityOptions[0] ?? prev.ability,
    }));
  }, []);

  // When mega form selection changes
  const handleMegaFormChange = useCallback((formName: string) => {
    if (!formName) {
      setForm((prev) => ({ ...prev, selectedMegaForm: "" }));
      return;
    }
    const megaSpecies = getSpeciesData(formName, 7);
    if (!megaSpecies) return;
    const mega_base_stats = smogonToStats(megaSpecies.baseStats);
    const mega_types = (megaSpecies.types as string[]).map((t) => TYPE_ENG_TO_KOR[t] ?? t);
    setForm((prev) => ({ ...prev, selectedMegaForm: formName, mega_base_stats, mega_types }));
  }, []);

  // EV change with 510 cap
  const handleEVChange = useCallback((stat: StatKey, value: number) => {
    setForm((prev) => {
      const otherTotal = STAT_KEYS.filter((k) => k !== stat).reduce((s, k) => s + prev.EVs[k], 0);
      const clamped = Math.max(0, Math.min(252, Math.min(510 - otherTotal, value)));
      return { ...prev, EVs: { ...prev.EVs, [stat]: clamped } };
    });
  }, []);

  const handleIVChange = useCallback((stat: StatKey, value: number) => {
    setForm((prev) => ({ ...prev, IVs: { ...prev.IVs, [stat]: Math.max(0, Math.min(31, value)) } }));
  }, []);

  const handleMoveChange = useCallback((idx: number, value: string) => {
    setForm((prev) => {
      const moves = [...prev.moves] as [string, string, string, string];
      moves[idx] = value;
      return { ...prev, moves };
    });
  }, []);

  // Build a PokemonEntry from current form state
  const buildEntry = useCallback((): PokemonEntry | null => {
    if (!form.species_eng || !form.species_kor) return null;
    const entry: PokemonEntry = {
      species_eng: form.species_eng,
      species_kor: form.species_kor,
      types: form.types,
      gender: form.gender,
      nature: form.nature,
      ability: form.ability,
      item: form.item,
      moves: form.moves.filter(Boolean),
      level: form.level,
      base_stats: form.base_stats,
      final_stats: currentFinal,
      IVs: form.IVs,
      EVs: form.EVs,
    };
    if (hasMegaEnabled && form.mega_base_stats && currentMegaFinal) {
      entry.mega_types = form.mega_types;
      entry.mega_ability = form.mega_ability;
      entry.mega_base_stats = form.mega_base_stats;
      entry.mega_final_stats = currentMegaFinal;
    }
    return entry;
  }, [form, currentFinal, currentMegaFinal, hasMegaEnabled]);

  const handleAdd = useCallback(() => {
    const entry = buildEntry();
    if (!entry) return;
    if (editingIdx !== null) {
      setTeam((prev) => prev.map((p, i) => (i === editingIdx ? entry : p)));
      setEditingIdx(null);
    } else {
      setTeam((prev) => [...prev, entry]);
    }
    setForm({ ...DEFAULT_FORM });
  }, [buildEntry, editingIdx]);

  const handleEdit = useCallback(
    (idx: number) => {
      const p = team[idx];
      const megaForms = detectMegaForms(p.species_eng);
      const abilityOptions = speciesAbilitiesKor(p.species_eng);

      // Determine selected mega form
      let selectedMegaForm = "";
      if (p.mega_base_stats && megaForms.length > 0) {
        // Find which mega form matches the stored mega_base_stats
        selectedMegaForm = megaForms[0];
      }

      setForm({
        species_kor: p.species_kor,
        species_eng: p.species_eng,
        types: p.types,
        gender: p.gender,
        nature: p.nature,
        ability: p.ability,
        item: p.item,
        moves: [p.moves[0] ?? "", p.moves[1] ?? "", p.moves[2] ?? "", p.moves[3] ?? ""],
        level: p.level,
        base_stats: p.base_stats,
        IVs: { ...p.IVs },
        EVs: { ...p.EVs },
        megaForms,
        selectedMegaForm,
        mega_ability: p.mega_ability ?? "",
        mega_types: p.mega_types ?? [],
        mega_base_stats: p.mega_base_stats ?? null,
        abilityOptions,
      });
      setEditingIdx(idx);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [team],
  );

  const handleRemove = useCallback(
    (idx: number) => {
      setTeam((prev) => prev.filter((_, i) => i !== idx));
      if (editingIdx === idx) {
        setEditingIdx(null);
        setForm({ ...DEFAULT_FORM });
      }
    },
    [editingIdx],
  );

  const handleCancelEdit = useCallback(() => {
    setEditingIdx(null);
    setForm({ ...DEFAULT_FORM });
  }, []);

  // JSON export
  const handleExport = useCallback(() => {
    const data = team.map((p) => {
      const entry: Record<string, unknown> = {};
      entry.species_eng = p.species_eng;
      entry.species_kor = p.species_kor;
      entry.types = p.types;
      if (p.mega_types?.length) entry.mega_types = p.mega_types;
      entry.gender = p.gender;
      entry.nature = p.nature;
      entry.ability = p.ability;
      if (p.mega_ability) entry.mega_ability = p.mega_ability;
      entry.item = p.item || null;
      entry.moves = p.moves;
      entry.level = p.level;
      entry.base_stats = p.base_stats;
      entry.final_stats = p.final_stats;
      if (p.mega_base_stats) entry.mega_base_stats = p.mega_base_stats;
      if (p.mega_final_stats) entry.mega_final_stats = p.mega_final_stats;
      entry.IVs = p.IVs;
      entry.EVs = p.EVs;
      return entry;
    });

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "team.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [team]);

  const canAdd = form.species_eng !== "";

  return (
    <div className="min-h-screen p-6 md:p-8 flex flex-col relative overflow-x-hidden">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-slate-800/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Top bar */}
      <div className="z-10 flex items-center justify-between mb-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-slate-400 hover:text-slate-100 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          돌아가기
        </Link>
        <h1 className="text-xl font-black tracking-tight text-slate-100">팀 빌더</h1>
        <div className="w-20" />
      </div>

      {/* Main content */}
      <div className="z-10 flex flex-col lg:flex-row gap-6 w-full max-w-6xl mx-auto">
        {/* ── Left: Form ── */}
        <div className="flex-1 bg-slate-800/40 backdrop-blur-xl rounded-3xl border border-slate-700/50 shadow-2xl p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-100">
              {editingIdx !== null ? `#${editingIdx + 1} 수정 중` : "포켓몬 추가"}
            </h2>
            {editingIdx !== null && (
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-1 text-slate-400 hover:text-slate-200 text-xs transition-colors"
              >
                <X className="w-3.5 h-3.5" /> 취소
              </button>
            )}
          </div>

          {/* Species */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">포켓몬</label>
            <SpeciesCombobox value={form.species_kor} onSelect={handleSpeciesSelect} />
            {form.types.length > 0 && (
              <div className="flex gap-1 mt-1">
                {form.types.map((t) => (
                  <TypeBadge key={t} type={t} />
                ))}
              </div>
            )}
          </div>

          {/* Gender / Nature */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">성별</label>
              <select
                value={form.gender}
                onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value }))}
                className="bg-slate-900/60 text-slate-100 px-3 py-2 rounded-xl border border-slate-700/50 focus:outline-none focus:border-blue-500/60 text-sm appearance-none"
              >
                <option value="수컷">수컷</option>
                <option value="암컷">암컷</option>
                <option value="무성">무성</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">성격</label>
              <select
                value={form.nature}
                onChange={(e) => setForm((prev) => ({ ...prev, nature: e.target.value }))}
                className="bg-slate-900/60 text-slate-100 px-3 py-2 rounded-xl border border-slate-700/50 focus:outline-none focus:border-blue-500/60 text-sm appearance-none"
              >
                {DICT.NATURE_KOR.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Ability / Item */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">특성</label>
              <Combobox
                value={form.ability}
                onChange={(v) => setForm((prev) => ({ ...prev, ability: v }))}
                options={form.abilityOptions.length > 0 ? form.abilityOptions : DICT.ABILITY_KOR}
                placeholder="특성 이름..."
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">지닌물건</label>
              <Combobox
                value={form.item}
                onChange={(v) => setForm((prev) => ({ ...prev, item: v }))}
                options={DICT.ITEMS_KOR}
                placeholder="아이템 이름..."
              />
            </div>
          </div>

          {/* Moves */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">기술 (최대 4개)</label>
            <div className="grid grid-cols-2 gap-2">
              {([0, 1, 2, 3] as const).map((i) => (
                <Combobox
                  key={i}
                  value={form.moves[i]}
                  onChange={(v) => handleMoveChange(i, v)}
                  options={DICT.MOVES_KOR}
                  placeholder={`기술 ${i + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Level */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">레벨</label>
            <input
              type="number"
              min={1}
              max={100}
              value={form.level}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, level: Math.max(1, Math.min(100, Number(e.target.value) || 1)) }))
              }
              className="w-24 bg-slate-900/60 text-slate-100 px-3 py-2 rounded-xl border border-slate-700/50 focus:outline-none focus:border-blue-500/60 text-sm"
            />
          </div>

          {/* IVs */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">개체값 (IVs)</label>
            <div className="grid grid-cols-6 gap-1">
              {STAT_KEYS.map((k) => (
                <IVInput key={k} label={k} value={form.IVs[k]} onChange={(v) => handleIVChange(k, v)} />
              ))}
            </div>
          </div>

          {/* EVs */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">노력치 (EVs)</label>
              <span className={`text-xs font-semibold ${evTotal > 510 ? "text-red-400" : "text-slate-400"}`}>
                {evTotal} / 510
              </span>
            </div>
            {/* EV progress bar */}
            <div className="w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${evTotal > 510 ? "bg-red-500" : "bg-blue-500"}`}
                style={{ width: `${Math.min(100, (evTotal / 510) * 100)}%` }}
              />
            </div>
            <div className="grid grid-cols-6 gap-1">
              {STAT_KEYS.map((k) => (
                <EVInput
                  key={k}
                  label={k}
                  value={form.EVs[k]}
                  onChange={(v) => handleEVChange(k, v)}
                  max={evRemaining}
                />
              ))}
            </div>
          </div>

          {/* Stats preview */}
          {form.species_eng && (
            <div className="bg-slate-900/40 rounded-2xl p-4 border border-slate-700/30">
              <StatsTable base={form.base_stats} final={currentFinal} nature={form.nature} />
            </div>
          )}

          {/* Mega section */}
          {form.megaForms.length > 0 && (
            <div className="flex flex-col gap-3 bg-slate-900/40 rounded-2xl p-4 border border-slate-700/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">메가진화</span>
                <div className="flex items-center gap-2">
                  {form.megaForms.length > 1 && hasMegaEnabled && (
                    <select
                      value={form.selectedMegaForm}
                      onChange={(e) => handleMegaFormChange(e.target.value)}
                      className="bg-slate-800 text-slate-200 text-xs px-2 py-1 rounded-lg border border-slate-600 focus:outline-none"
                    >
                      {form.megaForms.map((f) => (
                        <option key={f} value={f}>
                          {f.replace(form.species_eng + "-", "")}
                        </option>
                      ))}
                    </select>
                  )}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={hasMegaEnabled}
                      onChange={(e) => handleMegaFormChange(e.target.checked ? form.megaForms[0] : "")}
                    />
                    <div className="w-9 h-5 bg-slate-700/50 rounded-full peer peer-checked:bg-blue-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                  </label>
                </div>
              </div>

              {hasMegaEnabled && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                      메가 특성
                    </label>
                    <Combobox
                      value={form.mega_ability}
                      onChange={(v) => setForm((prev) => ({ ...prev, mega_ability: v }))}
                      options={DICT.ABILITY_KOR}
                      placeholder="메가 특성 이름..."
                    />
                  </div>
                  {form.mega_types.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                        메가 타입
                      </span>
                      <div className="flex gap-1">
                        {form.mega_types.map((t) => (
                          <TypeBadge key={t} type={t} />
                        ))}
                      </div>
                    </div>
                  )}
                  {form.mega_base_stats && currentMegaFinal && (
                    <StatsTable
                      base={form.mega_base_stats}
                      final={currentMegaFinal}
                      nature={form.nature}
                      label="메가 실수치"
                    />
                  )}
                </>
              )}
            </div>
          )}

          {/* Add / Update button */}
          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className="mt-auto w-full bg-slate-100 hover:bg-white disabled:bg-slate-700/50 disabled:text-slate-500 text-slate-900 font-bold py-3.5 rounded-2xl transition-all duration-200 flex justify-center items-center gap-2 text-sm"
          >
            {editingIdx !== null ? (
              <>
                <Edit2 className="w-4 h-4" /> 수정 완료
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" /> 추가
              </>
            )}
          </button>
        </div>

        {/* ── Right: Team list ── */}
        <div className="lg:w-80 flex flex-col gap-4">
          <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl border border-slate-700/50 shadow-2xl p-6 flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-100">현재 팀</h2>
              <span className="text-xs text-slate-400 font-semibold">{team.length}마리</span>
            </div>

            {team.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-sm py-12">
                포켓몬을 추가해 주세요
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {team.map((p, idx) => (
                  <div
                    key={idx}
                    className={`group bg-slate-900/40 rounded-2xl p-3 border transition-all ${
                      editingIdx === idx
                        ? "border-blue-500/60 bg-blue-500/5"
                        : "border-slate-700/30 hover:border-slate-600/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-500 font-semibold shrink-0">#{idx + 1}</span>
                          <span className="font-bold text-slate-200 text-sm truncate">{p.species_kor}</span>
                          <span className="text-slate-500 text-xs truncate">{p.species_eng}</span>
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          {p.types.map((t) => (
                            <TypeBadge key={t} type={t} />
                          ))}
                          {p.mega_types && (
                            <>
                              <span className="text-slate-500 text-[10px] self-center">→</span>
                              {p.mega_types.map((t) => (
                                <TypeBadge key={"m" + t} type={t} />
                              ))}
                            </>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 flex gap-2 flex-wrap mt-0.5">
                          <span>{p.nature}</span>
                          <span>·</span>
                          <span>{p.ability}</span>
                          {p.item && (
                            <>
                              <span>·</span>
                              <span>{p.item}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 ml-2 shrink-0">
                        <button
                          onClick={() => handleEdit(idx)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemove(idx)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={team.length === 0}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700/50 disabled:text-slate-500 text-white font-bold py-4 rounded-2xl transition-all duration-200 flex justify-center items-center gap-2 shadow-lg shadow-emerald-900/30"
          >
            <Download className="w-4 h-4" />
            JSON 다운로드
          </button>
        </div>
      </div>
    </div>
  );
}
