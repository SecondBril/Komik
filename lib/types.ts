export type ComicType = 'manga' | 'manhwa' | 'manhua';
export type ComicStatus = 'ongoing' | 'completed';
export type ChapterStatus = 'pending' | 'processing' | 'published' | 'failed';

export interface Genre {
  id: number;
  name: string;
  slug: string;
}

export interface Source {
  id: string;
  name: string;
  base_url: string;
  scraping_config: Record<string, any>;
  is_active: boolean;
  created_at: string;
}

export interface Comic {
  id: string;
  slug: string;
  title: string;
  alt_titles: string[];
  type: ComicType;
  synopsis: string;
  cover_url: string;
  author: string;
  status: ComicStatus;
  rating: number;
  source_id?: string;
  created_at: string;
  updated_at: string;
  genres?: Genre[];
  latest_chapter?: {
    id: string;
    chapter_number: number;
    title?: string;
    released_at: string;
  };
}

export interface Chapter {
  id: string;
  comic_id: string;
  chapter_number: number;
  title?: string;
  status: ChapterStatus;
  retry_count: number;
  released_at: string;
  created_at: string;
  comic?: Comic;
}

export interface ChapterPage {
  id: string;
  chapter_id: string;
  page_number: number;
  image_url: string;
  width?: number;
  height?: number;
}

export interface ReadingHistoryItem {
  id: string;
  user_id?: string;
  comic_id: string;
  chapter_id: string;
  scroll_position: number;
  last_read_at: string;
  comic: Comic;
  chapter: Chapter;
  has_new_chapter?: boolean;
}

export interface IngestLog {
  id: string;
  source_id?: string;
  chapter_id?: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  created_at: string;
  sources?: Source;
  chapters?: Chapter;
}

export interface FilterState {
  type?: ComicType | 'all';
  status?: ComicStatus | 'all';
  genres: number[];
  query?: string;
  sort?: 'latest' | 'popular' | 'rating' | 'title';
}
