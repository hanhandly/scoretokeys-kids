import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { SongModel } from "../types";
import {
  LANGUAGE_STORAGE_KEY,
  localizeSongPresentation,
  localizeTechnicalError,
  resolveLanguage,
  translate,
} from "./messages";
import type {
  Language,
  TranslationKey,
  TranslationParams,
} from "./messages";

interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  plural: (
    singularKey: TranslationKey,
    pluralKey: TranslationKey,
    count: number,
    params?: TranslationParams,
  ) => string;
  localizeError: (message: string) => string;
  localizeSong: (song: SongModel) => SongModel;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readInitialLanguage(): Language {
  let storedLanguage: string | null = null;
  try {
    storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    // Language persistence is optional.
  }
  return resolveLanguage(storedLanguage, window.navigator.language);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(readInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = translate(language, "meta.title");
    document
      .querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.setAttribute("content", translate(language, "meta.description"));
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // The product still works when storage is unavailable.
    }
  }, [language]);

  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams) =>
      translate(language, key, params),
    [language],
  );
  const plural = useCallback(
    (
      singularKey: TranslationKey,
      pluralKey: TranslationKey,
      count: number,
      params: TranslationParams = {},
    ) =>
      translate(language, count === 1 ? singularKey : pluralKey, {
        ...params,
        count,
      }),
    [language],
  );
  const localizeError = useCallback(
    (message: string) => localizeTechnicalError(message, language),
    [language],
  );
  const localizeSong = useCallback(
    (song: SongModel) => localizeSongPresentation(song, language),
    [language],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      t,
      plural,
      localizeError,
      localizeSong,
    }),
    [language, localizeError, localizeSong, plural, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used inside I18nProvider.");
  }
  return value;
}
