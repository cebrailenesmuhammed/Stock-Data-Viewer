import { useState, useRef, useCallback } from "react";
import {
  fetchQuote,
  fetchProfile,
  fetchNews,
  fetchSentiment,
  fetchCandles,
  fetchRecommendations,
  fetchEarnings,
  fetchBasicFinancials,
  formatMarketCap,
  formatNumber,
  type Quote,
  type CompanyProfile,
  type NewsItem,
  type NewsSentiment,
  type CandleData,
  type Recommendation,
  type EarningsEstimate,
} from "@/lib/finnhub";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

type LoadStep = "idle" | "profile" | "quote" | "candles" | "metrics" | "news" | "done" | "error";

interface StockData {
  quote: Quote;
  profile: CompanyProfile;
  news: NewsItem[];
  sentiment: NewsSentiment | null;
  candles: CandleData | null;
  recommendations: Recommendation[];
  earnings: EarningsEstimate[];
  metrics: Record<string, number>;
}

const POPULAR_STOCKS = [
  { symbol: "AAPL", name: "Apple" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "GOOGL", name: "Google" },
  { symbol: "MSFT", name: "Microsoft" },
];

const LOAD_STEPS: Record<LoadStep, number> = {
  idle: 0,
  profile: 15,
  quote: 35,
  candles: 55,
  metrics: 70,
  news: 85,
  done: 100,
  error: 0,
};

function LoadingProgress({ step }: { step: LoadStep }) {
  const labels: Record<LoadStep, string> = {
    idle: "",
    profile: "Sirket profili yukleniyor...",
    quote: "Fiyat verileri aliniyor...",
    candles: "Grafik verileri hazirlaniyor...",
    metrics: "Finansal metrikler hesaplaniyor...",
    news: "Haberler ve sentiment analizi...",
    done: "Analiz tamamlandi",
    error: "Hata olustu",
  };
  const progress = LOAD_STEPS[step];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 14, color: "hsl(215 20% 55%)" }}>{labels[step]}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: "hsl(217 91% 60%)" }}>{progress}%</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: "hsl(222 30% 14%)", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "linear-gradient(90deg, hsl(217 91% 60%), hsl(217 91% 70%))",
            borderRadius: 2,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
  delay = 0,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: "green" | "red" | "blue" | "default";
  delay?: number;
}) {
  const colorMap = {
    green: "#10B981",
    red: "#EF4444",
    blue: "hsl(217 91% 60%)",
    default: "hsl(210 40% 95%)",
  };
  const c = colorMap[color ?? "default"];
  return (
    <div
      className={`fade-up-${delay}`}
      style={{
        background: "hsl(222 40% 8%)",
        border: "1px solid hsl(222 30% 14%)",
        borderRadius: 16,
        padding: "20px 24px",
        transition: "border-color 0.2s, transform 0.2s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "hsl(222 30% 22%)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "hsl(222 30% 14%)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
      }}
    >
      <div style={{ fontSize: 12, color: "hsl(215 20% 55%)", marginBottom: 6, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: c, lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "hsl(215 20% 55%)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Badge({ children, variant }: { children: React.ReactNode; variant: "green" | "red" | "amber" | "blue" | "gray" }) {
  const styles: Record<string, React.CSSProperties> = {
    green: { background: "rgba(16,185,129,0.12)", color: "#10B981", border: "1px solid rgba(16,185,129,0.25)" },
    red: { background: "rgba(239,68,68,0.12)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.25)" },
    amber: { background: "rgba(245,158,11,0.12)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.25)" },
    blue: { background: "rgba(59,130,246,0.12)", color: "hsl(217 91% 60%)", border: "1px solid rgba(59,130,246,0.25)" },
    gray: { background: "rgba(100,116,139,0.12)", color: "hsl(215 20% 55%)", border: "1px solid rgba(100,116,139,0.25)" },
  };
  return (
    <span
      style={{
        ...styles[variant],
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 8,
        padding: "4px 12px",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

const TICKER_DATA = [
  { s: "AAPL", p: 195.4, c: 1.2 },
  { s: "AMZN", p: 182.3, c: 0.8 },
  { s: "TSLA", p: 248.5, c: -1.4 },
  { s: "NVDA", p: 875.4, c: 2.1 },
  { s: "GOOGL", p: 171.2, c: 0.5 },
  { s: "MSFT", p: 412.8, c: 0.3 },
  { s: "META", p: 505.6, c: -0.6 },
  { s: "BRK.B", p: 404.2, c: 0.1 },
  { s: "JNJ", p: 152.3, c: -0.3 },
  { s: "V", p: 274.5, c: 0.7 },
];

function TickerBar() {
  const doubled = [...TICKER_DATA, ...TICKER_DATA];
  return (
    <div style={{ background: "hsl(222 40% 8%)", borderBottom: "1px solid hsl(222 30% 14%)", padding: "10px 0" }}>
      <div className="ticker-wrap">
        <div className="ticker-track">
          {doubled.map((t, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "0 28px", fontSize: 13, whiteSpace: "nowrap" }}>
              <span style={{ fontWeight: 600, color: "hsl(210 40% 95%)" }}>{t.s}</span>
              <span style={{ color: "hsl(215 20% 55%)" }}>${t.p.toFixed(2)}</span>
              <span style={{ color: t.c >= 0 ? "#10B981" : "#EF4444", fontWeight: 600 }}>
                {t.c >= 0 ? "+" : ""}{t.c.toFixed(1)}%
              </span>
              <span style={{ width: 1, height: 12, background: "hsl(222 30% 20%)", display: "inline-block" }} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div style={{ background: "hsl(222 40% 10%)", border: "1px solid hsl(222 30% 22%)", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
      <div style={{ color: "hsl(215 20% 55%)", marginBottom: 4 }}>{label}</div>
      <div style={{ color: "hsl(210 40% 95%)", fontWeight: 600 }}>${val?.toFixed(2)}</div>
    </div>
  );
}

function PriceChart({ candles }: { candles: CandleData }) {
  if (!candles.c || candles.s !== "ok") return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "hsl(215 20% 55%)", fontSize: 14 }}>
      Grafik verisi mevcut degil
    </div>
  );

  const data = candles.t.map((ts, i) => ({
    date: new Date(ts * 1000).toLocaleDateString("tr-TR", { month: "short", day: "numeric" }),
    price: candles.c[i],
  }));

  const prices = data.map((d) => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const isUp = prices[prices.length - 1] >= prices[0];
  const color = isUp ? "#10B981" : "#EF4444";
  const colorStop = isUp ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)";

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "hsl(215 20% 45%)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[minPrice * 0.995, maxPrice * 1.005]}
          tick={{ fill: "hsl(215 20% 45%)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${v.toFixed(0)}`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="price"
          stroke={color}
          strokeWidth={2}
          fill="url(#priceGrad)"
          dot={false}
          activeDot={{ r: 4, fill: color, stroke: "none" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function RecommendationChart({ data }: { data: Recommendation[] }) {
  if (!data.length) return null;
  const latest = data[0];
  const total = latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell;
  const bullish = ((latest.strongBuy + latest.buy) / total) * 100;

  const bars = [
    { label: "Guclu Al", value: latest.strongBuy, color: "#10B981" },
    { label: "Al", value: latest.buy, color: "#34D399" },
    { label: "Bekle", value: latest.hold, color: "#F59E0B" },
    { label: "Sat", value: latest.sell, color: "#F87171" },
    { label: "Guclu Sat", value: latest.strongSell, color: "#EF4444" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, color: "hsl(215 20% 55%)" }}>Analist Onerisi — {total} analist</span>
        <Badge variant={bullish >= 60 ? "green" : bullish >= 40 ? "amber" : "red"}>
          {bullish.toFixed(0)}% Yuksalis
        </Badge>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {bars.map((b) => (
          <div key={b.label} style={{ flex: b.value, minWidth: 0 }}>
            <div style={{ height: 8, background: b.color, borderRadius: 4 }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {bars.map((b) => (
          <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: b.color }} />
            <span style={{ fontSize: 12, color: "hsl(215 20% 55%)" }}>{b.label}: <strong style={{ color: "hsl(210 40% 95%)" }}>{b.value}</strong></span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StockAnalyzer() {
  const [input, setInput] = useState("");
  const [loadStep, setLoadStep] = useState<LoadStep>("idle");
  const [data, setData] = useState<StockData | null>(null);
  const [currentSymbol, setCurrentSymbol] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const analyze = useCallback(async (sym: string) => {
    const symbol = sym.toUpperCase().trim();
    if (!symbol) return;
    setData(null);
    setErrorMsg("");
    setCurrentSymbol(symbol);
    setInput(symbol);

    try {
      setLoadStep("profile");
      const [profile, quote] = await Promise.all([fetchProfile(symbol), fetchQuote(symbol)]);

      if (!profile.name || quote.c === 0) {
        throw new Error(`"${symbol}" hissesi bulunamadi. Lutfen gecerli bir sembol girin.`);
      }

      setLoadStep("quote");
      await new Promise((r) => setTimeout(r, 300));

      setLoadStep("candles");
      const candles = await fetchCandles(symbol, 90).catch(() => null);

      setLoadStep("metrics");
      const [recommendations, earnings, financials] = await Promise.all([
        fetchRecommendations(symbol).catch(() => []),
        fetchEarnings(symbol).catch(() => []),
        fetchBasicFinancials(symbol).catch(() => ({ metric: {} })),
      ]);

      setLoadStep("news");
      const [news, sentiment] = await Promise.all([
        fetchNews(symbol).catch(() => []),
        fetchSentiment(symbol).catch(() => null),
      ]);

      setData({
        quote,
        profile,
        news: news.slice(0, 8),
        sentiment,
        candles,
        recommendations,
        earnings: earnings.slice(0, 4),
        metrics: financials.metric || {},
      });
      setLoadStep("done");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen bir hata olustu.";
      setErrorMsg(msg);
      setLoadStep("error");
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    analyze(input);
  };

  const isLoading = loadStep !== "idle" && loadStep !== "done" && loadStep !== "error";

  const priceChange = data ? data.quote.d : 0;
  const priceChangePct = data ? data.quote.dp : 0;
  const isUp = priceChange >= 0;

  const candlePercent = data?.candles?.c
    ? ((data.candles.c[data.candles.c.length - 1] - data.candles.c[0]) / data.candles.c[0]) * 100
    : null;

  const bullishPct = data?.sentiment
    ? data.sentiment.sentiment.bullishPercent * 100
    : null;

  return (
    <div style={{ minHeight: "100vh", background: "hsl(222 47% 5%)", color: "hsl(210 40% 95%)", fontFamily: "var(--app-font-sans)" }}>
      <TickerBar />

      <nav style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "rgba(7,9,26,0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid hsl(222 30% 14%)",
        padding: "0 24px",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "hsl(217 91% 60%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            </div>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "hsl(210 40% 95%)" }}>
              Hisse<span style={{ color: "hsl(217 91% 60%)" }}>Analiz</span>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 12, color: "hsl(215 20% 55%)", padding: "4px 10px", borderRadius: 6, background: "hsl(222 40% 8%)", border: "1px solid hsl(222 30% 14%)" }}>
              Canli Veri
            </div>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 24px" }}>
        <div className="fade-up" style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ display: "inline-block", fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "hsl(217 91% 60%)", marginBottom: 16, padding: "4px 12px", borderRadius: 6, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)" }}>
            Finnhub Canli Veriler
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 700, lineHeight: 1.1, marginBottom: 16 }}>
            Hisse Senedi Analizi
          </h1>
          <p style={{ fontSize: 18, color: "hsl(215 20% 55%)", maxWidth: 500, margin: "0 auto" }}>
            Herhangi bir hisse senedini girin. Fiyat, grafik, analist onerileri ve haberleri aninda gorun.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="fade-up-1" style={{ maxWidth: 640, margin: "0 auto 48px" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              placeholder="Hisse sembolü girin: AAPL, TSLA, NVDA..."
              disabled={isLoading}
              style={{
                flex: 1,
                background: "hsl(222 40% 8%)",
                border: "1px solid hsl(222 30% 20%)",
                color: "hsl(210 40% 95%)",
                borderRadius: 14,
                padding: "16px 20px",
                fontSize: 16,
                fontFamily: "inherit",
                outline: "none",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "hsl(217 91% 60%)";
                e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.12)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "hsl(222 30% 20%)";
                e.target.style.boxShadow = "none";
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              style={{
                background: "hsl(217 91% 60%)",
                color: "white",
                border: "none",
                borderRadius: 14,
                padding: "16px 28px",
                fontSize: 15,
                fontWeight: 600,
                cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                transition: "background 0.2s, transform 0.1s",
                opacity: isLoading || !input.trim() ? 0.7 : 1,
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => { if (!isLoading) (e.target as HTMLButtonElement).style.background = "hsl(217 91% 50%)"; }}
              onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = "hsl(217 91% 60%)"; }}
            >
              {isLoading ? "Yukleniyor..." : "Analiz Et"}
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {POPULAR_STOCKS.map((s) => (
              <button
                key={s.symbol}
                type="button"
                onClick={() => analyze(s.symbol)}
                disabled={isLoading}
                style={{
                  background: "hsl(222 40% 8%)",
                  border: "1px solid hsl(222 30% 16%)",
                  color: "hsl(215 20% 65%)",
                  borderRadius: 8,
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  el.style.borderColor = "hsl(217 91% 60%)";
                  el.style.color = "hsl(217 91% 60%)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  el.style.borderColor = "hsl(222 30% 16%)";
                  el.style.color = "hsl(215 20% 65%)";
                }}
              >
                {s.symbol}
              </button>
            ))}
          </div>
        </form>

        {isLoading && (
          <div className="fade-up" style={{ maxWidth: 640, margin: "0 auto 48px", background: "hsl(222 40% 8%)", border: "1px solid hsl(222 30% 14%)", borderRadius: 20, padding: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "3px solid hsl(222 30% 14%)",
                borderTopColor: "hsl(217 91% 60%)",
                animation: "spin 0.8s linear infinite",
                flexShrink: 0,
              }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{currentSymbol} analiz ediliyor</div>
                <div style={{ fontSize: 13, color: "hsl(215 20% 55%)" }}>Canli veriler isleniyor...</div>
              </div>
            </div>
            <LoadingProgress step={loadStep} />
          </div>
        )}

        {loadStep === "error" && (
          <div className="fade-up" style={{ maxWidth: 640, margin: "0 auto 48px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 16, padding: 24 }}>
            <div style={{ fontWeight: 600, color: "#EF4444", marginBottom: 6 }}>Hata</div>
            <div style={{ fontSize: 14, color: "hsl(215 20% 65%)" }}>{errorMsg}</div>
          </div>
        )}

        {data && loadStep === "done" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <div className="fade-up" style={{
              background: "hsl(222 40% 8%)",
              border: "1px solid hsl(222 30% 14%)",
              borderRadius: 20,
              padding: 32,
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  {data.profile.logo && (
                    <img
                      src={data.profile.logo}
                      alt={data.profile.name}
                      style={{ width: 52, height: 52, borderRadius: 12, objectFit: "contain", background: "white", padding: 4 }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  <div>
                    <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{data.profile.name}</h2>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Badge variant="blue">{data.profile.ticker}</Badge>
                      {data.profile.exchange && <Badge variant="gray">{data.profile.exchange}</Badge>}
                      {data.profile.finnhubIndustry && <Badge variant="gray">{data.profile.finnhubIndustry}</Badge>}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, marginBottom: 6 }}>
                    {data.profile.currency === "TRY" ? "₺" : "$"}{data.quote.c.toFixed(2)}
                  </div>
                  <Badge variant={isUp ? "green" : "red"}>
                    {isUp ? "+" : ""}{priceChange.toFixed(2)} ({isUp ? "+" : ""}{priceChangePct.toFixed(2)}%)
                  </Badge>
                </div>
              </div>

              <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16 }}>
                <StatCard label="Acilis" value={`$${formatNumber(data.quote.o)}`} delay={1} />
                <StatCard label="Gunluk Yuksek" value={`$${formatNumber(data.quote.h)}`} color="green" delay={1} />
                <StatCard label="Gunluk Dusuk" value={`$${formatNumber(data.quote.l)}`} color="red" delay={2} />
                <StatCard label="Onceki Kapanis" value={`$${formatNumber(data.quote.pc)}`} delay={2} />
                <StatCard label="Piyasa Degeri" value={formatMarketCap(data.profile.marketCapitalization)} delay={3} />
                {data.metrics["52WeekHigh"] && (
                  <StatCard label="52H Yuksek" value={`$${formatNumber(data.metrics["52WeekHigh"])}`} color="green" delay={3} />
                )}
                {data.metrics["52WeekLow"] && (
                  <StatCard label="52H Dusuk" value={`$${formatNumber(data.metrics["52WeekLow"])}`} color="red" delay={4} />
                )}
                {data.metrics["peBasicExclExtraTTM"] && (
                  <StatCard label="F/K" value={formatNumber(data.metrics["peBasicExclExtraTTM"])} delay={4} />
                )}
              </div>
            </div>

            {data.candles && (
              <div className="fade-up-1" style={{ background: "hsl(222 40% 8%)", border: "1px solid hsl(222 30% 14%)", borderRadius: 20, padding: 32 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 600 }}>Fiyat Grafigi (90 Gun)</h3>
                  {candlePercent !== null && (
                    <Badge variant={candlePercent >= 0 ? "green" : "red"}>
                      {candlePercent >= 0 ? "+" : ""}{candlePercent.toFixed(2)}% (90G)
                    </Badge>
                  )}
                </div>
                <PriceChart candles={data.candles} />
              </div>
            )}

            {data.metrics && Object.keys(data.metrics).length > 0 && (
              <div className="fade-up-2" style={{ background: "hsl(222 40% 8%)", border: "1px solid hsl(222 30% 14%)", borderRadius: 20, padding: 32 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 24 }}>Finansal Metrikler</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
                  {[
                    { key: "rsi14", label: "RSI (14)" },
                    { key: "peBasicExclExtraTTM", label: "F/K Orani" },
                    { key: "pbAnnual", label: "F/DD Orani" },
                    { key: "dividendYieldIndicatedAnnual", label: "Temettü Verimi" },
                    { key: "epsNormalizedAnnual", label: "HB Kazanc" },
                    { key: "revenueGrowth3Y", label: "Gelir Büyüme 3Y" },
                    { key: "netProfitMarginAnnual", label: "Net Kar Marji" },
                    { key: "currentRatioAnnual", label: "Cari Oran" },
                    { key: "debtEquityAnnual", label: "Borc/Özsermaye" },
                    { key: "roaRfy", label: "Varlik Getirisi" },
                    { key: "roeRfy", label: "Özsermaye Getirisi" },
                    { key: "beta", label: "Beta" },
                  ]
                    .filter((m) => data.metrics[m.key] !== undefined && !isNaN(data.metrics[m.key]))
                    .map((m, i) => {
                      const v = data.metrics[m.key];
                      let color: "green" | "red" | "default" = "default";
                      if (m.key === "rsi14") color = v > 70 ? "red" : v < 30 ? "green" : "default";
                      if (m.key === "dividendYieldIndicatedAnnual") color = v > 0 ? "green" : "default";
                      return (
                        <StatCard
                          key={m.key}
                          label={m.label}
                          value={m.key.includes("Margin") || m.key.includes("Growth") || m.key.includes("Yield") || m.key.includes("roa") || m.key.includes("roe")
                            ? `${(v * (Math.abs(v) < 1 ? 100 : 1)).toFixed(2)}%`
                            : formatNumber(v)}
                          color={color}
                          delay={(i % 4) as 0 | 1 | 2 | 3}
                        />
                      );
                    })}
                </div>
              </div>
            )}

            {data.recommendations.length > 0 && (
              <div className="fade-up-2" style={{ background: "hsl(222 40% 8%)", border: "1px solid hsl(222 30% 14%)", borderRadius: 20, padding: 32 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 24 }}>Analist Onerileri</h3>
                <RecommendationChart data={data.recommendations} />
              </div>
            )}

            {data.sentiment && (
              <div className="fade-up-3" style={{ background: "hsl(222 40% 8%)", border: "1px solid hsl(222 30% 14%)", borderRadius: 20, padding: 32 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 24 }}>Haber Sentiment Analizi</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
                  <StatCard
                    label="Yükselis Haberleri"
                    value={`${(data.sentiment.sentiment.bullishPercent * 100).toFixed(1)}%`}
                    color={data.sentiment.sentiment.bullishPercent >= 0.5 ? "green" : "red"}
                    delay={1}
                  />
                  <StatCard
                    label="Düsüs Haberleri"
                    value={`${(data.sentiment.sentiment.bearishPercent * 100).toFixed(1)}%`}
                    color={data.sentiment.sentiment.bearishPercent >= 0.5 ? "red" : "green"}
                    delay={1}
                  />
                  <StatCard
                    label="Haber Skoru"
                    value={data.sentiment.companyNewsScore.toFixed(3)}
                    color={data.sentiment.companyNewsScore > 0.5 ? "green" : "red"}
                    delay={2}
                  />
                  <StatCard
                    label="Haber Adet (7G)"
                    value={String(data.sentiment.buzz.articlesInLastWeek)}
                    delay={2}
                  />
                  <StatCard
                    label="Sektör Yükselis"
                    value={`${(data.sentiment.sectorAverageBullishPercent * 100).toFixed(1)}%`}
                    delay={3}
                  />
                  <StatCard
                    label="Sektör Haber Skoru"
                    value={data.sentiment.sectorAverageNewsScore.toFixed(3)}
                    delay={3}
                  />
                </div>

                {bullishPct !== null && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: "hsl(215 20% 55%)" }}>Haber Olumlu/Olumsuz Orani</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: "rgba(239,68,68,0.3)", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${bullishPct}%`,
                          background: bullishPct >= 50 ? "#10B981" : "#EF4444",
                          borderRadius: 4,
                          transition: "width 1s ease",
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, color: "hsl(215 20% 55%)" }}>
                      <span style={{ color: "#10B981" }}>Olumlu {bullishPct.toFixed(1)}%</span>
                      <span style={{ color: "#EF4444" }}>Olumsuz {(100 - bullishPct).toFixed(1)}%</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {data.earnings.length > 0 && (
              <div className="fade-up-3" style={{ background: "hsl(222 40% 8%)", border: "1px solid hsl(222 30% 14%)", borderRadius: 20, padding: 32 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 24 }}>Kazanc Raporu</h3>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead>
                      <tr>
                        {["Donem", "Gerceklesen HBK", "Tahmin HBK", "Fark", "Fark %"].map((h) => (
                          <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "hsl(215 20% 55%)", fontWeight: 500, borderBottom: "1px solid hsl(222 30% 14%)" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.earnings.map((e, i) => {
                        const beat = e.actual !== null && e.estimate !== null && e.actual > e.estimate;
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid hsl(222 30% 10%)" }}>
                            <td style={{ padding: "12px 16px", fontWeight: 500 }}>{e.period}</td>
                            <td style={{ padding: "12px 16px", color: beat ? "#10B981" : "#EF4444" }}>
                              {e.actual !== null ? `$${e.actual.toFixed(2)}` : "—"}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              {e.estimate !== null ? `$${e.estimate.toFixed(2)}` : "—"}
                            </td>
                            <td style={{ padding: "12px 16px", color: beat ? "#10B981" : "#EF4444" }}>
                              {e.surprise !== null ? `${e.surprise > 0 ? "+" : ""}${e.surprise.toFixed(2)}` : "—"}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              {e.surprisePercent !== null ? (
                                <Badge variant={e.surprisePercent > 0 ? "green" : "red"}>
                                  {e.surprisePercent > 0 ? "+" : ""}{e.surprisePercent.toFixed(1)}%
                                </Badge>
                              ) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {data.news.length > 0 && (
              <div className="fade-up-4" style={{ background: "hsl(222 40% 8%)", border: "1px solid hsl(222 30% 14%)", borderRadius: 20, padding: 32 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 24 }}>Son Haberler</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {data.news.map((n, i) => (
                    <a
                      key={n.id}
                      href={n.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "flex",
                        gap: 16,
                        padding: "16px",
                        borderRadius: 12,
                        textDecoration: "none",
                        transition: "background 0.15s",
                        alignItems: "flex-start",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "hsl(222 30% 11%)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      {n.image && (
                        <img
                          src={n.image}
                          alt=""
                          style={{ width: 72, height: 52, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: "hsl(210 40% 90%)", marginBottom: 4, lineHeight: 1.4 }}>
                          {n.headline}
                        </div>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: "hsl(215 20% 50%)" }}>{n.source}</span>
                          <span style={{ fontSize: 12, color: "hsl(215 20% 40%)" }}>
                            {new Date(n.datetime * 1000).toLocaleDateString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="fade-up-5" style={{
              background: "rgba(245,158,11,0.06)",
              border: "1px solid rgba(245,158,11,0.15)",
              borderRadius: 16,
              padding: "16px 20px",
              fontSize: 13,
              color: "hsl(215 20% 60%)",
              lineHeight: 1.6,
            }}>
              <strong style={{ color: "#F59E0B" }}>Yasal Uyari: </strong>
              Bu platform yalnizca bilgilendirme amaclidir. Sunulan veriler ve analizler yatirim tavsiyesi niteliginde degildir. Yatirim kararlari vermeden once kendi arastirmanizi yapmali ve gerekirse bir finansal danisman ile gorusmelisiniz.
            </div>
          </div>
        )}

        {loadStep === "idle" && (
          <div className="fade-up-2" style={{ textAlign: "center", marginTop: 16 }}>
            <div style={{ display: "inline-flex", gap: 32, padding: "32px 48px", background: "hsl(222 40% 8%)", border: "1px solid hsl(222 30% 14%)", borderRadius: 20 }}>
              {[
                { label: "Canli Fiyat", desc: "Anlık veriler" },
                { label: "Teknik Analiz", desc: "RSI, F/K, vb." },
                { label: "Analist Onerileri", desc: "Uzman onerileri" },
                { label: "Haber Akisi", desc: "Son haberler" },
              ].map((f) => (
                <div key={f.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{f.label}</div>
                  <div style={{ fontSize: 12, color: "hsl(215 20% 50%)" }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
