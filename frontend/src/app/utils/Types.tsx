export const TYPE_ENG_TO_KOR: Record<string, string> = {
  Normal: "노말",
  Fire: "불꽃",
  Water: "물",
  Electric: "전기",
  Grass: "풀",
  Ice: "얼음",
  Fighting: "격투",
  Poison: "독",
  Ground: "땅",
  Flying: "비행",
  Psychic: "에스퍼",
  Bug: "벌레",
  Rock: "바위",
  Ghost: "고스트",
  Dragon: "드래곤",
  Dark: "악",
  Steel: "강철",
  Fairy: "페어리",
  Stella: "스텔라"
};

const STELLA_CONIC = "conic-gradient(#ceb344_8%,#d09949_8%_15%,#ce684c_15%_19%,#c9606e_19%_22%,#b975a9_22%_25%,#9f5b89_25%_28%,#694d94_28%_31%,#63537a_31%_35%,#596677_35%_42%,#5f708d_42%_50%,#4887be_50%_58%,#3d9cc4_58%_65%,#428dc4_65%_69%,#457cbb_69%_72%,#4095b9_72%_75%,#61b7c2_75%_78%,#56c267_78%_81%,#a5b65b_81%_85%,#aaaf80_85%_92%,#b69867_0)";

const TYPE_COLORS: Record<string, string> = {
  노말: "bg-[#949495]",
  격투: "bg-[#e09c40]",
  비행: "bg-[#a2c3e7]",
  독: "bg-[#735198]",
  땅: "bg-[#9c7743]",
  바위: "bg-[#bfb889]",
  벌레: "bg-[#9fa244]",
  고스트: "bg-[#684870]",
  강철: "bg-[#69a9c7]",
  불꽃: "bg-[#e56c3e]",
  물: "bg-[#5185c5]",
  풀: "bg-[#66a945]",
  전기: "bg-[#fbb917]",
  에스퍼: "bg-[#dd6b7b]",
  얼음: "bg-[#6dc8eb]",
  드래곤: "bg-[#535ca8]",
  악: "bg-[#4c4948]",
  페어리: "bg-[#dab4d4]",
  스텔라: `bg-[${STELLA_CONIC}]`
};

export function TypeBadge({ type }: { type: string }) {
  const color = TYPE_COLORS[type] ?? "bg-slate-600";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold text-white ${color}`}>{type}</span>
  );
}
