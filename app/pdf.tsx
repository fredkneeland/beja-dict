import { Asset } from 'expo-asset';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import PdfViewer from '../components/pdf-viewer';

export default function PdfScreen() {
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
  const [openError, setOpenError] = React.useState<string | null>(null);

  const isExpoGo = Constants.appOwnership === 'expo';

  // Set the navigation bar title dynamically based on what the user clicked.
  // This overrides the static title set in app/_layout.tsx.
  React.useEffect(() => {
    // `Stack.Screen` below also sets this, but this keeps it in sync if params change.
  }, [title]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const asset = Asset.fromModule(
          doc === 'dict2' ? require('../data/dict2.pdf') : require('../data/dictionary.pdf')
        );
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

  const ensureLocalFileUri = React.useCallback(
    async (uri: string) => {
      if (uri.startsWith('file://')) return uri;

      const dest = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? ''}${doc}.pdf`;
      if (!dest) return uri;

      const info = await FileSystem.getInfoAsync(dest);
      if (info.exists) return dest;

      // If we ended up with a remote URI (can happen in dev), download to cache.
      const result = await FileSystem.downloadAsync(uri, dest);
      return result.uri;
    },
    [doc]
  );

  const openOnAndroid = React.useCallback(async () => {
    if (!pdfUri) return;
    try {
      setOpenError(null);
      const localUri = await ensureLocalFileUri(pdfUri);
      // Many Android apps require a content:// URI rather than file://
      const contentUri = await FileSystem.getContentUriAsync(localUri);

      // First try: open in a Chrome Custom Tab (smoother UX; often respects #page)
      // If this fails (no browser), fall back to an external viewer intent.
      try {
        const browserUri = `${contentUri}#page=${targetPage}`;
        await WebBrowser.openBrowserAsync(browserUri, { showTitle: true, enableBarCollapsing: true });
        return;
      } catch {
        // ignore and fall back
      }

      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: 'application/pdf',
      });
    } catch (e: any) {
      setOpenError(e?.message ?? String(e));
    }
  }, [ensureLocalFileUri, pdfUri, targetPage]);

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

  // Web: render via iframe for best PDF UX (built-in browser PDF viewer)
  if (Platform.OS === 'web') {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ title }} />
        <iframe src={uriWithPage} style={styles.iframe} title="Dictionary PDF" />
      </View>
    );
  }

  // Expo Go can't load custom native modules like react-native-pdf.
  if (isExpoGo) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title }} />
        <Text style={styles.title}>PDF Viewer</Text>
        <Text style={styles.body}>Target page: {targetPage}</Text>
        <Text style={styles.body}>
          In Expo Go, in-app PDF viewing is not available. Build a dev client to enable the native PDF viewer.
        </Text>

        {Platform.OS === 'android' ? (
          <Pressable style={styles.button} onPress={openOnAndroid}>
            <Text style={styles.buttonText}>Open externally</Text>
          </Pressable>
        ) : null}
        {openError ? <Text style={styles.openError}>{openError}</Text> : null}
      </View>
    );
  }

  // Native: render PDF in-app (smoother + more reliable page setting than external viewers).
  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title }} />
      <PdfViewer
        uri={pdfUri}
        page={targetPage}
        style={styles.flex}
        onError={(e: unknown) => {
          setError(String(e));
        }}
      />

      {Platform.OS === 'android' ? (
        <View style={styles.androidOverlay} pointerEvents="box-none">
          <Pressable style={styles.androidButton} onPress={openOnAndroid}>
            <Text style={styles.androidButtonText}>Open externally</Text>
          </Pressable>
          {openError ? <Text style={styles.openError}>{openError}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  iframe: { borderWidth: 0, width: '100%', height: '100%' },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  body: { fontSize: 13, opacity: 0.85, textAlign: 'center', marginBottom: 8 },
  button: { marginTop: 8, backgroundColor: '#111827', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  buttonText: { color: '#fff', fontWeight: '600' },
  openError: { marginTop: 12, fontSize: 12, opacity: 0.8, textAlign: 'center' },
  androidOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    alignItems: 'center',
  },
  androidButton: {
    backgroundColor: '#111827',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  androidButtonText: { color: '#fff', fontWeight: '600' },
  errorTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  errorBody: { fontSize: 12, opacity: 0.8 },
});
