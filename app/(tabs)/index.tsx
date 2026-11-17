import * as Clipboard from 'expo-clipboard';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CopyButton } from '../../components/ui/copy-button';

import Fuse from 'fuse.js';
import React from 'react';
import { latinToArabic } from '../../data/bejaScript';
import { Dict2Entry, getDict2 } from '../../data/dict2';
import { DictionaryEntry, getDictionary } from '../../data/dictionary';
import { EnglishBejaEntry, getEnglishBeja } from '../../data/english_beja';
import { VanhoveEntry, getVanhoveDictionary } from '../../data/vanhove_2026_dictionary';

import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [searchMode, setSearchMode] = React.useState<'beja' | 'english' | 'arabic'>('beja');
  const [arabicScript, setArabicScript] = React.useState(false);
  const [largeText, setLargeText] = React.useState(false);

  type SearchResult =
    | { kind: 'beja_en'; entry: DictionaryEntry }
    | { kind: 'en_beja'; entry: EnglishBejaEntry }
    | { kind: 'dict2'; entry: Dict2Entry }
    | { kind: 'vanhove'; entry: VanhoveEntry };

  const [results, setResults] = React.useState<SearchResult[]>([]);
  const dictionary = React.useMemo(() => getDictionary(), []);
  const englishBeja = React.useMemo(() => getEnglishBeja(), []);
  const dict2 = React.useMemo(() => getDict2(), []);
  const vanhove = React.useMemo(() => getVanhoveDictionary(), []);
  const limitedResults = React.useMemo(() => results.slice(0, 30), [results]);

  const normalizeForSearch = React.useCallback((input: string) => {
    // Keep apostrophes (common in Beja orthography) but normalize the many unicode variants
    // so that  /  / BC etc. behave consistently.
    const normalized = (input || '')
      .toLowerCase()
      .replace(/[\u2019\u2018\u02BC\u02BB\u2032]/g, "'")
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9']+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return normalized;
  }, []);

  const stripApostrophes = React.useCallback((input: string) => input.replace(/'+/g, ''), []);

  const isWithinEditDistance1 = React.useCallback((a: string, b: string) => {
    if (a === b) return true;
    const la = a.length;
    const lb = b.length;
    if (Math.abs(la - lb) > 1) return false;

    // Ensure a is the shorter (or equal) string.
    if (la > lb) return isWithinEditDistance1(b, a);

    let i = 0;
    let j = 0;
    let edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        i++;
        j++;
        continue;
      }
      edits++;
      if (edits > 1) return false;
      if (a.length === b.length) {
        // substitution
        i++;
        j++;
      } else {
        // insertion into b (or deletion from b)
        j++;
      }
    }
    // Account for trailing char in the longer string.
    if (j < b.length || i < a.length) edits++;
    return edits <= 1;
  }, []);

  const fuse = React.useMemo(() => {
    type IndexedResult = SearchResult & {
      bejaPrimary: string;
      bejaPrimaryNoApos: string;
      bejaSearch: string;
      bejaSearchNoApos: string;
    };

    const collection: IndexedResult[] = [
      ...[
        ...dictionary.map((entry) => ({ kind: 'beja_en' as const, entry })),
        ...vanhove.map((entry) => ({ kind: 'vanhove' as const, entry })),
      ].map((result) => {
        const { entry } = result;
        const bejaPrimary = normalizeForSearch(entry.headword ?? '');
        const bejaRaw = [entry.headword, ...(entry.headword_parts ?? [])].join(' ');
        const bejaSearch = normalizeForSearch(bejaRaw);
        return {
          ...result,
          bejaPrimary,
          bejaPrimaryNoApos: stripApostrophes(bejaPrimary),
          bejaSearch,
          bejaSearchNoApos: stripApostrophes(bejaSearch),
        };
      }),
      ...englishBeja.map((entry) => {
        const bejaPrimary = normalizeForSearch((entry.beja ?? [])[0] ?? '');
        const bejaRaw = (entry.beja ?? []).join(' ');
        const bejaSearch = normalizeForSearch(bejaRaw);
        return {
          kind: 'en_beja' as const,
          entry,
          bejaPrimary,
          bejaPrimaryNoApos: stripApostrophes(bejaPrimary),
          bejaSearch,
          bejaSearchNoApos: stripApostrophes(bejaSearch),
        };
      }),
      ...dict2.map((entry) => {
        const bejaPrimary = normalizeForSearch(entry.headword ?? '');
        const bejaSearch = normalizeForSearch(entry.headword);
        return {
          kind: 'dict2' as const,
          entry,
          bejaPrimary,
          bejaPrimaryNoApos: stripApostrophes(bejaPrimary),
          bejaSearch,
          bejaSearchNoApos: stripApostrophes(bejaSearch),
        };
      }),
    ];

    return new Fuse(collection, {
      includeScore: true,
      ignoreLocation: true,
      // Slightly stricter threshold keeps very-distant matches from crowding out
      // near-misses like giraat → giiraat.
      threshold: 0.33,
      minMatchCharLength: 2,
      // Prefer primary headword matches, but keep broader forms for flexibility.
      keys: [
        { name: 'bejaPrimary', weight: 0.75 },
        { name: 'bejaPrimaryNoApos', weight: 0.15 },
        { name: 'bejaSearch', weight: 0.08 },
        { name: 'bejaSearchNoApos', weight: 0.02 },
      ],
    });
  }, [dictionary, englishBeja, dict2, vanhove, normalizeForSearch, stripApostrophes]);

  React.useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    if (searchMode === 'arabic') {
      const s = search.trim();
      const arabicMatches: SearchResult[] = [
        ...dictionary.map(entry => ({ kind: 'beja_en' as const, entry })),
        ...vanhove.map(entry => ({ kind: 'vanhove' as const, entry })),
      ].filter(({ entry }) => entry.gloss_ar && entry.gloss_ar.some(g => g.includes(s)));
      setResults(arabicMatches);
    } else if (searchMode === 'english') {
      // English strict search: match in gloss_en or raw
      const s = search.trim().toLowerCase();
      const bejaEnMatches: SearchResult[] = dictionary
        .filter(entry =>
          (entry.gloss_en && entry.gloss_en.some(g => g.toLowerCase().includes(s))) ||
          (entry.raw && entry.raw.some(r => r.toLowerCase().includes(s)))
        )
        .map(entry => ({ kind: 'beja_en' as const, entry }));

      const enBejaMatches: SearchResult[] = englishBeja
        .filter(entry =>
          (entry.english && entry.english.toLowerCase().includes(s)) ||
          (entry.raw && entry.raw.some(r => r.toLowerCase().includes(s)))
        )
        .map(entry => ({ kind: 'en_beja' as const, entry }));

      const dict2Matches: SearchResult[] = dict2
        .filter(entry =>
          (entry.gloss_en && entry.gloss_en.toLowerCase().includes(s)) ||
          (entry.raw && entry.raw.toLowerCase().includes(s))
        )
        .map(entry => ({ kind: 'dict2' as const, entry }));

      const vanhoveMatches: SearchResult[] = vanhove
        .filter(entry =>
          (entry.gloss_en && entry.gloss_en.some(g => g.toLowerCase().includes(s))) ||
          (entry.raw && entry.raw.some(r => r.toLowerCase().includes(s)))
        )
        .map(entry => ({ kind: 'vanhove' as const, entry }));

      const scoreEnglishResult = (r: SearchResult) => {
        const englishCandidates: string[] =
          r.kind === 'beja_en' || r.kind === 'vanhove'
            ? (r.entry.gloss_en ?? [])
            : r.kind === 'en_beja'
              ? [r.entry.english ?? '']
              : [r.entry.gloss_en ?? ''];

        const normalized = englishCandidates
          .map(t => (t || '').toLowerCase().trim())
          .filter(Boolean);

        const exact = normalized.some(t => t === s);
        const starts = normalized.some(t => t.startsWith(s));
        const includes = normalized.some(t => t.includes(s));
        const rawIncludes =
          r.kind === 'dict2'
            ? (r.entry.raw ?? '').toLowerCase().includes(s)
            : (r.entry.raw ?? []).some(line => line.toLowerCase().includes(s));

        // Lower is better
        const rank = exact ? 0 : starts ? 1 : includes ? 2 : rawIncludes ? 3 : 4;
        const bestLen = normalized.length > 0 ? Math.min(...normalized.map(t => t.length)) : 9999;

        return { rank, bestLen };
      };

      const merged = [ ...bejaEnMatches, ...enBejaMatches, ...dict2Matches, ...vanhoveMatches]
        .map(r => ({ r, ...scoreEnglishResult(r) }))
        .sort((a, b) => {
          if (a.rank !== b.rank) return a.rank - b.rank;
          if (a.bestLen !== b.bestLen) return a.bestLen - b.bestLen;
          const aPrimary =
            a.r.kind === 'beja_en'
              ? a.r.entry.headword
              : a.r.kind === 'en_beja'
                ? a.r.entry.english
                : a.r.entry.headword;
          const bPrimary =
            b.r.kind === 'beja_en'
              ? b.r.entry.headword
              : b.r.kind === 'en_beja'
                ? b.r.entry.english
                : b.r.entry.headword;
          return aPrimary.localeCompare(bPrimary);
        })
        .map(x => x.r);

      setResults(merged);
    } else {
      // Fuzzy Beja search (searchMode === 'beja'): match headword and headword_parts
      const q = normalizeForSearch(search);
      const qNoApos = stripApostrophes(q);
      const qCompact = q.replace(/\s+/g, '');
      const qNoAposCompact = qNoApos.replace(/\s+/g, '');
      const matches = fuse.search(q, { limit: 200 });
      const ranked = matches.map((m) => {
        const item: any = m.item;
        const bejaSearchCompact = String(item?.bejaSearch ?? '').replace(/\s+/g, '');
        const bejaSearchNoAposCompact = String(item?.bejaSearchNoApos ?? '').replace(/\s+/g, '');
        const primaryCompact = String(item?.bejaPrimary ?? '').replace(/\s+/g, '');
        const primaryNoAposCompact = String(item?.bejaPrimaryNoApos ?? '').replace(/\s+/g, '');

        const exact = bejaSearchCompact === qCompact;
        const exactNoApos = bejaSearchNoAposCompact === qNoAposCompact;
        const starts =
          (typeof item?.bejaSearch === 'string' && item.bejaSearch.startsWith(q)) ||
          (qNoApos && typeof item?.bejaSearchNoApos === 'string' && item.bejaSearchNoApos.startsWith(qNoApos));
        const near =
          (primaryCompact && isWithinEditDistance1(primaryCompact, qCompact)) ||
          (qNoAposCompact && primaryNoAposCompact && isWithinEditDistance1(primaryNoAposCompact, qNoAposCompact));

        return { ...m, _rank: { exact, exactNoApos, starts, near } };
      });

      const sorted: SearchResult[] = ranked
        .sort((a, b) => {
          if (a._rank.exact !== b._rank.exact) return a._rank.exact ? -1 : 1;
          if (a._rank.exactNoApos !== b._rank.exactNoApos) return a._rank.exactNoApos ? -1 : 1;
          if (a._rank.starts !== b._rank.starts) return a._rank.starts ? -1 : 1;
          if (a._rank.near !== b._rank.near) return a._rank.near ? -1 : 1;
          return (a.score ?? 1) - (b.score ?? 1);
        })
        .slice(0, 60)
        .map((m) => m.item as unknown as SearchResult);

      setResults(sorted);
    }
  }, [search, searchMode, dictionary, englishBeja, dict2, vanhove, fuse, normalizeForSearch, stripApostrophes, isWithinEditDistance1]);

  const getBejaText = (r: SearchResult) => {
    if (r.kind === 'beja_en') return r.entry.headword ?? '';
    if (r.kind === 'en_beja') {
      return (r.entry.beja && r.entry.beja.length > 0 ? r.entry.beja.join('; ') : '') || '';
    }
    return r.entry.headword ?? '';
  };

  const getEnglishText = (r: SearchResult) => {
    if (r.kind === 'beja_en' || r.kind === 'vanhove') return r.entry.gloss_en?.join('; ') ?? '';
    if (r.kind === 'en_beja') return r.entry.english ?? '';
    return r.entry.gloss_en ?? '';
  };

  const getDisplayedBejaText = (r: SearchResult) => {
    const text = getBejaText(r);
    return arabicScript ? latinToArabic(text) : text;
  };

  const getArabicText = (r: SearchResult) => {
    if (r.kind === 'dict2') return '';
    const ar = r.entry.gloss_ar;
    return ar && ar.length > 0 ? ar.join('; ') : '';
  };

  const getSourcePage = (r: SearchResult) => r.entry.source?.page;
  const getPdfOffset = (r: SearchResult) => (r.kind === 'en_beja' ? 198 : r.kind === 'dict2' || r.kind === 'vanhove' ? 0 : 16);
  const getPdfDoc = (r: SearchResult) => (r.kind === 'dict2' ? 'dict2' : r.kind === 'vanhove' ? 'vanhove' : 'dictionary');

  const getRawText = (r: SearchResult) => {
    if (r.kind === 'dict2') return r.entry.raw ?? '';
    return (r.entry.raw ?? []).join('\n');
  };

  const getPrimaryText = (r: SearchResult) => {
    if (searchMode === 'arabic') return getArabicText(r);
    if (searchMode === 'english') return getEnglishText(r);
    return getDisplayedBejaText(r);
  };
  const getSecondaryText = (r: SearchResult) => {
    if (searchMode === 'arabic') return `${getDisplayedBejaText(r)}${getEnglishText(r) ? ' — ' + getEnglishText(r) : ''}`;
    if (searchMode === 'english') return getDisplayedBejaText(r);
    return getEnglishText(r);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.searchContainer}>
        <TextInput
          style={[styles.searchInput, largeText && styles.largeSearchInput, arabicScript ? styles.alignRight : styles.alignLeft]}
          placeholder={searchMode === 'beja' ? 'Search Bidhaawyeet…' : searchMode === 'arabic' ? 'Search Arabic…' : 'Search English…'}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.toggleRow}>
          <View style={styles.segmented} accessibilityRole="tablist">
            <TouchableOpacity
              accessibilityRole="tab"
              accessibilityState={{ selected: searchMode === 'beja' }}
              style={[styles.segment, largeText && styles.largeSegment, searchMode === 'beja' && styles.segmentActive]}
              onPress={() => setSearchMode('beja')}>
              <Text style={[styles.segmentText, largeText && styles.largeControlText, searchMode === 'beja' && styles.segmentTextActive]}>Bidhaawyeet</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="tab"
              accessibilityState={{ selected: searchMode === 'arabic' }}
              style={[styles.segment, largeText && styles.largeSegment, searchMode === 'arabic' && styles.segmentActive]}
              onPress={() => setSearchMode('arabic')}>
              <Text style={[styles.segmentText, largeText && styles.largeControlText, searchMode === 'arabic' && styles.segmentTextActive]}>Arabic</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="tab"
              accessibilityState={{ selected: searchMode === 'english' }}
              style={[styles.segment, largeText && styles.largeSegment, searchMode === 'english' && styles.segmentActive]}
              onPress={() => setSearchMode('english')}>
              <Text style={[styles.segmentText, largeText && styles.largeControlText, searchMode === 'english' && styles.segmentTextActive]}>English</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.displayControls}>
          <TouchableOpacity
            style={styles.displayButton}
            accessibilityRole="button"
            accessibilityLabel={arabicScript ? 'Switch to Latin script' : 'Switch to Arabic script'}
            accessibilityHint="Changes how Bidhaawyeet results are displayed."
            onPress={() => setArabicScript(value => !value)}>
            <Text style={[styles.displayButtonText, largeText && styles.largeControlText]}>
              {arabicScript ? 'Latin script' : 'حروف العربي'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.displayButton, styles.textSizeButton, largeText && styles.displayButtonActive]}
            accessibilityRole="button"
            accessibilityLabel="Large text"
            accessibilityHint="Toggles larger text and copy icons."
            accessibilityState={{ selected: largeText }}
            onPress={() => setLargeText(value => !value)}>
            <Text style={[styles.textSizeLarge, largeText && styles.displayButtonTextActive]}>
              A<Text style={styles.textSizeSmall}>a</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.resultsContainer} contentContainerStyle={{ paddingBottom: 24 }}>
        {search.trim().length > 0 && limitedResults.length === 0 ? (
          <Text style={[styles.emptyText, largeText && styles.largeResultText, arabicScript ? styles.alignRight : styles.alignLeft]}>No results found.</Text>
        ) : null}

        {limitedResults.map((r, i) => {
          const bejaWord = getDisplayedBejaText(r);
          return (
            <View
              key={`${r.kind}-${getBejaText(r)}-${getSourcePage(r) ?? i}-${i}`}
              style={[styles.resultItem, arabicScript && styles.resultItemRight]}
            >
              <TouchableOpacity
                style={{ flex: 1 }}
                onPress={() => {
                  const page = r.kind === 'vanhove' ? r.entry.source.pdf_page : getSourcePage(r);
                  if (typeof page === 'number') {
                    const offset = getPdfOffset(r);
                    const doc = getPdfDoc(r);
                    const term = searchMode === 'beja' ? getBejaText(r) : search.trim();
                    const headword = getDisplayedBejaText(r) || getPrimaryText(r);
                    router.push({
                      pathname: '/pdf',
                      params: { doc, page: String(page), offset: String(offset), term, headword },
                    });
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={`View PDF for ${bejaWord}`}
              >
                <Text style={[styles.resultHeadword, largeText && styles.largeHeadword, arabicScript ? styles.alignRight : styles.alignLeft]}>{getPrimaryText(r)}</Text>
                <Text style={[styles.resultGloss, largeText && styles.largeResultText, arabicScript ? styles.alignRight : styles.alignLeft]}>
                  {getSecondaryText(r)}
                  {searchMode !== 'arabic' && getArabicText(r) ? ` — ${getArabicText(r)}` : ''}
                </Text>
                {r.kind === 'vanhove' ? (
                  <Text style={[styles.resultMeta, largeText && styles.largeMeta, arabicScript ? styles.alignRight : styles.alignLeft]}>Vanhove &amp; Hamid Ahmed 2026, p. {r.entry.source.page}</Text>
                ) : null}
              </TouchableOpacity>
              <CopyButton
                size={largeText ? 30 : 22}
                onPress={() => {
                  const raw = getRawText(r);
                  if (raw) Clipboard.setStringAsync(raw);
                }}
                style={arabicScript ? styles.copyButtonRight : styles.copyButtonLeft}
              />
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 18,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  largeSearchInput: {
    fontSize: 37,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  displayControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 8,
  },
  displayButton: {
    minHeight: 44,
    minWidth: 44,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  displayButtonActive: {
    backgroundColor: '#111827',
  },
  displayButtonText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  displayButtonTextActive: {
    color: '#fff',
  },
  textSizeButton: {
    paddingVertical: 0,
  },
  textSizeLarge: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '600',
  },
  textSizeSmall: {
    fontSize: 16,
    fontWeight: '600',
  },
  largeControlText: {
    fontSize: 28,
  },
  segmented: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    overflow: 'hidden',
    maxWidth: '100%',
  },
  segment: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  largeSegment: {
    paddingHorizontal: 8,
    flexShrink: 1,
  },
  segmentActive: {
    backgroundColor: '#111827',
  },
  segmentText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#fff',
  },
  resultsContainer: {
    flex: 1,
  },
  emptyText: {
    marginTop: 16,
    marginHorizontal: 12,
    fontSize: 18,
    color: '#666',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fff',
  },
  resultItemRight: {
    flexDirection: 'row-reverse',
  },
  alignLeft: {
    textAlign: 'left',
  },
  alignRight: {
    textAlign: 'right',
  },
  copyButtonLeft: {
    marginLeft: 8,
  },
  copyButtonRight: {
    marginLeft: 0,
    marginRight: 8,
  },
  resultHeadword: {
    fontWeight: 'bold',
    fontSize: 20,
  },
  resultGloss: {
    color: '#333',
    fontSize: 18,
    marginTop: 2,
  },
  resultMeta: {
    color: '#888',
    fontSize: 14,
    marginTop: 2,
  },
  largeHeadword: {
    fontSize: 40,
  },
  largeResultText: {
    fontSize: 37,
  },
  largeMeta: {
    fontSize: 31,
  },
});
