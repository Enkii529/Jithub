import { useState, useEffect, useCallback, memo } from "react";

// ── Design Tokens (Synced with index.css) ─────────────────────────────────────
const COLORS = {
  bg: "hsl(var(--bg-pure))",
  panel: "hsl(var(--bg-panel))",
  glass: "hsla(var(--bg-glass))",
  border: "hsla(var(--glass-border))",
  primary: "hsl(var(--accent-primary))",
  secondary: "hsl(var(--accent-secondary))",
  orange: "hsl(var(--accent-orange))",
  red: "hsl(var(--accent-red))",
  text: "hsl(var(--text-main))",
  textMid: "hsl(var(--text-mid))",
  textDim: "hsl(var(--text-dim))"
};

const POPULAR = ["BTC", "ETH", "SOL", "BNB", "XRP", "AVAX", "LINK", "DOGE", "ADA", "SUI", "APT", "MATIC"];

const STRUCTURE_ITEMS = {
  bear: [
    { id: "weekly", label: "Weekly Support Mapped", sub: "Macro shelf identified", auto: true },
    { id: "daily", label: "Daily Buy Shelf Defined", sub: "Active execution pivot", auto: true },
    { id: "invalid", label: "Invalidation Defined", sub: "Daily close below pivot", auto: false },
    { id: "rsi", label: "RSI ≤ 40 on 8H / 1D", sub: "Shopping mode gatekeeper", auto: true },
  ],
  bull: [
    { id: "weekly", label: "Weekly Resistance Mapped", sub: "Macro shelf identified", auto: true },
    { id: "daily", label: "Daily Sell Shelf Defined", sub: "Active execution pivot", auto: true },
    { id: "invalid", label: "Invalidation Defined", sub: "Daily close above pivot", auto: false },
    { id: "rsi", label: "RSI ≥ 70 on 8H / 1D", sub: "Distribution mode gatekeeper", auto: true },
  ],
};

const CONFIRM_ITEMS = {
  bear: [
    { id: "rsi_turn", label: "Momentum Curl", sub: "RSI/Stoch cross up at support", pts: 1 },
    { id: "macd", label: "MACD Signal", sub: "Histogram rising or bullish cross", pts: 1 },
    { id: "div", label: "Bullish Divergence", sub: "4H RSI divergence into shelf", pts: 1 },
    { id: "vol", label: "Absorption Volume", sub: "Flush + rejection anomaly", pts: 1 },
    { id: "candle", label: "Reclaim Close ★", sub: "Sweep then close above support", pts: 2 },
  ],
  bull: [
    { id: "rsi_turn", label: "Momentum Fade", sub: "RSI/Stoch cross down at resistance", pts: 1 },
    { id: "macd", label: "MACD Signal", sub: "Histogram shrinking or bearish cross", pts: 1 },
    { id: "div", label: "Bearish Divergence", sub: "4H RSI divergence into shelf", pts: 1 },
    { id: "vol", label: "Exhaustion Volume", sub: "Thin push into resistance failure", pts: 1 },
    { id: "candle", label: "Failure Close ★", sub: "Push then close below resistance", pts: 2 },
  ],
};

// ── Generic Components ─────────────────────────────────────────────────────────

const Card = ({ title, num, children, style, className = "" }) => (
  <div className={`glass animate-slide-up ${className}`} 
       style={{ padding: "20px", borderRadius: "16px", marginBottom: "16px", overflow: "hidden", position: "relative", ...style }}>
    {title && (
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        {num && <span style={{ fontSize: "10px", fontWeight: 800, color: COLORS.primary, opacity: 0.8, letterSpacing: "0.1em" }}>0{num}—</span>}
        <h3 style={{ fontSize: "11px", fontWeight: 700, color: COLORS.textMid, letterSpacing: "0.15em", textTransform: "uppercase" }}>{title}</h3>
      </div>
    )}
    {children}
  </div>
);

const ProgressGauge = ({ value, color, height = 6 }) => (
  <div style={{ height: `${height}px`, background: "hsla(var(--text-dim) / 0.15)", borderRadius: "100px", overflow: "hidden", position: "relative" }}>
    <div style={{ 
      height: "100%", borderRadius: "100px", width: `${Math.min(value, 100)}%`, 
      background: color || `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.secondary})`,
      boxShadow: `0 0 10px ${color || COLORS.primary}44`,
      transition: "width 1s cubic-bezier(0.16, 1, 0.3, 1)" 
    }} />
  </div>
);

const MomentumMatrix = memo(({ matrix }) => {
  if (!matrix) return null;
  const timeframes = ["1d", "12h", "8h", "4h"];
  return (
    <div style={{ marginTop: "12px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "12px", borderBottom: `1px solid ${COLORS.border}`, paddingBottom: "8px" }}>
        <span style={{ fontSize: "9px", fontWeight: 700, color: COLORS.textDim, letterSpacing: "0.1em" }}>TF</span>
        <span style={{ fontSize: "9px", fontWeight: 700, color: COLORS.textDim, letterSpacing: "0.1em", textAlign: "center" }}>RSI</span>
        <span style={{ fontSize: "9px", fontWeight: 700, color: COLORS.textDim, letterSpacing: "0.1em", textAlign: "center" }}>STOCH</span>
      </div>
      {timeframes.map(tf => (
        <div key={tf} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", padding: "8px 0", borderBottom: "1px solid hsla(var(--text-dim) / 0.05)" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: COLORS.primary }}>{tf.toUpperCase()}</span>
          <span style={{ fontSize: "13px", fontWeight: 600, textAlign: "center", color: matrix[tf].rsi > 70 ? COLORS.orange : matrix[tf].rsi < 30 ? COLORS.primary : COLORS.text }}>
            {matrix[tf].rsi.toFixed(1)}
          </span>
          <span style={{ fontSize: "13px", fontWeight: 600, textAlign: "center", color: matrix[tf].stochRsi > 80 ? COLORS.orange : matrix[tf].stochRsi < 20 ? COLORS.primary : COLORS.text }}>
            {matrix[tf].stochRsi.toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
});

// ── Specific Sections ──────────────────────────────────────────────────────────

const StrategicReview = ({ text, accent }) => (
  <div style={{ fontSize: "14px", color: COLORS.textMid, lineHeight: 1.6, padding: "16px", background: "hsla(var(--text-dim) / 0.05)", borderRadius: "12px", borderLeft: `3px solid ${accent}` }}>
    {text.split("\n\n").map((para, i) => (
      <p key={i} style={{ marginBottom: para.startsWith("#") ? "12px" : "16px", color: para.startsWith("#") ? COLORS.text : COLORS.textMid, fontWeight: para.startsWith("#") ? 800 : 400, fontSize: para.startsWith("#") ? "16px" : "14px" }}>
        {para.replace(/\*\*/g, "").replace(/#/g, "")}
      </p>
    ))}
  </div>
);

function OracleDashboard({ data, globalData, title, accent, cycle, setCycle }) {
  const [structChecks, setStructChecks] = useState({});
  const [confirmChecks, setConfirmChecks] = useState({});
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (!globalData) return;
    setStructChecks({
      weekly: !!globalData.weekly_support,
      daily: !!globalData.daily_support,
      rsi: globalData.daily_rsi <= 40 || globalData.daily_rsi >= 60,
    });
    setConfirmChecks({
      rsi_turn: globalData.stoch_turning_up || globalData.stoch_turning_down,
      macd: globalData.macd_rising || globalData.macd_falling,
      div: globalData.bullish_divergence_4h || globalData.bearish_divergence_4h,
      vol: globalData.volume_above_avg,
    });
  }, [globalData]);

  if (!globalData || !data || !data.tiers) {
    return (
      <div style={{ padding: "40px 20px", color: COLORS.textDim, textAlign: "center" }}>
        <p style={{ marginBottom: "20px" }}>Analysis structure loading or incomplete...</p>
        <button onClick={() => setShowRaw(!showRaw)} style={{ padding: "8px 16px", background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.primary, borderRadius: "8px", fontSize: "10px", fontWeight: 700 }}>
          {showRaw ? "HIDE DATA" : "INSPECT RAW CONTENT"}
        </button>
        {showRaw && (
          <pre style={{ textAlign: "left", fontSize: "10px", background: "#000", padding: "12px", marginTop: "20px", borderRadius: "8px", overflowX: "auto", color: "#0f0" }}>
            {JSON.stringify({ globalData, data }, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  const structItems = cycle ? STRUCTURE_ITEMS[cycle] : [];
  const confirmItems = cycle ? CONFIRM_ITEMS[cycle] : [];
  const structCount = Object.values(structChecks).filter(Boolean).length;
  
  let confirmPts = 0;
  confirmItems.forEach(c => { if (confirmChecks[c.id]) confirmPts += c.pts; });

  const totalScore = Math.round(((structCount / 4) * 40) + ((confirmPts / 6) * 60));
  const verdict = totalScore >= 85 ? "PRIME OPPORTUNITY" : totalScore >= 70 ? "SCALABLE POSITION" : "NEUTRAL / WAIT";
  const verdictColor = totalScore >= 85 ? COLORS.primary : totalScore >= 70 ? COLORS.orange : COLORS.red;

  return (
    <div style={{ marginBottom: "40px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px", padding: "0 4px" }}>
        <div style={{ height: "1px", flex: 1, background: `linear-gradient(90deg, transparent, ${COLORS.border})` }} />
        <span style={{ fontSize: "9px", fontWeight: 800, color: COLORS.textDim, letterSpacing: "0.2em" }}>{title}</span>
        <div style={{ height: "1px", flex: 1, background: `linear-gradient(90deg, ${COLORS.border}, transparent)` }} />
      </div>

      <Card style={{ padding: "24px", background: `linear-gradient(180deg, hsla(var(--bg-panel) / 0.5) 0%, hsl(var(--bg-pure)) 100%)` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
               <h4 style={{ fontSize: "10px", color: COLORS.textDim, letterSpacing: "0.2em" }}>CONFLUENCE VERDICT</h4>
               <span style={{ fontSize: "9px", fontWeight: 800, padding: "2px 6px", borderRadius: "4px", background: cycle === 'bear' ? COLORS.primary + '22' : COLORS.orange + '22', color: cycle === 'bear' ? COLORS.primary : COLORS.orange, border: `1px solid ${cycle === 'bear' ? COLORS.primary + '44' : COLORS.orange + '44'}` }}>
                 {cycle?.toUpperCase()} REGIME
               </span>
            </div>
            <h2 style={{ fontSize: "28px", fontWeight: 800, color: verdictColor, letterSpacing: "-0.02em" }}>{verdict}</h2>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "42px", fontWeight: 800, color: verdictColor, lineHeight: 1 }}>{totalScore}<span style={{ fontSize: "14px", opacity: 0.4 }}>%</span></div>
          </div>
        </div>
        <ProgressGauge value={totalScore} color={verdictColor} height={8} />

        <div style={{ marginTop: "24px", display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}>
           <StrategicReview text={data.text} accent={accent} />
           <MomentumMatrix matrix={globalData.matrix} />
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
        <Card title="Structural Integrity" num={1}>
          {structItems.map(item => (
            <div key={item.id} onClick={() => setStructChecks(p => ({ ...p, [item.id]: !p[item.id] }))} 
                 style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", background: structChecks[item.id] ? "hsla(var(--accent-primary) / 0.05)" : "transparent", borderRadius: "8px", border: `1px solid ${structChecks[item.id] ? COLORS.primary + '33' : 'transparent'}`, transition: "0.2s" }}>
              <div style={{ width: "18px", height: "18px", border: `1px solid ${structChecks[item.id] ? COLORS.primary : COLORS.textDim}`, borderRadius: "4px", background: structChecks[item.id] ? COLORS.primary : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {structChecks[item.id] && <span style={{ color: "#000", fontSize: "10px", fontWeight: 900 }}>✓</span>}
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: structChecks[item.id] ? COLORS.text : COLORS.textMid }}>{item.label}</div>
                <div style={{ fontSize: "10px", color: COLORS.textDim }}>{item.sub}</div>
              </div>
            </div>
          ))}
        </Card>

        <Card title="Execution Tiers" num={2}>
           <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {data.tiers.map(t => (
                <div key={t.l} style={{ padding: "12px", background: "hsla(var(--bg-pure) / 0.5)", borderRadius: "8px", border: `1px solid ${COLORS.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700 }}>{t.l}</span>
                    <span style={{ fontSize: "12px", fontWeight: 800, color: COLORS.primary }}>${t.val?.toLocaleString()}</span>
                  </div>
                  <ProgressGauge value={t.p} color={COLORS.secondary} height={4} />
                  <div style={{ fontSize: "9px", color: COLORS.textDim, marginTop: "4px", textAlign: "right" }}>ALLOCATION: {t.p}%</div>
                </div>
              ))}
           </div>
        </Card>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function OracleApp() {
  const [cycle, setCycle] = useState(null);
  const [symbol, setSymbol] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const handleAnalyze = async (s) => {
    const target = s || symbol;
    if (!target.trim() || loading) return;
    setLoading(true);
    setError(null);
    console.log(`[Frontend] Analyzing ${target} with Cycle: ${cycle}`);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: target.toUpperCase(), cycle }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Network error");
      setData(result);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const accent = cycle === "bear" ? COLORS.primary : COLORS.orange;

  return (
    <div style={{ minHeight: "100vh", padding: "0 16px 120px 16px", maxWidth: "480px", margin: "0 auto" }}>
      
      {/* Dynamic Header */}
      <header style={{ padding: "24px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "32px", height: "32px", background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: "#000", fontSize: "18px", boxShadow: `0 0 20px ${COLORS.primary}44` }}>O</div>
          <h1 style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "0.1em" }}>ORACLE <span style={{ color: COLORS.textDim, fontWeight: 400 }}>PRO</span></h1>
        </div>
        {cycle && (
          <button onClick={() => { setCycle(null); setData(null); setSymbol(""); }} 
                  style={{ background: "hsla(var(--text-dim) / 0.1)", border: "none", color: COLORS.textDim, padding: "8px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: 700 }}>
            ↺ RESET
          </button>
        )}
      </header>

      {/* Step 1: Regime */}
      {!cycle && (
        <div className="animate-slide-up" style={{ padding: "40px 0", textAlign: "center" }}>
          <h2 style={{ fontSize: "11px", color: COLORS.primary, letterSpacing: "0.4em", marginBottom: "80px", fontWeight: 800 }}>CHOOSE YOUR REGIME</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}>
            {['bear', 'bull'].map(c => (
              <button key={c} onClick={() => setCycle(c)}
                      style={{ padding: "40px", borderRadius: "24px", background: "hsl(var(--bg-panel))", border: `1px solid ${COLORS.border}`, color: COLORS.text, position: "relative", overflow: "hidden" }}>
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>{c === 'bear' ? "❄" : "☀"}</div>
                <div style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "0.2em", color: c === 'bear' ? COLORS.primary : COLORS.orange }}>{c.toUpperCase()} WEEKS</div>
                <div style={{ fontSize: "10px", color: COLORS.textDim, marginTop: "8px" }}>{c === 'bear' ? "Oversold Accumulation" : "Overbought Distribution"}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Input */}
      {cycle && !data && (
        <div className="animate-slide-up" style={{ padding: "40px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "60px" }}>
            <div style={{ fontSize: "32px" }}>{cycle === 'bear' ? "❄" : "☀"}</div>
            <h2 style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.2em", color: accent }}>{cycle.toUpperCase()} REGIME ACTIVE</h2>
          </div>
          
          <div style={{ position: "relative", marginBottom: "24px" }}>
            <input autoFocus id="symbol-input" name="symbol" placeholder="SYMBOL (E.G. BTC)" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && handleAnalyze()}
                   style={{ width: "100%", background: "hsl(var(--bg-panel))", border: `1px solid ${COLORS.border}`, padding: "24px", borderRadius: "16px", color: COLORS.text, fontSize: "24px", fontWeight: 800, outline: "none", textAlign: "center" }} />
          </div>
          
          <button onClick={() => handleAnalyze()} disabled={loading || !symbol}
                  style={{ width: "100%", padding: "20px", borderRadius: "16px", background: loading ? COLORS.border : accent, border: "none", color: "#000", fontWeight: 800, fontSize: "14px", letterSpacing: "0.2em", transition: "0.3s", boxShadow: `0 12px 24px ${accent}33` }}>
            {loading ? "COMMENCING..." : "ANALYZE STRATEGY"}
          </button>
        </div>
      )}

      {/* Step 3: Analysis */}
      {data && (
        <div className="animate-fade-in">
          <OracleDashboard data={data.v1d} globalData={data} title="VERSION 1.0 (1D)" accent={COLORS.primary} cycle={cycle} setCycle={setCycle} />
          <OracleDashboard data={data.v12h} globalData={data} title="VERSION 2.0 (12H)" accent={COLORS.orange} cycle={cycle} setCycle={setCycle} />
        </div>
      )}

      {error && <div style={{ color: COLORS.red, background: `${COLORS.red}11`, padding: "16px", borderRadius: "12px", border: `1px solid ${COLORS.red}33`, fontSize: "13px", fontWeight: 700, textAlign: "center", marginTop: "20px" }}>⚠️ {error}</div>}

      {/* Bottom Ticker Bar */}
      {cycle && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "hsla(var(--bg-pure) / 0.8)", backdropFilter: "blur(20px)", padding: "16px 20px", borderTop: `1px solid ${COLORS.border}`, zIndex: 1000 }}>
          <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "4px" }}>
            {POPULAR.map(s => (
              <button key={s} onClick={() => handleAnalyze(s)}
                      style={{ padding: "10px 18px", borderRadius: "100px", background: symbol === s ? accent : "hsla(var(--text-dim) / 0.1)", border: `1px solid ${symbol === s ? accent : COLORS.border}`, color: symbol === s ? "#000" : COLORS.textMid, fontSize: "11px", fontWeight: 800, whiteSpace: "nowrap" }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
