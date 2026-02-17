import React from 'react';
import { Text, View } from 'react-native';

import type { PdfViewerProps } from './pdf-viewer.types';

type PdfModule = {
  default?: React.ComponentType<any>;
};

export default function PdfViewerNative({ uri, page, style, onError }: PdfViewerProps) {
  const [PdfComponent, setPdfComponent] = React.useState<React.ComponentType<any> | null>(null);
  const pdfRef = React.useRef<any>(null);

  React.useEffect(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('react-native-pdf') as PdfModule;
      const Comp = (mod.default ?? (mod as any)) as React.ComponentType<any>;
      setPdfComponent(() => Comp);
    } catch (e) {
      onError?.(e);
      setPdfComponent(null);
    }
  }, [onError]);

  if (!PdfComponent) {
    return (
      <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }, style]}>
        <Text style={{ fontSize: 13, opacity: 0.8, textAlign: 'center' }}>
          Native PDF viewer is not available in this build.
        </Text>
      </View>
    );
  }

  return (
    <PdfComponent
      ref={(ref: any) => {
        pdfRef.current = ref;
      }}
      source={{ uri, cache: true }}
      page={page}
      style={style}
      enablePaging={false}
      trustAllCerts={false}
      onLoadComplete={() => {
        try {
          pdfRef.current?.setPage?.(page);
        } catch {
          // ignore
        }
      }}
      onError={(e: unknown) => {
        onError?.(e);
      }}
    />
  );
}
