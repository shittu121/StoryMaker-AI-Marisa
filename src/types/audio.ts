export interface AudioChunk {
  id: string;
  name: string;
  text: string;
  duration: number;
  startTime: number;
  filePath: string;
  relativePath?: string;
  blobUrl?: string;
  audioBlob?: Blob;
  isGenerated?: boolean;
}

export interface IncomingAudioChunk {
  id: string;
  name?: string;
  text?: string;
  duration: number;
  startTime?: number;
  filePath?: string;
  relativePath?: string;
  blobUrl?: string;
} 