import vanhoveDictionary from './vanhove_2026_dictionary.json';
import { DictionaryEntry } from './dictionary';

export type VanhoveEntry = DictionaryEntry & {
  headword_original: string;
  source: DictionaryEntry['source'] & {
    pdf_page: number;
    column: number;
    end_page: number;
    end_column: number;
    y: number;
  };
};

export const getVanhoveDictionary = (): VanhoveEntry[] => {
  return vanhoveDictionary as VanhoveEntry[];
};
