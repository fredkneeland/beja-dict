import { Image } from 'expo-image';
import { StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

import Fuse from 'fuse.js';
import React from 'react';
import { DictionaryEntry, getDictionary } from '../../data/dictionary';

import ParallaxScrollView from '@/components/parallax-scroll-view';
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
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
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
          <Text style={{marginRight: 8}}>Beja</Text>
          <Switch
            value={isBeja}
            onValueChange={setIsBeja}
          />
          <Text style={{marginLeft: 8}}>English</Text>
        </View>
      </View>
      {/* Results list (avoid FlatList inside ScrollView) */}
      <View style={{ marginTop: 8 }}>
        {search.trim().length > 0 && limitedResults.length === 0 ? (
          <Text style={{ textAlign: 'center', margin: 16 }}>No results found.</Text>
        ) : null}

        {limitedResults.map((item, i) => (
          <TouchableOpacity
            key={`${item.headword}-${item.source?.page ?? i}-${i}`}
            style={styles.resultItem}
            onPress={() => {
              const page = item.source?.page;
              if (typeof page === 'number') {
                router.push({ pathname: '/pdf', params: { page: String(page) } });
              }
            }}>
            <Text style={styles.resultHeadword}>{item.headword}</Text>
            <Text style={styles.resultGloss}>{item.gloss_en?.join('; ')}</Text>
            <Text style={styles.resultMeta}>Page: {item.source?.page}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ParallaxScrollView>
  );
}
const styles = StyleSheet.create({
  searchContainer: {
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    margin: 16,
    marginBottom: 0,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
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
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  resultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fafafa',
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
