// Utility to load the dictionary.json file
import dictionary from '../data/dictionary.json';

export type DictionaryEntry = {
  headword: string;
  headword_parts: string[];
  gloss_en: string[];
  gloss_ar: string[];
  pos: string[] | null;
  gender: string | null;
  number: string | null;
  class: string | null;
  nominalized_verb: boolean;
  regions: string[];
  raw: string[];
  source: {
    page: number;
    start_line: number;
    end_line: number;
  };
};

export const getDictionary = (): DictionaryEntry[] => {
  return dictionary as DictionaryEntry[];
};
