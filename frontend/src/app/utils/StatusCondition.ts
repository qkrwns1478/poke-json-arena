const scTranslator = (str: string): string => {
  const hp: string = str.split(" ")[0];
  const sc: string = str.split(" ")[1];

  switch (sc) {
    case "fnt":
      return hp + " 기절";
    case "par":
      return hp + " 마비";
    case "slp":
      return hp + " 잠듦";
    case "frz":
      return hp + " 얼음";
    case "brn":
      return hp + " 화상";
    case "psn":
      return hp + " 독";
    default:
      return str;
  }
};

export default scTranslator;
