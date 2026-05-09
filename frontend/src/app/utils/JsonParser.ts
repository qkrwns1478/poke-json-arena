import { trKorToEng } from "@/app/utils/Translator";

export interface Stats {
  HP: number;
  ATK: number;
  DEF: number;
  SpA: number;
  SpD: number;
  SPE: number;
}

export interface TypeEffectiveness {
  x4: string[] | null;
  x2: string[] | null;
  "x0.5": string[] | null;
  "x0.25": string[] | null;
  x0: string[] | null;
}

export interface Pokemon {
  species_eng: string;
  species_kor: string;
  nickname?: string;
  types: string[];
  gender: string;
  level: number;
  nature: string;
  ability: string;
  mega_ability?: string;
  item: string | null;
  moves: string[];
  z_move?: string;
  base_stats: Stats;
  final_stats: Stats;
  mega_base_stats?: Stats;
  mega_final_stats?: Stats;
  IVs: Stats;
  EVs: Stats;
  type_effectiveness: TypeEffectiveness;
  PSformat: string;
}

/**
 * 업로드된 JSON 배열을 Pokemon 객체 배열로 파싱하는 함수
 * @param jsonData 파싱할 원본 JSON 배열
 * @returns Pokemon 객체 배열
 */
export const parsePokemonTeam = (jsonData: Record<string, unknown>[]): Pokemon[] => {
  return jsonData.map((data): Pokemon => {
    // 1. 기본 필드 할당
    const species_eng = (data.species_eng as string) ?? "";
    const species_kor = (data.species_kor as string) ?? "";
    const nickname = (data.nickname as string | undefined) || undefined;
    const types = (data.types as string[]) || [];
    const gender = (data.gender as string) || "무성";
    const level = (data.level as number) || 50;
    const nature = (data.nature as string) || "신중";
    const ability = (data.ability as string) ?? "";
    const item = (data.item as string | null) || null;
    const moves = (data.moves as string[]) || [];

    const mega_ability = data.mega_ability as string | undefined;
    const z_move = data.z_move as string | undefined;
    const base_stats = data.base_stats as Stats;
    const final_stats = data.final_stats as Stats;
    const mega_base_stats = data.mega_base_stats as Stats | undefined;
    const mega_final_stats = data.mega_final_stats as Stats | undefined;
    const type_effectiveness = data.type_effectiveness as TypeEffectiveness;

    // IVs, EVs 디폴트값 처리
    const IVs = (data.IVs as Stats) || { HP: 31, ATK: 31, DEF: 31, SpA: 31, SpD: 31, SPE: 31 };
    const EVs = (data.EVs as Stats) || { HP: 0, ATK: 0, DEF: 0, SpA: 0, SpD: 0, SPE: 0 };

    // 2. PSformat 생성을 위한 영문 번역
    // const species_eng = trKorToEng(species_kor, "POKEMON");
    const item_eng = item ? trKorToEng(item, "ITEMS") : null;
    const ability_eng = trKorToEng(ability, "ABILITY");
    const nature_eng = trKorToEng(nature, "NATURE");
    const moves_eng = moves.map((m: string) => trKorToEng(m, "MOVES"));

    // 3. PSformat 문자열 조립
    let psFormat = species_eng;

    // 성별 표기 (쇼다운 포맷: (M) / (F) / 무성은 생략)
    if (gender === "수컷") psFormat += " (M)";
    else if (gender === "암컷") psFormat += " (F)";

    if (item_eng) psFormat += ` @ ${item_eng}`;
    psFormat += "\n";

    // 특성
    psFormat += `Ability: ${ability_eng}\n`;

    // 레벨
    psFormat += `Level: ${level}\n`

    // 노력치 (EVs)
    const evsList: string[] = [];
    if (EVs.HP > 0) evsList.push(`${EVs.HP} HP`);
    if (EVs.ATK > 0) evsList.push(`${EVs.ATK} Atk`);
    if (EVs.DEF > 0) evsList.push(`${EVs.DEF} Def`);
    if (EVs.SpA > 0) evsList.push(`${EVs.SpA} SpA`);
    if (EVs.SpD > 0) evsList.push(`${EVs.SpD} SpD`);
    if (EVs.SPE > 0) evsList.push(`${EVs.SPE} Spe`);
    if (evsList.length > 0) psFormat += `EVs: ${evsList.join(" / ")}\n`;

    // 성격
    psFormat += `${nature_eng} Nature\n`;

    // 개체값 (IVs - Showdown 포맷에서는 31이 아닌 항목만 명시)
    const ivsList: string[] = [];
    if (IVs.HP < 31) ivsList.push(`${IVs.HP} HP`);
    if (IVs.ATK < 31) ivsList.push(`${IVs.ATK} Atk`);
    if (IVs.DEF < 31) ivsList.push(`${IVs.DEF} Def`);
    if (IVs.SpA < 31) ivsList.push(`${IVs.SpA} SpA`);
    if (IVs.SpD < 31) ivsList.push(`${IVs.SpD} SpD`);
    if (IVs.SPE < 31) ivsList.push(`${IVs.SPE} Spe`);
    if (ivsList.length > 0) psFormat += `IVs: ${ivsList.join(" / ")}\n`;

    // 기술 배치
    moves_eng.forEach((m: string) => {
      psFormat += `- ${m}\n`;
    });

    // 4. 완성된 Pokemon 객체 리턴
    return {
      species_eng,
      species_kor,
      nickname: nickname || undefined,
      types,
      gender,
      level,
      nature,
      ability,
      mega_ability,
      item,
      moves,
      z_move,
      base_stats,
      final_stats,
      mega_base_stats,
      mega_final_stats,
      IVs,
      EVs,
      type_effectiveness,
      PSformat: psFormat.trim(),
    };
  });
};
