export interface ChatMessage {
  role: 'user' | 'bot' | 'loading' | 'error';
  content: string;
  citations?: Citation[];
}

export interface Citation {
  source: string;
  preview: string;
}

export interface IngestResponse {
  status: string;
  num_chunks?: number;
  error?: string;
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
  error?: string;
}
