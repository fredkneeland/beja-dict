import { Asset } from 'expo-asset';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import WebView from 'react-native-webview';

const PAGE_OFFSET = 16;

export default function PdfScreen() {
  const params = useLocalSearchParams<{ page?: string }>();
  const basePage = Number(params.page ?? '1');
  const targetPage = Number.isFinite(basePage) ? Math.max(1, basePage + PAGE_OFFSET) : 1;

  const [pdfUri, setPdfUri] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const asset = Asset.fromModule(require('../data/dictionary.pdf'));
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
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Failed to load PDF</Text>
        <Text style={styles.errorBody}>{error}</Text>
      </View>
    );
  }

  if (!pdfUri) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 12 }}>Loading dictionary…</Text>
      </View>
    );
  }

  const uriWithPage = `${pdfUri}#page=${targetPage}`;

  // Web: render via iframe for best PDF UX (built-in browser PDF viewer)
  if (Platform.OS === 'web') {
    return (
      <View style={styles.flex}>
        <iframe src={uriWithPage} style={styles.iframe} title="Dictionary PDF" />
      </View>
    );
  }

  // Native: use WebView to render the PDF. Most platform PDF renderers honor #page.
  return (
    <View style={styles.flex}>
      <WebView
        source={{ uri: uriWithPage }}
        style={styles.flex}
        originWhitelist={['*']}
        allowFileAccess
        allowingReadAccessToURL={pdfUri}
      />
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
