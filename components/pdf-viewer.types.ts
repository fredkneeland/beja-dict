export type PdfViewerProps = {
  uri: string;
  page: number;
  style?: any;
  onError?: (e: unknown) => void;
};
