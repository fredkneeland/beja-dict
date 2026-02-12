// Utility to load the english_beja.json file
import englishBeja from '../data/english_beja.json';

export type EnglishBejaEntry = {
  english: string;
  beja: string[];
  gloss_ar: string[];
  pos: string[] | null;
  gender: string | null;
  class: string | null;
  regions: string[];
  raw: string[];
  source: {
    page: number;
    start_line: number;
    end_line: number;
  };
};

export const getEnglishBeja = (): EnglishBejaEntry[] => {
  return englishBeja as EnglishBejaEntry[];
};
