import { useState, useEffect, useCallback } from "react";

// ── Palette ───────────────────────────────────────────────────────────────────
const BLUE   = "#00B4D8";
const ORANGE = "#E85000";
const BG     = "#0A0A0A";
const PANEL  = "#111111";
const PANEL2 = "#0D0D0D";
const BORDER = "#1E1E1E";
const TEXT   = "#E8E8E0";
const DIM    = "#555555";
const MID    = "#888880";
const RED    = "#CC2222";
const GREEN  = "#22AA66";

const POPULAR = ["BTC","ETH","SOL","BNB","XRP","AVAX","LINK","DOGE","ADA","SUI","APT","MATIC"];

// ── Data ──────────────────────────────────────────────────────────────────────
const STRUCTURE_ITEMS = {
  bear: [
    { id: "weekly",  label: "Weekly support mapped",      sub: "Clear swing low / macro shelf identified",    auto: true  },
    { id: "daily",   label: "Daily buy shelf defined",    sub: "Active execution level with prior pivot",     auto: true  },
    { id: "invalid", label: "Invalidation level defined", sub: "Daily/weekly close that proves thesis wrong", auto: false },
    { id: "rsi",     label: "RSI ≤ 40 on 8H / 1D",       sub: "Shopping mode gatekeeper — required",        auto: true  },
  ],
  bull: [
    { id: "weekly",  label: "Weekly resistance mapped",   sub: "Clear swing high / macro shelf identified",   auto: true  },
    { id: "daily",   label: "Daily sell shelf defined",   sub: "Active execution level with prior pivot",     auto: true  },
    { id: "invalid", label: "Invalidation level defined", sub: "Daily/weekly close that proves thesis wrong", auto: false },
    { id: "rsi",     label: "RSI ≥ 70 on 8H / 1D",       sub: "Distribution mode gatekeeper — required",    auto: true  },
  ],
};

const CONFIRM_ITEMS = {
  bear: [
    { id: "rsi_turn", label: "RSI / Stoch Turn",  sub: "Floor curl / cross up at support",         pts: 1 },
    { id: "macd",     label: "MACD Signal",        sub: "Histogram rising, bullish curl or cross",  pts: 1 },
    { id: "div",      label: "Bullish Divergence", sub: "4H RSI divergence into support",           pts: 1 },
    { id: "vol",      label: "Volume Spike",       sub: "Flush + rejection — absorption anomaly",  pts: 1 },
    { id: "candle",   label: "Candle Close ★",     sub: "Sweep then reclaim close above support",  pts: 2 },
  ],
  bull: [
    { id: "rsi_turn", label: "RSI / Stoch Turn",   sub: "Ceiling cross down at resistance",         pts: 1 },
    { id: "macd",     label: "MACD Signal",         sub: "Histogram shrinking, bearish fade",        pts: 1 },
    { id: "div",      label: "Bearish Divergence",  sub: "4H RSI divergence into resistance",        pts: 1 },
    { id: "vol",      label: "Weak Volume",         sub: "Thin push into resistance — failure",     pts: 1 },
    { id: "candle",   label: "Candle Close ★",      sub: "Push then failure close below resistance",pts: 2 },
  ],
};

const LADDER = {
  bear: [
    { label: "T1 STARTER", pct: 25, desc: "RSI ≤ 40 + proof at Support 1",              color: BLUE     },
    { label: "T2 CORE",    pct: 45, desc: "Support 2 / Fib 0.5–0.618 / lower rail",     color: BLUE     },
    { label: "T3 DEFENSE", pct: 30, desc: "Sweep / capitulation / final shelf",          color: "#0088AA"},
  ],
  bull: [
    { label: "S1 STARTER", pct: 25, desc: "Resistance touch + rejection proof",          color: ORANGE   },
    { label: "S2 CORE",    pct: 45, desc: "Fib 1.272–1.618 / upper rail / weekly shelf", color: ORANGE   },
    { label: "S3 DEFENSE", pct: 30, desc: "Blow-off / parabolic spike + rejection",      color: "#AA3800"},
  ],
};

const RULES = {
  bear: {
    ok: ["Accumulate longs via ladder tiers","Cover / close existing shorts","Place limit orders at shelves"],
    no: ["Initiating new shorts","Chasing green candles","All-in at a single price"],
  },
  bull: {
    ok: ["Distribute longs into resistance","Deploy shorts AFTER rejection proof","Scale out at premium shelves"],
    no: ["New long accumulation (chasing)","Assuming breakouts trend forever","Shorting without confirmation"],
  },
};

// ── Claude-in-Claude analysis ─────────────────────────────────────────────────
async function analyzeWithClaude(symbol) {
  const prompt = `You are a crypto technical analyst. Analyze ${symbol}/USDT right now using web search.

Search for the current price and recent technical data for ${symbol}USDT, then return ONLY a valid JSON object with NO markdown, NO explanation, NO code fences — just raw JSON.

Required JSON shape:
{
  "symbol": "${symbol}",
  "price": <current price as number>,
  "daily_rsi": <14-period RSI on daily chart, number 0-100>,
  "rsi_8h": <14-period RSI on 8H chart, number 0-100>,
  "stoch_4h": <Stochastic RSI on 4H, number 0-100>,
  "stoch_turning_up": <boolean — stoch was oversold <30 and is turning up>,
  "stoch_turning_down": <boolean — stoch was overbought >70 and is turning down>,
  "macd_histogram_4h": <current 4H MACD histogram value, positive or negative number>,
  "macd_rising": <boolean — 4H MACD histogram is rising / turning bullish>,
  "macd_falling": <boolean — 4H MACD histogram is falling / turning bearish>,
  "bullish_divergence_4h": <boolean — price making lower low but RSI making higher low on 4H>,
  "bearish_divergence_4h": <boolean — price making higher high but RSI making lower high on 4H>,
  "volume_above_avg": <boolean — recent volume spike notably above 20-period average>,
  "volume_below_avg": <boolean — recent volume notably weak below 20-period average>,
  "weekly_support": <nearest weekly support level below price, number>,
  "weekly_resistance": <nearest weekly resistance level above price, number>,
  "daily_support": <nearest daily support level below price, number>,
  "daily_resistance": <nearest daily resistance level above price, number>,
  "invalidation_long": <suggested long invalidation — key weekly level below current support, number>,
  "invalidation_short": <suggested short invalidation — key weekly level above current resistance, number>,
  "bull_candle_reclaim": <boolean — recent candle swept below support then closed back above it>,
  "bear_candle_failbreak": <boolean — recent candle pushed above resistance then closed back below it>,
  "suggested_cycle": <"bear" if daily RSI <= 42, "bull" if daily RSI >= 68, otherwise null>,
  "analysis_summary": "<one sentence plain-English summary of current market condition for ${symbol}>"
}

CRITICAL RULES:
- Return ONLY the raw JSON object above. No markdown. No code fences. No explanation before or after.
- All number fields must be plain numbers (no $ signs, no commas).
- All boolean fields must be true or false (lowercase).
- "suggested_cycle" must be exactly "bear", "bull", or null.
- Do not add any fields not listed above.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error("API error " + response.status + ": " + errText.slice(0, 120));
  }
  const apiData = await response.json();

  // Collect ALL text blocks — web_search produces multiple content blocks
  const allText = (apiData.content || [])
    .filter(b => b.type === "text" && b.text)
    .map(b => b.text)
    .join("\n");

  if (!allText) throw new Error("No text returned from analysis");

  // Find the outermost { ... } JSON object
  const start = allText.indexOf("{");
  if (start === -1) throw new Error("No JSON found in response");

  // Walk forward to find the matching closing brace
  let depth = 0, jsonEnd = -1;
  for (let i = start; i < allText.length; i++) {
    if (allText[i] === "{") depth++;
    else if (allText[i] === "}") { depth--; if (depth === 0) { jsonEnd = i; break; } }
  }
  if (jsonEnd === -1) throw new Error("JSON object not closed — response truncated");

  let raw = allText.slice(start, jsonEnd + 1);

  // Sanitise common LLM JSON issues
  raw = raw
    .replace(/\/\/[^\n]*/g, "")           // strip // comments
    .replace(/\/\*[\s\S]*?\*\//g, "")  // strip /* */ comments
    .replace(/,\s*([\]}])/g, "$1")          // remove trailing commas
    .replace(/<[^>]+>/g, "null")              // replace <placeholders> with null
    .replace(/:\s*undefined/g, ": null")     // undefined -> null
    .replace(/NaN/g, "null");                 // NaN -> null

  try {
    return JSON.parse(raw);
  } catch (e) {
    // Fallback: regex-extract each field individually
    const grab = (key) => {
      const m = raw.match(new RegExp('"' + key + '"\\s*:\\s*([^,\\n}]+)'));
      if (!m) return null;
      const v = m[1].trim().replace(/['"]/g, "");
      if (v === "true") return true;
      if (v === "false") return false;
      if (v === "null") return null;
      const n = parseFloat(v);
      return isNaN(n) ? v : n;
    };
    const fields = ["symbol","price","daily_rsi","rsi_8h","stoch_4h","stoch_turning_up",
      "stoch_turning_down","macd_histogram_4h","macd_rising","macd_falling",
      "bullish_divergence_4h","bearish_divergence_4h","volume_above_avg","volume_below_avg",
      "weekly_support","weekly_resistance","daily_support","daily_resistance",
      "invalidation_long","invalidation_short","bull_candle_reclaim","bear_candle_failbreak",
      "suggested_cycle","analysis_summary"];
    const result = {};
    fields.forEach(f => { result[f] = grab(f); });
    if (!result.price) throw new Error("Parse failed: " + e.message);
    return result;
  }
}

function buildChecks(d, cycle) {
  if (!d || !cycle) return { struct: {}, confirm: {} };
  if (cycle === "bear") {
    return {
      struct: {
        weekly:  d.weekly_support  != null,
        daily:   d.daily_support   != null,
        invalid: false,
        rsi:     d.rsi_8h <= 40 || d.daily_rsi <= 40,
      },
      confirm: {
        rsi_turn: !!d.stoch_turning_up,
        macd:     !!d.macd_rising,
        div:      !!d.bullish_divergence_4h,
        vol:      !!d.volume_above_avg,
        candle:   !!d.bull_candle_reclaim,
      },
    };
  } else {
    return {
      struct: {
        weekly:  d.weekly_resistance != null,
        daily:   d.daily_resistance  != null,
        invalid: false,
        rsi:     d.daily_rsi >= 70,
      },
      confirm: {
        rsi_turn: !!d.stoch_turning_down,
        macd:     !!d.macd_falling,
        div:      !!d.bearish_divergence_4h,
        vol:      !!d.volume_below_avg,
        candle:   !!d.bear_candle_failbreak,
      },
    };
  }
}

function fmtP(n) {
  if (n == null) return "—";
  if (n >= 1000)  return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (n >= 1)     return "$" + n.toFixed(2);
  return "$" + n.toFixed(4);
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function PanelHeader({ num, title }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
      <span style={{ fontSize:10, color:ORANGE, letterSpacing:"0.2em", fontWeight:700 }}>{num}.0</span>
      <span style={{ fontSize:9,  color:DIM,    letterSpacing:"0.18em" }}>{title}</span>
    </div>
  );
}
function STitle({ children }) {
  return <div style={{ fontSize:20, fontWeight:700, letterSpacing:"0.08em", color:TEXT, marginBottom:4 }}>{children}</div>;
}
function SDesc({ children }) {
  return <div style={{ fontSize:11, color:DIM, letterSpacing:"0.05em", lineHeight:1.6, marginBottom:16 }}>{children}</div>;
}
function InfoBox({ color, label, children, mt }) {
  return (
    <div style={{ background:`${color}0A`, border:`1px solid ${color}30`, padding:"11px 13px", borderRadius:3, marginTop:mt||0 }}>
      <div style={{ fontSize:9, color, letterSpacing:"0.2em", marginBottom:4, fontWeight:700 }}>{label}</div>
      <div style={{ fontSize:11, color:MID, letterSpacing:"0.04em", lineHeight:1.6 }}>{children}</div>
    </div>
  );
}
function MiniBar({ val, max, color }) {
  return (
    <div style={{ flex:1, height:4, background:BORDER, borderRadius:2 }}>
      <div style={{ height:"100%", borderRadius:2, width:`${Math.min((val/max)*100,100)}%`, background:color, transition:"width 0.35s ease" }} />
    </div>
  );
}
function Divider() { return <div style={{ height:1, background:BORDER, margin:"18px 0" }} />; }

// ── Loading skeleton rows ─────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div style={{ display:"flex", gap:12, padding:"12px 13px", alignItems:"center" }}>
      <div style={{ width:17, height:17, background:BORDER, borderRadius:2 }} />
      <div style={{ flex:1 }}>
        <div style={{ width:"60%", height:10, background:BORDER, borderRadius:2, marginBottom:6 }} />
        <div style={{ width:"80%", height:8,  background:"#181818", borderRadius:2 }} />
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OraclePlanner() {
  const [cycle, setCycle]             = useState(null);
  const [structChecks, setStructChecks] = useState({});
  const [confirmChecks, setConfirmChecks] = useState({});
  const [mobile, setMobile]           = useState(false);
  const [symbol, setSymbol]           = useState("BTC");
  const [loading, setLoading]         = useState(false);
  const [loadStep, setLoadStep]       = useState("");
  const [error, setError]             = useState(null);
  const [data, setData]               = useState(null);
  const [autoSet, setAutoSet]         = useState({ struct:{}, confirm:{} });

  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 780);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!symbol.trim() || loading) return;
    setLoading(true);
    setError(null);
    setLoadStep("Searching live market data…");
    try {
      setLoadStep("Fetching price & indicators…");
      const result = await analyzeWithClaude(symbol.trim().toUpperCase());
      setData(result);

      const c = result.suggested_cycle || cycle;
      if (result.suggested_cycle && result.suggested_cycle !== cycle) {
        setCycle(result.suggested_cycle);
      }
      const useCycle = result.suggested_cycle || cycle;
      if (useCycle) {
        const checks = buildChecks(result, useCycle);
        setStructChecks(checks.struct);
        setConfirmChecks(checks.confirm);
        setAutoSet(checks);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setLoadStep("");
    }
  }, [symbol, cycle, loading]);

  const handleCycleChange = (c) => {
    setCycle(c);
    if (data) {
      const checks = buildChecks(data, c);
      setStructChecks(checks.struct);
      setConfirmChecks(checks.confirm);
      setAutoSet(checks);
    } else {
      setStructChecks({});
      setConfirmChecks({});
      setAutoSet({ struct:{}, confirm:{} });
    }
  };

  const accent = cycle === "bear" ? BLUE : cycle === "bull" ? ORANGE : DIM;
  const structItems  = cycle ? STRUCTURE_ITEMS[cycle] : [];
  const confirmItems = cycle ? CONFIRM_ITEMS[cycle]   : [];
  const structDone   = structItems.length > 0 && structItems.every(s => structChecks[s.id]);
  const gatekeepersOk = !!(cycle && structChecks["invalid"] && structChecks["rsi"]);

  let confirmPts = 0;
  confirmItems.forEach(c => { if (confirmChecks[c.id]) confirmPts += c.pts; });

  const structScore = structDone
    ? 40
    : Math.round((Object.values(structChecks).filter(Boolean).length / 4) * 40);
  const proofScore  = gatekeepersOk ? Math.round((confirmPts / 6) * 60) : 0;
  const total       = structScore + proofScore;

  let verdict = "NO TRADE", verdictColor = RED;
  if (gatekeepersOk && structDone) {
    if      (total >= 85) { verdict = "FULL POSITION"; verdictColor = BLUE;   }
    else if (total >= 70) { verdict = "REDUCED SIZE";  verdictColor = ORANGE; }
  }

  const reset = () => {
    setCycle(null); setStructChecks({}); setConfirmChecks({});
    setData(null); setError(null); setAutoSet({ struct:{}, confirm:{} });
  };

  const toggleStruct  = id => setStructChecks(p => ({ ...p, [id]: !p[id] }));
  const toggleConfirm = id => { if (!gatekeepersOk) return; setConfirmChecks(p => ({ ...p, [id]: !p[id] })); };

  // Value hints for each item
  function structHint(id) {
    if (!data) return null;
    if (cycle === "bear") {
      if (id === "weekly")  return data.weekly_support   ? `↓ ${fmtP(data.weekly_support)}`   : null;
      if (id === "daily")   return data.daily_support    ? `↓ ${fmtP(data.daily_support)}`    : null;
      if (id === "invalid") return data.invalidation_long ? `suggest ${fmtP(data.invalidation_long)}` : null;
      if (id === "rsi")     return `1D: ${data.daily_rsi?.toFixed(1)}  8H: ${data.rsi_8h?.toFixed(1)}`;
    } else {
      if (id === "weekly")  return data.weekly_resistance  ? `↑ ${fmtP(data.weekly_resistance)}`  : null;
      if (id === "daily")   return data.daily_resistance   ? `↑ ${fmtP(data.daily_resistance)}`   : null;
      if (id === "invalid") return data.invalidation_short ? `suggest ${fmtP(data.invalidation_short)}` : null;
      if (id === "rsi")     return `1D: ${data.daily_rsi?.toFixed(1)}  8H: ${data.rsi_8h?.toFixed(1)}`;
    }
    return null;
  }
  function confirmHint(id) {
    if (!data) return null;
    if (id === "rsi_turn") return `Stoch 4H: ${data.stoch_4h?.toFixed(0)}`;
    if (id === "macd")     return `Hist: ${data.macd_histogram_4h?.toFixed(4)}  ${data.macd_rising ? "▲ rising" : data.macd_falling ? "▼ falling" : ""}`;
    if (id === "div")      return (cycle === "bear" ? data.bullish_divergence_4h : data.bearish_divergence_4h) ? "✓ detected on 4H" : "not detected";
    if (id === "vol")      return cycle === "bear" ? (data.volume_above_avg ? "spike above avg" : "normal") : (data.volume_below_avg ? "weak below avg" : "normal");
    if (id === "candle")   return (cycle === "bear" ? data.bull_candle_reclaim : data.bear_candle_failbreak) ? "✓ detected" : "not detected";
    return null;
  }

  // ── CheckRow ─────────────────────────────────────────────────────────────
  function CheckRow({ checked, onToggle, label, sub, rightLabel, hint, wasAuto, disabled }) {
    const isOverride = wasAuto !== undefined && data && checked !== wasAuto;
    return (
      <div onClick={disabled ? undefined : onToggle} style={{
        display:"flex", alignItems:"flex-start", gap:12,
        padding:"12px 13px",
        background: checked ? "rgba(255,255,255,0.025)" : "transparent",
        border:`1px solid ${checked ? BORDER : "transparent"}`,
        borderRadius:3, opacity:disabled ? 0.3 : 1,
        cursor:disabled ? "not-allowed" : "pointer",
        WebkitTapHighlightColor:"transparent", userSelect:"none",
        transition:"background 0.1s",
      }}>
        <div style={{
          width:17, height:17, minWidth:17, marginTop:2,
          border:`2px solid ${checked ? accent : DIM}`,
          background: checked ? accent : "transparent",
          borderRadius:2,
          display:"flex", alignItems:"center", justifyContent:"center",
          transition:"all 0.12s",
        }}>
          {checked && <span style={{ fontSize:10, color:"#000", fontWeight:900, lineHeight:1 }}>✓</span>}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
            <span style={{ fontSize:12, color:TEXT, letterSpacing:"0.04em" }}>{label}</span>
            {data && wasAuto !== undefined && (
              <span style={{ fontSize:8, padding:"1px 5px", background:isOverride ? `${ORANGE}20` : `${accent}15`, color:isOverride ? ORANGE : accent, letterSpacing:"0.1em", borderRadius:2 }}>
                {isOverride ? "MANUAL OVERRIDE" : "AUTO"}
              </span>
            )}
          </div>
          <div style={{ fontSize:10, color:DIM, letterSpacing:"0.04em", marginTop:2 }}>{sub}</div>
          {hint && <div style={{ fontSize:10, color:checked ? accent : MID, letterSpacing:"0.06em", marginTop:3, fontFamily:"monospace" }}>{hint}</div>}
        </div>
        {rightLabel && <div style={{ fontSize:10, color:accent, letterSpacing:"0.1em", marginTop:2, minWidth:28, textAlign:"right" }}>{rightLabel}</div>}
      </div>
    );
  }

  const ps = { background:PANEL, padding:mobile ? "18px 14px" : "22px 26px" };

  // ── Panels ────────────────────────────────────────────────────────────────
  function CyclePanel() {
    return (
      <div style={ps}>
        <PanelHeader num="01" title="CYCLE CONTEXT — THE PERMISSION SLIP" />
        <STitle>STEP 1: CYCLE</STitle>
        <SDesc>Select cycle or run analysis — cycle is auto-suggested from live 1D RSI.</SDesc>
        <div style={{ display:"flex", gap:10 }}>
          {[
            { val:"bear", icon:"❄", title:"BEAR WEEK", sub:"ACCUMULATION · DISCOUNT · BUYER",  color:BLUE   },
            { val:"bull", icon:"☀", title:"BULL WEEK", sub:"DISTRIBUTION · PREMIUM · SELLER", color:ORANGE },
          ].map(opt => (
            <button key={opt.val} onClick={() => handleCycleChange(opt.val)} style={{
              flex:1, padding:"18px 10px",
              border:`2px solid ${cycle === opt.val ? opt.color : BORDER}`,
              background: cycle === opt.val ? `${opt.color}10` : PANEL,
              color: cycle === opt.val ? opt.color : DIM,
              borderRadius:4, fontFamily:"'IBM Plex Mono', monospace",
              fontSize:12, fontWeight:700, letterSpacing:"0.12em",
              cursor:"pointer", WebkitTapHighlightColor:"transparent",
              transition:"all 0.15s",
            }}>
              <div style={{ fontSize:20, marginBottom:6 }}>{opt.icon}</div>
              <div>{opt.title}</div>
              <div style={{ fontSize:9, fontWeight:400, marginTop:5, opacity:0.65, letterSpacing:"0.08em" }}>{opt.sub}</div>
              {data?.suggested_cycle === opt.val && (
                <div style={{ marginTop:8, fontSize:8, color:opt.color, letterSpacing:"0.12em", background:`${opt.color}15`, padding:"2px 6px", borderRadius:2 }}>
                  ⚡ RSI SUGGESTS
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Live stat pills */}
        {data && (
          <div style={{ marginTop:12, display:"flex", gap:6, flexWrap:"wrap" }}>
            {[
              { label:"1D RSI",   val:data.daily_rsi?.toFixed(1),       flag: data.daily_rsi<=40 ? BLUE : data.daily_rsi>=70 ? ORANGE : MID },
              { label:"8H RSI",   val:data.rsi_8h?.toFixed(1),          flag: data.rsi_8h<=40 ? BLUE : data.rsi_8h>=70 ? ORANGE : MID     },
              { label:"4H STOCH", val:data.stoch_4h?.toFixed(0),        flag: data.stoch_4h<25 ? BLUE : data.stoch_4h>75 ? ORANGE : MID   },
              { label:"MACD",     val:data.macd_rising ? "▲ BULL" : data.macd_falling ? "▼ BEAR" : "FLAT", flag: data.macd_rising ? GREEN : data.macd_falling ? RED : MID },
            ].map(r => (
              <div key={r.label} style={{ flex:1, minWidth:60, background:PANEL2, border:`1px solid ${BORDER}`, padding:"7px 6px", borderRadius:3, textAlign:"center" }}>
                <div style={{ fontSize:8, color:DIM, letterSpacing:"0.12em" }}>{r.label}</div>
                <div style={{ fontSize:12, fontWeight:700, color:r.flag, marginTop:3 }}>{r.val}</div>
              </div>
            ))}
          </div>
        )}

        {data?.analysis_summary && (
          <InfoBox color={accent || MID} label="AI ANALYSIS" mt={12}>{data.analysis_summary}</InfoBox>
        )}
        {cycle && !data && (
          <InfoBox color={ORANGE} label="RSI TRIGGER" mt={12}>
            {cycle === "bear" ? "RSI ≤ 40 activates Shopping Mode. Not an entry alone — proof required." : "RSI ≥ 70 activates Distribution Mode. Deploy shorts ONLY after rejection proof."}
          </InfoBox>
        )}
      </div>
    );
  }

  function StructurePanel() {
    const cnt = Object.values(structChecks).filter(Boolean).length;
    return (
      <div style={ps}>
        <PanelHeader num="02" title="MARKET STRUCTURE — THE BATTLEFIELD" />
        <STitle>STEP 2: STRUCTURE</STitle>
        <SDesc>All four must pass. Invalidation is always manual — define your exit before entering.</SDesc>
        {cycle ? (
          <>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {loading
                ? [1,2,3,4].map(i => <SkeletonRow key={i} />)
                : structItems.map(item => (
                  <CheckRow
                    key={item.id}
                    checked={!!structChecks[item.id]}
                    onToggle={() => toggleStruct(item.id)}
                    label={item.label} sub={item.sub}
                    hint={structHint(item.id)}
                    wasAuto={item.auto ? autoSet.struct?.[item.id] : undefined}
                  />
                ))
              }
            </div>
            {!loading && (
              <>
                <div style={{ marginTop:12, display:"flex", alignItems:"center", gap:10 }}>
                  <MiniBar val={cnt} max={4} color={structDone ? accent : DIM} />
                  <span style={{ fontSize:10, color:structDone ? accent : DIM, minWidth:32, letterSpacing:"0.1em" }}>{cnt}/4</span>
                </div>
                <div style={{ marginTop:6, fontSize:10, letterSpacing:"0.1em", color:structDone ? accent : RED }}>
                  {structDone ? "✓ STRUCTURE CONFIRMED" : "✗ COMPLETE ALL FOUR — CHECK INVALIDATION MANUALLY"}
                </div>
              </>
            )}
          </>
        ) : <div style={{ fontSize:11, color:DIM, letterSpacing:"0.1em" }}>← SELECT CYCLE TO UNLOCK</div>}
      </div>
    );
  }

  function ProofPanel() {
    return (
      <div style={ps}>
        <PanelHeader num="03" title="PROOF GATE — CONFIRMATION POOL" />
        <STitle>STEP 3: PROOF</STitle>
        <SDesc>2+ pts OR confirming close. ★ Candle Close = 2pts. Auto-populated from live analysis.</SDesc>
        {cycle ? (
          <>
            {!gatekeepersOk && !loading && (
              <InfoBox color={RED} label="LOCKED">
                Structure gatekeepers required — invalidation + RSI threshold must both be checked.
              </InfoBox>
            )}
            <div style={{ display:"flex", flexDirection:"column", gap:5, marginTop: gatekeepersOk || loading ? 0 : 10 }}>
              {loading
                ? [1,2,3,4,5].map(i => <SkeletonRow key={i} />)
                : confirmItems.map(item => (
                  <CheckRow
                    key={item.id}
                    checked={!!confirmChecks[item.id]}
                    onToggle={() => toggleConfirm(item.id)}
                    label={item.label} sub={item.sub}
                    rightLabel={`+${item.pts}pt${item.pts>1?"s":""}`}
                    hint={confirmHint(item.id)}
                    wasAuto={autoSet.confirm?.[item.id]}
                    disabled={!gatekeepersOk}
                  />
                ))
              }
            </div>
            {gatekeepersOk && !loading && (
              <>
                <div style={{ marginTop:12, display:"flex", alignItems:"center", gap:10 }}>
                  <MiniBar val={confirmPts} max={6} color={confirmPts>=2 ? accent : RED} />
                  <span style={{ fontSize:10, color:confirmPts>=2 ? accent : DIM, minWidth:40, letterSpacing:"0.1em" }}>{confirmPts}/6pt</span>
                </div>
                <div style={{ marginTop:6, fontSize:10, letterSpacing:"0.1em", color:confirmPts>=2 ? accent : RED }}>
                  {confirmPts>=2 ? "✓ PROOF GATE PASSED" : `✗ NEED ${2-confirmPts} MORE PT(S)`}
                </div>
              </>
            )}
          </>
        ) : <div style={{ fontSize:11, color:DIM, letterSpacing:"0.1em" }}>← SELECT CYCLE TO UNLOCK</div>}
      </div>
    );
  }

  function ScorePanel() {
    return (
      <div style={ps}>
        <PanelHeader num="04" title="CONFLUENCE SCORE" />
        <div style={{ display:"flex", gap:14, marginBottom:18 }}>
          <div style={{ minWidth:80 }}>
            <div style={{ fontSize:10, color:DIM, letterSpacing:"0.2em", marginBottom:6 }}>TOTAL SCORE</div>
            <div style={{ fontSize:48, fontWeight:700, color:verdictColor, lineHeight:1 }}>{total}</div>
            <div style={{ fontSize:11, color:DIM, marginTop:2 }}>/100</div>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, color:DIM, letterSpacing:"0.2em", marginBottom:6 }}>DECISION</div>
            <div style={{ padding:"13px 11px", border:`2px solid ${verdictColor}`, background:`${verdictColor}0D`, borderRadius:3 }}>
              <div style={{ fontSize:9, color:DIM, letterSpacing:"0.2em", marginBottom:4 }}>ORACLE VERDICT</div>
              <div style={{ fontSize:17, fontWeight:700, color:verdictColor, letterSpacing:"0.1em" }}>{verdict}</div>
            </div>
            {data && <div style={{ marginTop:8, fontSize:10, color:DIM }}>{data.symbol} · <span style={{ color:TEXT, fontWeight:700 }}>{fmtP(data.price)}</span></div>}
          </div>
        </div>
        <div style={{ height:5, background:BORDER, borderRadius:3, marginBottom:12 }}>
          <div style={{ height:"100%", borderRadius:3, width:`${total}%`, background:verdictColor, transition:"width 0.4s ease" }} />
        </div>
        {[{label:"STRUCTURE",val:structScore,max:40},{label:"PROOF/CONFIRM",val:proofScore,max:60}].map(row => (
          <div key={row.label} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:7 }}>
            <div style={{ fontSize:9, color:DIM, letterSpacing:"0.1em", width:100, minWidth:100 }}>{row.label}</div>
            <MiniBar val={row.val} max={row.max} color={accent} />
            <div style={{ fontSize:10, color:MID, width:42, textAlign:"right" }}>{row.val}/{row.max}</div>
          </div>
        ))}
        <Divider />
        <div style={{ display:"flex", gap:6 }}>
          {[
            {range:"85–100",label:"FULL POSITION",color:BLUE,  match:verdict==="FULL POSITION"},
            {range:"70–84", label:"REDUCED",      color:ORANGE,match:verdict==="REDUCED SIZE" },
            {range:"<70",   label:"NO TRADE",     color:RED,   match:verdict==="NO TRADE"     },
          ].map(t => (
            <div key={t.label} style={{ flex:1, padding:"7px 5px", border:`1px solid ${t.match?t.color:BORDER}`, background:t.match?`${t.color}12`:PANEL, borderRadius:3, textAlign:"center", transition:"all 0.2s" }}>
              <div style={{ fontSize:9, color:t.color, letterSpacing:"0.08em" }}>{t.range}</div>
              <div style={{ fontSize:9, color:t.match?t.color:DIM, marginTop:3 }}>{t.label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function LadderPanel() {
    return (
      <div style={ps}>
        <PanelHeader num="05" title="EXECUTION — LADDER TIERS" />
        <STitle>STEP 4: LADDERING</STitle>
        <SDesc>Systematic risk distribution. Average the entry. Remove all-in anxiety.</SDesc>
        {cycle ? (
          <>
            {LADDER[cycle].map((tier, i) => {
              const active = verdict !== "NO TRADE" && (verdict === "FULL POSITION" || i === 0);
              const levelHint = data ? (cycle === "bear"
                ? [fmtP(data.daily_support), fmtP(data.weekly_support), fmtP(data.invalidation_long)][i]
                : [fmtP(data.daily_resistance), fmtP(data.weekly_resistance), fmtP(data.invalidation_short)][i]
              ) : null;
              return (
                <div key={tier.label} style={{ marginBottom:11 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ fontSize:9, color:active?tier.color:DIM, letterSpacing:"0.1em", width:80, minWidth:80 }}>{tier.label}</div>
                    <div style={{ flex:1, height:6, background:BORDER, borderRadius:3 }}>
                      <div style={{ height:"100%", borderRadius:3, width:active?`${tier.pct}%`:"0%", background:tier.color, transition:"width 0.5s ease" }} />
                    </div>
                    <div style={{ fontSize:10, color:active?MID:DIM, width:28, textAlign:"right" }}>{tier.pct}%</div>
                  </div>
                  <div style={{ marginLeft:90, marginTop:2, display:"flex", gap:8, alignItems:"center" }}>
                    <span style={{ fontSize:10, color:active?DIM:"#282828", letterSpacing:"0.04em" }}>{tier.desc}</span>
                    {levelHint && active && levelHint !== "—" && (
                      <span style={{ fontSize:10, color:tier.color, fontFamily:"monospace" }}>~{levelHint}</span>
                    )}
                  </div>
                </div>
              );
            })}
            <InfoBox color={ORANGE} label="ORDER RULES" mt={12}>
              Use limit orders at shelves. No chasing. Set alerts at tiers + invalidation close level.
            </InfoBox>
          </>
        ) : <div style={{ fontSize:11, color:DIM, letterSpacing:"0.1em" }}>← SELECT CYCLE TO VIEW LADDER</div>}
      </div>
    );
  }

  function RulesPanel() {
    return (
      <div style={ps}>
        <PanelHeader num="06" title="RULES OF ENGAGEMENT" />
        {cycle ? (
          <>
            {RULES[cycle].ok.map(r => (
              <div key={r} style={{ display:"flex", gap:10, padding:"8px 0", borderBottom:`1px solid ${BORDER}`, fontSize:12, color:TEXT }}>
                <span style={{ color:accent, minWidth:12, flexShrink:0 }}>✓</span>{r}
              </div>
            ))}
            {RULES[cycle].no.map(r => (
              <div key={r} style={{ display:"flex", gap:10, padding:"8px 0", borderBottom:`1px solid ${BORDER}`, fontSize:12, color:"#884444" }}>
                <span style={{ color:RED, minWidth:12, flexShrink:0 }}>✗</span>FORBIDDEN: {r}
              </div>
            ))}
            <InfoBox color={ORANGE} label="INVALIDATION DOCTRINE" mt={14}>
              {cycle === "bear"
                ? "Long invalidated by: daily/weekly CLOSE below key support shelf. Wicks = noise. Candle closes = truth."
                : "Short invalidated by: daily/weekly CLOSE above key resistance shelf. Wicks = noise. Candle closes = truth."}
            </InfoBox>
          </>
        ) : <div style={{ fontSize:11, color:DIM, letterSpacing:"0.1em" }}>← SELECT CYCLE TO VIEW RULES</div>}
      </div>
    );
  }

  const colStyle = { display:"flex", flexDirection:"column", gap:"1px", flex:1 };

  return (
    <div style={{ background:BG, minHeight:"100vh", color:TEXT, fontFamily:"'IBM Plex Mono', 'Courier New', monospace", display:"flex", flexDirection:"column" }}>

      {/* Header */}
      <div style={{ borderBottom:`1px solid ${BORDER}`, padding:mobile?"12px 14px":"18px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", background:PANEL2, flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontSize:mobile?13:18, fontWeight:700, letterSpacing:"0.15em", color:TEXT }}>
            <span style={{ color:accent }}>◈</span> THE ORACLE STRATEGY
          </div>
          <div style={{ fontSize:9, color:DIM, letterSpacing:"0.18em", marginTop:3 }}>TRADE PLANNER + CONFLUENCE SCORER</div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {cycle && <div style={{ fontSize:9, padding:"3px 8px", border:`1px solid ${accent}`, color:accent, letterSpacing:"0.1em" }}>{cycle==="bear"?"❄ BEAR":"☀ BULL"}</div>}
          <button onClick={reset} style={{ background:"transparent", border:`1px solid ${BORDER}`, color:DIM, padding:"5px 10px", fontFamily:"'IBM Plex Mono', monospace", fontSize:10, letterSpacing:"0.12em", cursor:"pointer" }}>↺ RESET</button>
          <div style={{ fontSize:10, color:DIM, letterSpacing:"0.1em", padding:"3px 7px", border:`1px solid ${BORDER}` }}>v1.2</div>
        </div>
      </div>

      {/* Analysis bar */}
      <div style={{ background:"#0C0C0C", borderBottom:`1px solid ${BORDER}`, padding:mobile?"12px 14px":"14px 28px" }}>
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          <div style={{ fontSize:9, color:DIM, letterSpacing:"0.2em" }}>SYMBOL</div>
          <input
            value={symbol}
            onChange={e => setSymbol(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && handleAnalyze()}
            placeholder="BTC"
            style={{ background:PANEL, border:`1px solid ${BORDER}`, color:TEXT, padding:"8px 12px", fontFamily:"'IBM Plex Mono', monospace", fontSize:13, letterSpacing:"0.1em", width:100, outline:"none", borderRadius:2 }}
          />
          <button
            onClick={handleAnalyze}
            disabled={loading}
            style={{
              background:loading ? BORDER : accent, border:"none",
              color:loading?"#666":"#000", padding:"8px 18px",
              fontFamily:"'IBM Plex Mono', monospace",
              fontSize:11, fontWeight:700, letterSpacing:"0.18em",
              cursor:loading?"not-allowed":"pointer",
              borderRadius:2, transition:"all 0.15s", minWidth:130,
            }}
          >
            {loading ? "⏳ ANALYZING…" : "⚡ ANALYZE"}
          </button>

          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {POPULAR.slice(0, mobile ? 6 : 12).map(s => (
              <button key={s}
                onClick={() => setSymbol(s)}
                style={{
                  background: symbol===s ? `${accent}20` : "transparent",
                  border: `1px solid ${symbol===s ? accent : BORDER}`,
                  color: symbol===s ? accent : DIM,
                  padding:"4px 8px", fontFamily:"'IBM Plex Mono', monospace",
                  fontSize:9, letterSpacing:"0.08em", cursor:"pointer", borderRadius:2,
                }}>{s}</button>
            ))}
          </div>
        </div>

        {/* Loading step indicator */}
        {loading && (
          <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:accent, animation:"pulse 1s infinite" }} />
            <span style={{ fontSize:10, color:MID, letterSpacing:"0.1em" }}>{loadStep}</span>
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
          </div>
        )}

        {error && (
          <div style={{ marginTop:10, fontSize:11, color:RED, letterSpacing:"0.06em", lineHeight:1.6 }}>
            ✗ {error}
            <span style={{ color:MID, display:"block", marginTop:4, fontSize:10 }}>
              Try a popular symbol: BTC · ETH · SOL · AVAX
            </span>
          </div>
        )}

        {data && !loading && (
          <div style={{ marginTop:10, display:"flex", gap:12, flexWrap:"wrap", alignItems:"center" }}>
            <span style={{ fontSize:10, color:MID }}>
              {data.symbol} · <span style={{ color:TEXT, fontWeight:700 }}>{fmtP(data.price)}</span>
            </span>
            {data.suggested_cycle
              ? <span style={{ fontSize:10, color:data.suggested_cycle==="bear"?BLUE:ORANGE, letterSpacing:"0.1em" }}>⚡ SUGGESTED: {data.suggested_cycle.toUpperCase()} WEEK</span>
              : <span style={{ fontSize:10, color:MID }}>RSI: {data.daily_rsi?.toFixed(1)} — Select cycle manually</span>
            }
            <span style={{ fontSize:9, color:DIM }}>via AI analysis</span>
          </div>
        )}
      </div>

      {/* Score strip */}
      <div style={{ background:PANEL2, borderBottom:`1px solid ${BORDER}`, padding:"7px 16px", display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ fontSize:9, color:DIM, letterSpacing:"0.18em", minWidth:46 }}>SCORE</div>
        <div style={{ flex:1, height:3, background:BORDER }}>
          <div style={{ height:"100%", width:`${total}%`, background:verdictColor, transition:"width 0.4s ease" }} />
        </div>
        <div style={{ fontSize:12, fontWeight:700, color:verdictColor, letterSpacing:"0.1em", minWidth:56 }}>{total}/100</div>
        <div style={{ fontSize:10, color:verdictColor, fontWeight:700, letterSpacing:"0.1em" }}>{verdict}</div>
      </div>

      {/* Main grid */}
      <div style={{ display:mobile?"flex":"grid", flexDirection:mobile?"column":undefined, gridTemplateColumns:mobile?undefined:"1fr 1fr", gap:"1px", background:BORDER, flex:1 }}>
        <div style={colStyle}><CyclePanel /><StructurePanel /><ProofPanel /></div>
        <div style={colStyle}><ScorePanel /><LadderPanel /><RulesPanel /></div>
      </div>

      {/* Footer */}
      <div style={{ borderTop:`1px solid ${BORDER}`, padding:"10px 20px", display:"flex", justifyContent:"space-between", background:PANEL2, flexWrap:"wrap", gap:6 }}>
        <div style={{ fontSize:9, color:DIM, letterSpacing:"0.13em" }}>ORACLE STRATEGY · POWERED BY AI ANALYSIS</div>
        <div style={{ fontSize:9, color:DIM, letterSpacing:"0.13em" }}>CYCLE + STRUCTURE + PROOF + LADDERING = TRADE</div>
      </div>
    </div>
  );
}
