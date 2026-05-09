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
};

export const TYPE_COLORS: Record<string, string> = {
  노말: "bg-slate-500",
  불꽃: "bg-orange-500",
  물: "bg-blue-500",
  전기: "bg-yellow-400 text-slate-900",
  풀: "bg-green-600",
  얼음: "bg-cyan-400 text-slate-900",
  격투: "bg-red-600",
  독: "bg-purple-500",
  땅: "bg-yellow-600",
  비행: "bg-indigo-400",
  에스퍼: "bg-pink-500",
  벌레: "bg-lime-500 text-slate-900",
  바위: "bg-stone-500",
  고스트: "bg-purple-700",
  드래곤: "bg-violet-600",
  악: "bg-slate-700",
  강철: "bg-slate-400 text-slate-900",
  페어리: "bg-pink-400 text-slate-900",
};

export function TypeBadge({ type }: { type: string }) {
  const color = TYPE_COLORS[type] ?? "bg-slate-600";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold text-white ${color}`}>{type}</span>
  );
}
