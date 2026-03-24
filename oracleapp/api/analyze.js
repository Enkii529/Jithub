import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fetch } from 'undici'; // Use undici for safe fetch in Node

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ── Technical Indicators Helpers (v13.0 Optimized) ───────────────────────────

function calculateRsiSeries(prices, period = 14) {
    if (prices.length <= period) return [];
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        let d = prices[i] - prices[i - 1];
        if (d >= 0) gains += d; else losses += Math.abs(d);
    }
    let avgG = gains / period, avgL = losses / period;
    const rsi = new Array(prices.length).fill(null);
    rsi[period] = 100 - (100 / (1 + avgG / avgL));
    for (let i = period + 1; i < prices.length; i++) {
        let d = prices[i] - prices[i - 1];
        avgG = (avgG * (period - 1) + (d >= 0 ? d : 0)) / period;
        avgL = (avgL * (period - 1) + (d < 0 ? Math.abs(d) : 0)) / period;
        rsi[i] = 100 - (100 / (1 + avgG / avgL));
    }
    return rsi;
}

function calculateStochRsiSeries(rsiValues, period = 14) {
    const raw = new Array(rsiValues.length).fill(null);
    for (let i = 0; i < rsiValues.length; i++) {
        const slice = rsiValues.slice(i - period + 1, i + 1).filter(v => v !== null);
        if (slice.length < period) continue;
        const minV = Math.min(...slice), maxV = Math.max(...slice);
        raw[i] = maxV === minV ? 100 : ((rsiValues[i] - minV) / (maxV - minV)) * 100;
    }
    return raw;
}

function macd(data) {
    const ema = (d, p) => {
        let k = 2 / (p + 1); if (d.length === 0) return [];
        let r = [d[0]];
        for (let i = 1; i < d.length; i++) r.push(d[i] * k + r[i - 1] * (1 - k));
        return r;
    };
    const eF = ema(data, 12), eS = ema(data, 26);
    const mLine = eF.map((v, i) => v - eS[i]);
    const sLine = ema(mLine.slice(26), 9);
    const curM = mLine[mLine.length - 1], curS = sLine[sLine.length - 1];
    return { histogram: curM - curS, rising: (curM - curS) > (mLine[mLine.length - 2] - (sLine[sLine.length - 2] || 0)) };
}

function generateRulesReview(symbol, data, timeframe = "1d", forcedCycle = null) {
    const { price, matrix } = data;
    const rsi = timeframe === "1d" ? matrix["1d"].rsi : matrix["4h"].rsi;
    const isBear = forcedCycle ? forcedCycle === 'bear' : rsi < 50; 
    const v = isBear ? "ACCUMULATION" : "DISTRIBUTION";
    const tiers = [{ l: "T1 STARTER", p: 25, val: price }, { l: "T2 CORE", p: 45, val: price * (isBear ? 0.95 : 1.05) }, { l: "T3 DEFENSE", p: 30, val: price * (isBear ? 0.90 : 1.10) }];
    return { text: `# ORACLE REVIEW - ${symbol}\n**Regime:** ${v}\n**Price:** $${price.toLocaleString()}`, score: 7, verdict: v, tiers };
}

async function getBinanceIndicators(sym, forcedCycle = null) {
    const cleanSym = sym.trim().toUpperCase().replace(/USDT$/, "");
    const fetchK = async (s, i) => {
        const res = await fetch(`https://api.binance.us/api/v3/klines?symbol=${s}USDT&interval=${i}&limit=500`);
        const d = await res.json();
        if (!Array.isArray(d)) throw new Error(d.msg || "Binance fetch failed");
        return d;
    };
    
    console.log(`[API] 🌐 Fetching data for ${cleanSym}...`);
    const [d1, h4, w1] = await Promise.all([fetchK(cleanSym, '1d'), fetchK(cleanSym, '4h'), fetchK(cleanSym, '1w')]);
    
    const cl1d = d1.map(k => parseFloat(k[4]));
    const cl4h = h4.map(k => parseFloat(k[4]));
    const curP = cl1d[cl1d.length - 1];
    
    const rsi1d = calculateRsiSeries(cl1d).pop();
    const stoch4h = calculateStochRsiSeries(calculateRsiSeries(cl4h)).pop();
    const ind1d = { rsi: rsi1d, stochRsi: 50 };
    const matrix = { "1d": ind1d, "12h": ind1d, "8h": ind1d, "4h": { rsi: 50, stochRsi: stoch4h } };
    const mcd4h = macd(cl4h);
    
    const support = Math.min(...d1.slice(-14).map(k => parseFloat(k[3])));
    const common = { price: curP, matrix };
    const v1d = generateRulesReview(cleanSym, common, "1d", forcedCycle);

    return { 
        symbol: cleanSym, price: curP, v1d, v12h: v1d, matrix, 
        daily_rsi: rsi1d, stoch_4h: stoch4h,
        stoch_turning_up: stoch4h < 25 && mcd4h.rising,
        stoch_turning_down: stoch4h > 75 && !mcd4h.rising,
        macd_rising: mcd4h.rising, macd_falling: !mcd4h.rising,
        volume_above_avg: true, weekly_support: support, daily_support: support,
        bullish_divergence_4h: false, bearish_divergence_4h: false
    };
}

// ── Vercel Function Handler ─────────────────────────────────────────────

app.post('/api/analyze', async (req, res) => {
    const { symbol, cycle } = req.body;
    if (!symbol) return res.status(400).json({ error: "Symbol required" });
    try {
        const data = await getBinanceIndicators(symbol, cycle);
        res.json(data);
    } catch (e) {
        console.error(`[API] Error: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

// For local testing (NOT used by Vercel)
if (process.env.NODE_ENV !== 'production') {
    const PORT = 8891;
    app.listen(PORT, () => console.log(`Local test api at http://localhost:${PORT}/api/analyze`));
}

export default app;
