import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Fuse from 'fuse.js';
import React from 'react';
import { DictionaryEntry, getDictionary } from '../../data/dictionary';
import { EnglishBejaEntry, getEnglishBeja } from '../../data/english_beja';

import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [isBeja, setIsBeja] = React.useState(true);

  type SearchResult =
    | { kind: 'beja_en'; entry: DictionaryEntry }
    | { kind: 'en_beja'; entry: EnglishBejaEntry };

  const [results, setResults] = React.useState<SearchResult[]>([]);
  const dictionary = React.useMemo(() => getDictionary(), []);
  const englishBeja = React.useMemo(() => getEnglishBeja(), []);
  const limitedResults = React.useMemo(() => results.slice(0, 30), [results]);

  const normalizeForSearch = React.useCallback((input: string) => {
    return (input || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }, []);

  const fuse = React.useMemo(() => {
    type IndexedResult = SearchResult & { bejaSearch: string };

    const collection: IndexedResult[] = [
      ...dictionary.map((entry) => {
        const bejaRaw = [entry.headword, ...(entry.headword_parts ?? [])].join(' ');
        return { kind: 'beja_en' as const, entry, bejaSearch: normalizeForSearch(bejaRaw) };
      }),
      ...englishBeja.map((entry) => {
        const bejaRaw = (entry.beja ?? []).join(' ');
        return { kind: 'en_beja' as const, entry, bejaSearch: normalizeForSearch(bejaRaw) };
      }),
    ];

    return new Fuse(collection, {
      includeScore: true,
      ignoreLocation: true,
      threshold: 0.4,
      minMatchCharLength: 2,
      keys: [{ name: 'bejaSearch', weight: 1 }],
    });
  }, [dictionary, englishBeja, normalizeForSearch]);

  React.useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    if (!isBeja) {
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

      const scoreEnglishResult = (r: SearchResult) => {
        const englishCandidates: string[] =
          r.kind === 'beja_en'
            ? (r.entry.gloss_en ?? [])
            : [r.entry.english ?? ''];

        const normalized = englishCandidates
          .map(t => (t || '').toLowerCase().trim())
          .filter(Boolean);

        const exact = normalized.some(t => t === s);
        const starts = normalized.some(t => t.startsWith(s));
        const includes = normalized.some(t => t.includes(s));
        const rawIncludes = (r.entry.raw ?? []).some(line => line.toLowerCase().includes(s));

        // Lower is better
        const rank = exact ? 0 : starts ? 1 : includes ? 2 : rawIncludes ? 3 : 4;
        const bestLen = normalized.length > 0 ? Math.min(...normalized.map(t => t.length)) : 9999;

        return { rank, bestLen };
      };

      const merged = [ ...bejaEnMatches, ...enBejaMatches]
        .map(r => ({ r, ...scoreEnglishResult(r) }))
        .sort((a, b) => {
          if (a.rank !== b.rank) return a.rank - b.rank;
          if (a.bestLen !== b.bestLen) return a.bestLen - b.bestLen;
          const aPrimary = (a.r.kind === 'beja_en' ? a.r.entry.headword : a.r.entry.english) ?? '';
          const bPrimary = (b.r.kind === 'beja_en' ? b.r.entry.headword : b.r.entry.english) ?? '';
          return aPrimary.localeCompare(bPrimary);
        })
        .map(x => x.r);

      setResults(merged);
    } else {
      // Fuzzy Beja search: match headword and headword_parts
      const q = normalizeForSearch(search);
      const matches = fuse.search(q, { limit: 80 });
      const sorted: SearchResult[] = matches
        .slice()
        .sort((a, b) => {
          const aStarts = (a.item as any).bejaSearch?.startsWith(q);
          const bStarts = (b.item as any).bejaSearch?.startsWith(q);
          if (aStarts !== bStarts) return aStarts ? -1 : 1;
          return (a.score ?? 1) - (b.score ?? 1);
        })
        .slice(0, 60)
        .map(m => (m.item as unknown as SearchResult));

      setResults(sorted);
    }
  }, [search, isBeja, dictionary, englishBeja, fuse]);

  const getBejaText = (r: SearchResult) => {
    if (r.kind === 'beja_en') return r.entry.headword ?? '';
    return (r.entry.beja && r.entry.beja.length > 0 ? r.entry.beja.join('; ') : '') || '';
  };

  const getEnglishText = (r: SearchResult) => {
    if (r.kind === 'beja_en') return r.entry.gloss_en?.join('; ') ?? '';
    return r.entry.english ?? '';
  };

  const getArabicText = (r: SearchResult) => {
    const ar = r.entry.gloss_ar;
    return ar && ar.length > 0 ? ar.join('; ') : '';
  };

  const getSourcePage = (r: SearchResult) => r.entry.source?.page;
  const getPdfOffset = (r: SearchResult) => (r.kind === 'en_beja' ? 198 : 16);

  const getPrimaryText = (r: SearchResult) => (isBeja ? getBejaText(r) : getEnglishText(r));
  const getSecondaryText = (r: SearchResult) => (isBeja ? getEnglishText(r) : getBejaText(r));

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={isBeja ? 'Search Beja…' : 'Search English…'}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.toggleRow}>
          <View style={styles.segmented} accessibilityRole="tablist">
            <TouchableOpacity
              accessibilityRole="tab"
              accessibilityState={{ selected: isBeja }}
              style={[styles.segment, isBeja && styles.segmentActive]}
              onPress={() => setIsBeja(true)}>
              <Text style={[styles.segmentText, isBeja && styles.segmentTextActive]}>Beja</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="tab"
              accessibilityState={{ selected: !isBeja }}
              style={[styles.segment, !isBeja && styles.segmentActive]}
              onPress={() => setIsBeja(false)}>
              <Text style={[styles.segmentText, !isBeja && styles.segmentTextActive]}>English</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView style={styles.resultsContainer} contentContainerStyle={{ paddingBottom: 24 }}>
        {search.trim().length > 0 && limitedResults.length === 0 ? (
          <Text style={styles.emptyText}>No results found.</Text>
        ) : null}

        {limitedResults.map((r, i) => (
          <TouchableOpacity
            key={`${r.kind}-${getPrimaryText(r)}-${getSourcePage(r) ?? i}-${i}`}
            style={styles.resultItem}
            onPress={() => {
              const page = getSourcePage(r);
              if (typeof page === 'number') {
                const offset = getPdfOffset(r);
                const term = isBeja ? getBejaText(r) : search.trim();
                router.push({ pathname: '/pdf', params: { page: String(page), offset: String(offset), term } });
              }
            }}>
            <Text style={styles.resultHeadword}>{getPrimaryText(r)}</Text>
            <Text style={styles.resultGloss}>
              {getSecondaryText(r)}
              {getArabicText(r) ? ` — ${getArabicText(r)}` : ''}
            </Text>
          </TouchableOpacity>
        ))}
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
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    overflow: 'hidden',
  },
  segment: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
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
    textAlign: 'center',
    marginTop: 16,
    color: '#666',
  },
  resultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fff',
  },
  resultHeadword: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  resultGloss: {
    color: '#333',
    marginTop: 2,
  },
  resultMeta: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
});
