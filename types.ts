
// FIX: Removed self-import which was causing declaration conflicts.

export interface GroundingChunk {
  // FIX: Made the 'web' property optional to match the library type.
  web?: {
    // FIX: Made uri and title optional to match the @google/genai library type.
    uri?: string;
    title?: string;
  };
}

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface SeoKeywordSuggestion {
  keyword: string;
  type: 'primary' | 'secondary' | 'long-tail' | 'intent';
  searchIntent?: string;
  relevance?: string;
}

export interface GenerationResult {
    productName?: string;
    descriptionText: string;
    descriptionHtml: string;
    sources: GroundingSource[];
    seoKeywords?: SeoKeywordSuggestion[];
    searchQueries?: string[];
    metaDescription?: string;
}

export interface SingleGenerationResult {
  productName: string;
  descriptionText: string;
  descriptionHtml: string;
  sources: GroundingSource[];
  status: 'success' | 'error';
  error?: string;
  seoKeywords?: SeoKeywordSuggestion[];
  searchQueries?: string[];
  metaDescription?: string;
}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  productNames: string[];
  results: SingleGenerationResult[];
  userEmail?: string;
}

export interface CustomTemplate {
  id: string;
  name: string;
  content: string;
}

export interface ChatMessage {
  type: 'user' | 'bot' | 'system';
  text: string;
  sources?: GroundingSource[];
  searchQueries?: string[];
}

export interface AppGalleryItem {
  id: string;
  title: string;
  category: 'seo' | 'content' | 'media' | 'data' | 'ecommerce';
  badge: string;
  description: string;
  features: string[];
  targetTab: string;
  promptExample?: string;
  presetQuery?: string;
}

export interface ImageState {
  id: string;
  file: File;
  url: string;
  dimensions: { width: number; height: number };
  history: string[]; // Array of previous data URLs
  isSelected?: boolean;
}

export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CustomSizePreset {
  id: string;
  name: string;
  width: number;
  height: number;
  lockType?: 'unlocked' | 'width-fixed' | 'height-fixed' | 'fixed-width';
}

export type ActiveTool = 
  | 'crop-rotate' 
  | 'adjustments' 
  | 'ai-magic' 
  | 'remove-bg'
  | 'color'
  | 'draw'
  | 'text'
  | 'frame'
  | 'watermark'
  | 'upscale';

export interface AttributeDefinition {
    name: string;
    type: 'free' | 'fixed'; // 'free' is for text, 'fixed' is for selection
    values?: string; // Comma-separated values for 'fixed' type
}

export interface AttributeSet {
  id: string;
  name: string;
  attributes: AttributeDefinition[];
  timeout: number;
}

export type ExtractedResult = Record<string, string>;

export interface ExtractionResultRow {
  status: 'success' | 'error' | 'loading';
  input: string;
  modelUsed: string;
  data: ExtractedResult;
  error?: string;
}

export interface StandardizedNameResult {
  original: string;
  standardized: string;
  category?: string;
  status: 'loading' | 'success' | 'error';
  error?: string;
}

export interface SeoNameResult {
  original: string;
  seoName: string;
  status: 'loading' | 'success' | 'error';
  error?: string;
}

export type ActiveTabId = 'description' | 'image' | 'chatbot' | 'converter' | 'guide' | 'extractor' | 'scraper' | 'standardizer' | 'bulk-download' | 'video-editor' | 'download-app';
