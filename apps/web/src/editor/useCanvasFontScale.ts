import { useEffect, useState } from "react";
import { FONT_SCALE_KEY, FONT_SCALE_MAX, FONT_SCALE_MIN, loadFontScale } from "../localPrefs.js";

/** Canvas text-size preference, persisted to localStorage on change. */
export function useCanvasFontScale() {
  const [fontScale, setFontScale] = useState(loadFontScale);

  useEffect(() => {
    localStorage.setItem(FONT_SCALE_KEY, String(fontScale));
  }, [fontScale]);

  const adjustFontScale = (delta: number) => {
    setFontScale((v) => Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, Math.round((v + delta) * 100) / 100)));
  };

  return { fontScale, adjustFontScale };
}
