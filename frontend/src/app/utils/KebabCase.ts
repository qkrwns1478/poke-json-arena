import ITEMS_ENG from "@/data/ItemsEnglish";
import ITEMS_KEBAB from "@/data/ItemsKebab";

export default function kebab(str: string) {
  const idx = ITEMS_ENG.indexOf(str);
  return idx !== -1 ? ITEMS_KEBAB[idx] : str;
}