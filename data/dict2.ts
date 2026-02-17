// Utility to load the dict2.json file
import dict2 from '../data/dict2.json';

export type Dict2Entry = {
  headword: string;
  pos_guess: string | null;
  gloss_en: string;
  raw: string;
  ocr_conf?: number;
  source: {
    page: number;
    line_index?: number;
    psm?: number;
  };
};

export const getDict2 = (): Dict2Entry[] => {
  return dict2 as Dict2Entry[];
};
