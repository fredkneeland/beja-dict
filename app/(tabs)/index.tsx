import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Fuse from 'fuse.js';
import React from 'react';
import { DictionaryEntry, getDictionary } from '../../data/dictionary';

import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [isBeja, setIsBeja] = React.useState(true);
  const [results, setResults] = React.useState<DictionaryEntry[]>([]);
  const dictionary = React.useMemo(() => getDictionary(), []);
  const limitedResults = React.useMemo(() => results.slice(0, 30), [results]);
  const fuse = React.useMemo(() => {
    return new Fuse(dictionary, {
      includeScore: true,
      ignoreLocation: true,
      threshold: 0.4,
      minMatchCharLength: 2,
      keys: [
        { name: 'headword', weight: 0.7 },
        { name: 'headword_parts', weight: 0.3 },
      ],
    });
  }, [dictionary]);

  React.useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    if (!isBeja) {
      // English strict search: match in gloss_en or raw
      const s = search.trim().toLowerCase();
      setResults(
        dictionary.filter(entry =>
          (entry.gloss_en && entry.gloss_en.some(g => g.toLowerCase().includes(s))) ||
          (entry.raw && entry.raw.some(r => r.toLowerCase().includes(s)))
        )
      );
    } else {
      // Fuzzy Beja search: match headword and headword_parts
      const s = search.trim();
      const matches = fuse.search(s, { limit: 30 });
      setResults(matches.map(m => m.item));
    }
  }, [search, isBeja, dictionary, fuse]);

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

        {limitedResults.map((item, i) => (
          <TouchableOpacity
            key={`${item.headword}-${item.source?.page ?? i}-${i}`}
            style={styles.resultItem}
            onPress={() => {
              const page = item.source?.page;
              if (typeof page === 'number') {
                const term = isBeja ? item.headword : search.trim();
                router.push({ pathname: '/pdf', params: { page: String(page), term } });
              }
            }}>
            <Text style={styles.resultHeadword}>{item.headword}</Text>
            <Text style={styles.resultGloss}>{item.gloss_en?.join('; ')}</Text>
            <Text style={styles.resultMeta}>Page: {item.source?.page}</Text>
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
