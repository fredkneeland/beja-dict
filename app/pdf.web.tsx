import { Asset } from 'expo-asset';
import { Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function PdfScreenWeb() {
  const params = useLocalSearchParams<{ doc?: string; page?: string; offset?: string; term?: string; headword?: string }>();
  const doc = typeof params.doc === 'string' && params.doc === 'dict2' ? 'dict2' : 'dictionary';
  const basePage = Number(params.page ?? '1');
  const offset = Number(params.offset ?? '16');
  const safeOffset = Number.isFinite(offset) ? offset : 16;
  const targetPage = Number.isFinite(basePage) ? Math.max(1, basePage + safeOffset) : 1;
  const term = typeof params.term === 'string' ? params.term.trim() : '';
  const headword = typeof params.headword === 'string' ? params.headword.trim() : '';

  const title = headword || term || (doc === 'dict2' ? 'Dict 2' : 'Dictionary');

  const [pdfUri, setPdfUri] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const asset = Asset.fromModule(doc === 'dict2' ? require('../data/dict2.pdf') : require('../data/dictionary.pdf'));
        // On web this typically resolves immediately, but downloadAsync is safe.
        await asset.downloadAsync();
        const uri = asset.localUri ?? asset.uri;
        if (!cancelled) setPdfUri(uri);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc]);

  if (error) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title }} />
        <Text style={styles.errorTitle}>Failed to load PDF</Text>
        <Text style={styles.errorBody}>{error}</Text>
      </View>
    );
  }

  if (!pdfUri) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title }} />
        <ActivityIndicator />
        <Text style={{ marginTop: 12 }}>Loading {doc}…</Text>
      </View>
    );
  }

  const fragmentParts = [`page=${targetPage}`];
  if (term) fragmentParts.push(`search=${encodeURIComponent(term)}`);
  const uriWithPage = `${pdfUri}#${fragmentParts.join('&')}`;

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title }} />
      <iframe src={uriWithPage} style={styles.iframe as any} title={title} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  iframe: { borderWidth: 0, width: '100%', height: '100%' },
  errorTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  errorBody: { fontSize: 12, opacity: 0.8 },
});
