export const THEME_FONTS = [
  { id: "Roboto", family: "var(--font-theme-roboto), sans-serif" },
  { id: "Open Sans", family: "var(--font-theme-open-sans), sans-serif" },
  { id: "Lato", family: "var(--font-theme-lato), sans-serif" },
  { id: "Montserrat", family: "var(--font-theme-montserrat), sans-serif" },
  { id: "Poppins", family: "var(--font-theme-poppins), sans-serif" },
  { id: "Nunito", family: "var(--font-theme-nunito), sans-serif" },
  { id: "Oswald", family: "var(--font-theme-oswald), sans-serif" },
  { id: "Merriweather", family: "var(--font-theme-merriweather), serif" },
  { id: "Playfair Display", family: "var(--font-theme-playfair), serif" },
  { id: "Source Sans 3", family: "var(--font-theme-source-sans), sans-serif" },
];

export const HEADER_SIZES = [18, 20, 22, 24];
export const QUESTION_SIZES = [12, 14, 16, 18];
export const TEXT_SIZES = [9, 10, 11, 12];

const FONT_IDS = new Set(THEME_FONTS.map((font) => font.id));

export function normalizeTextStyle(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    headerFont: pickFont(source.headerFont),
    headerSize: pickSize(source.headerSize, HEADER_SIZES, 24),
    questionFont: pickFont(source.questionFont),
    questionSize: pickSize(source.questionSize, QUESTION_SIZES, 12),
    textFont: pickFont(source.textFont),
    textSize: pickSize(source.textSize, TEXT_SIZES, 11),
  };
}

export function textStyle(appearance) {
  const style = normalizeTextStyle(appearance);
  return {
    header: face(style.headerFont, style.headerSize),
    question: face(style.questionFont, style.questionSize),
    text: face(style.textFont, style.textSize),
  };
}

function pickFont(value) {
  return FONT_IDS.has(value) ? value : "Roboto";
}

function pickSize(value, allowed, fallback) {
  const size = Number(value);
  return allowed.includes(size) ? size : fallback;
}

function face(fontId, size) {
  const font = THEME_FONTS.find((item) => item.id === fontId) || THEME_FONTS[0];
  return { fontFamily: font.family, fontSize: `${size}px` };
}
