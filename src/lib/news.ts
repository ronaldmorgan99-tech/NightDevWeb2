export interface NewsItem {
  id: number;
  title: string;
  is_pinned: number;
  views: number;
  created_at: string;
  author_name: string;
  author_avatar: string | null;
  reply_count: number;
  excerpt: string | null;
}

export const fetchNews = async (limit: number): Promise<NewsItem[]> => {
  const res = await fetch(`/api/news?limit=${limit}`);
  if (!res.ok) {
    throw new Error(`Failed to load news (${res.status})`);
  }
  return res.json();
};

export const newsExcerpt = (raw: string | null, maxLength = 180): string => {
  if (!raw) return '';
  const text = raw.replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
};

export const formatNewsDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};
