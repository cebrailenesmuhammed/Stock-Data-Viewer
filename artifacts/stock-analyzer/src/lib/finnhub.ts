const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;
const BASE = "https://finnhub.io/api/v1";

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("token", API_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Finnhub API error: ${res.status}`);
  return res.json();
}

export interface Quote {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

export interface CompanyProfile {
  country: string;
  currency: string;
  exchange: string;
  ipo: string;
  marketCapitalization: number;
  name: string;
  phone: string;
  shareOutstanding: number;
  ticker: string;
  weburl: string;
  logo: string;
  finnhubIndustry: string;
}

export interface NewsItem {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export interface NewsSentiment {
  buzz: { articlesInLastWeek: number; weeklyAverage: number; buzz: number };
  companyNewsScore: number;
  sectorAverageBullishPercent: number;
  sectorAverageNewsScore: number;
  sentiment: { bearishPercent: number; bullishPercent: number };
  symbol: string;
}

export interface CandleData {
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  s: string;
  t: number[];
  v: number[];
}

export interface Recommendation {
  buy: number;
  hold: number;
  period: string;
  sell: number;
  strongBuy: number;
  strongSell: number;
  symbol: string;
}

export interface EarningsEstimate {
  actual: number | null;
  estimate: number | null;
  period: string;
  quarter: number;
  surprise: number | null;
  surprisePercent: number | null;
  symbol: string;
  year: number;
}

export interface TechnicalIndicators {
  rsi?: number;
  macd?: number;
  signal?: number;
  ema20?: number;
  ema50?: number;
}

export async function fetchQuote(symbol: string): Promise<Quote> {
  return get<Quote>("/quote", { symbol: symbol.toUpperCase() });
}

export async function fetchProfile(symbol: string): Promise<CompanyProfile> {
  return get<CompanyProfile>("/stock/profile2", { symbol: symbol.toUpperCase() });
}

export async function fetchNews(symbol: string): Promise<NewsItem[]> {
  const today = new Date();
  const from = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return get<NewsItem[]>("/company-news", {
    symbol: symbol.toUpperCase(),
    from: fmt(from),
    to: fmt(today),
  });
}

export async function fetchSentiment(symbol: string): Promise<NewsSentiment> {
  return get<NewsSentiment>("/news-sentiment", { symbol: symbol.toUpperCase() });
}

export async function fetchCandles(symbol: string, days: number = 30): Promise<CandleData> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - days * 24 * 60 * 60;
  return get<CandleData>("/stock/candle", {
    symbol: symbol.toUpperCase(),
    resolution: "D",
    from: String(from),
    to: String(now),
  });
}

export async function fetchRecommendations(symbol: string): Promise<Recommendation[]> {
  return get<Recommendation[]>("/stock/recommendation", { symbol: symbol.toUpperCase() });
}

export async function fetchEarnings(symbol: string): Promise<EarningsEstimate[]> {
  return get<EarningsEstimate[]>("/stock/earnings", { symbol: symbol.toUpperCase() });
}

export async function fetchBasicFinancials(symbol: string): Promise<{ metric: Record<string, number> }> {
  return get<{ metric: Record<string, number> }>("/stock/metric", {
    symbol: symbol.toUpperCase(),
    metric: "all",
  });
}

export function formatMarketCap(val: number): string {
  if (!val) return "—";
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}T`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(2)}B`;
  return `$${val.toFixed(2)}M`;
}

export function formatNumber(val: number | undefined | null, decimals = 2): string {
  if (val === undefined || val === null || isNaN(val)) return "—";
  return val.toFixed(decimals);
}
