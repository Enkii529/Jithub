import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config();

// 1. Reconstruct __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(`[BOOT] Oracle Pro Universal v10.7 (LAST STAND) Starting...`);

const app = express();
const PORT = process.env.PORT || 8890;

app.use(cors());
app.use(express.json());

// 1.2 Supreme CSP Headers
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://cloudflareinsights.com;");
  next();
});

// 1.5 🚀 THE API Handshake (v10.4 Full Sync Payload)
app.post(['/api/analyze', '*/api/analyze', '**/api/analyze'], async (req, res) => {
  const { symbol, cycle } = req.body;
  console.log(`[API] 🚀 START: Fully Analyzing ${symbol} | Cycle: ${cycle}`);
  try {
    const marketData = await getBinanceIndicators(symbol.toUpperCase(), cycle);
    console.log(`[API] ✅ SUCCESS: Sending complete ${marketData.symbol} payload.`);
    res.json(marketData);
  } catch (error) {
    console.error(`[API] ❌ ERROR:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// 2. Diagnostic API
app.get('/api/debug-files', (req, res) => {
  try {
    const getAllFiles = (d, list = []) => {
      if (!fs.existsSync(d)) return list;
      fs.readdirSync(d).forEach(f => {
        const full = path.join(d, f);
        if (full.includes('node_modules')) return;
        if (fs.statSync(full).isDirectory()) getAllFiles(full, list);
        else list.push(full.replace(__dirname, ''));
      });
      return list;
    };
    res.json({ version: "v10.4 Sync", files: getAllFiles(__dirname) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. Static Serving
const staticFolders = [path.join(__dirname, 'dist'), __dirname];
staticFolders.forEach(folder => {
  if (fs.existsSync(folder)) {
    app.use(express.static(folder, {
      setHeaders: (res, path) => {
        if (path.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
        if (path.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
      }
    }));
  }
});

// ── Technical Indicators Helpers ─────────────────────────────────────────────

function calculateRsiSeries(prices, period = 14) {
    if (prices.length <= period) return [];
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        let diff = prices[i] - prices[i - 1];
        if (diff >= 0) gains += diff; else losses += Math.abs(diff);
    }
    let avgG = gains / period; let avgL = losses / period;
    const rsi = new Array(prices.length).fill(null);
    rsi[period] = 100 - (100 / (1 + avgG / avgL));
    for (let i = period + 1; i < prices.length; i++) {
        let diff = prices[i] - prices[i - 1];
        avgG = (avgG * (period - 1) + (diff >= 0 ? diff : 0)) / period;
        avgL = (avgL * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
        rsi[i] = 100 - (100 / (1 + avgG / avgL));
    }
    return rsi;
}

function calculateStochRsiSeries(rsiValues, period = 14, smoothK = 3) {
    const raw = new Array(rsiValues.length).fill(null);
    for (let i = 0; i < rsiValues.length; i++) {
        const slice = rsiValues.slice(i - period + 1, i + 1).filter(v => v !== null);
        if (slice.length < period) continue;
        const minVal = Math.min(...slice); const maxVal = Math.max(...slice);
        raw[i] = maxVal === minVal ? 100 : ((rsiValues[i] - minVal) / (maxVal - minVal)) * 100;
    }
    const smooth = new Array(rsiValues.length).fill(null);
    for (let i = 0; i < raw.length; i++) {
        const slice = raw.slice(i - smoothK + 1, i + 1).filter(v => v !== null);
        if (slice.length < smoothK) continue;
        smooth[i] = slice.reduce((a, b) => a + b, 0) / smoothK;
    }
    return smooth;
}

function macd(data, fast = 12, slow = 26, signal = 9) {
    const ema = (d, p) => {
        let k = 2 / (p + 1); if (d.length === 0) return [];
        let r = [d[0]];
        for (let i = 1; i < d.length; i++) r.push(d[i] * k + r[i - 1] * (1 - k));
        return r;
    };
    const emaF = ema(data, fast); const emaS = ema(data, slow);
    const mLine = emaF.map((v, i) => v - emaS[i]);
    const sigLine = ema(mLine.slice(slow), signal);
    const curM = mLine[mLine.length - 1]; const curS = sigLine[sigLine.length - 1];
    return { line: curM, signal: curS, histogram: curM - curS, rising: (curM - curS) > (mLine[mLine.length - 2] - (sigLine[sigLine.length - 2] || 0)) };
}

function generateRulesReview(symbol, data, timeframe = "1d", forcedCycle = null) {
    const { price, matrix, macd4h, dailyLevels, weeklyLevels } = data;
    const rsi = timeframe === "1d" ? matrix["1d"].rsi : matrix["12h"].rsi;
    const isBear = forcedCycle ? forcedCycle === 'bear' : rsi < 50; 
    const verdict = isBear ? "ACCUMULATION" : "DISTRIBUTION";
    const tiers = [
        { l: "T1 STARTER", p: 25, val: price },
        { l: "T2 CORE", p: 45, val: price * (isBear ? 0.95 : 1.05) },
        { l: "T3 DEFENSE", p: 30, val: price * (isBear ? 0.90 : 1.10) }
    ];
    return { text: `# ORACLE REVIEW - ${symbol}\n**Regime:** ${verdict}\n**Price:** $${price.toLocaleString()}`, score: 7, verdict, tiers };
}

async function getBinanceIndicators(inputSymbol, forcedCycle = null) {
    const cleanSym = inputSymbol.trim().toUpperCase().replace(/USDT$/, "");
    const binanceSym = cleanSym + "USDT";
    const fetchK = async (s, interval) => {
        const res = await fetch(`https://api.binance.us/api/v3/klines?symbol=${s}&interval=${interval}&limit=500`);
        const d = await res.json();
        if (d.msg) throw new Error(`${interval} fail: ${d.msg}`);
        return d;
    };
    
    const [d1, h12, h8, h4, w1] = await Promise.all([
        fetchK(binanceSym, '1d'), fetchK(binanceSym, '12h'),
        fetchK(binanceSym, '8h'), fetchK(binanceSym, '4h'), fetchK(binanceSym, '1w')
    ]);
    
    const cl1d = d1.map(k => parseFloat(k[4]));
    const cl4h = h4.map(k => parseFloat(k[4]));
    const curP = cl1d[cl1d.length - 1];
    
    const rsi1d = calculateRsiSeries(cl1d).pop();
    const stoch4h = calculateStochRsiSeries(calculateRsiSeries(cl4h)).pop();
    const ind1d = { rsi: rsi1d, stochRsi: 50 };
    const matrix = { "1d": ind1d, "12h": ind1d, "8h": ind1d, "4h": { rsi: 50, stochRsi: stoch4h } };
    const mcd4h = macd(cl4h);
    
    const dLevels = { support: Math.min(...d1.slice(-14).map(k => parseFloat(k[3]))), resistance: Math.max(...d1.slice(-14).map(k => parseFloat(k[2]))) };
    const wLevels = { support: Math.min(...w1.slice(-14).map(k => parseFloat(k[3]))), resistance: Math.max(...w1.slice(-14).map(k => parseFloat(k[2]))) };

    const common = { price: curP, matrix, macd4h: mcd4h, dailyLevels: dLevels, weeklyLevels: wLevels };
    const v1d = generateRulesReview(cleanSym, common, "1d", forcedCycle);

    return { 
        symbol: cleanSym, price: curP, v1d, v12h: v1d, matrix, 
        daily_rsi: rsi1d, 
        stoch_4h: stoch4h,
        stoch_turning_up: stoch4h < 25 && mcd4h.rising,
        stoch_turning_down: stoch4h > 75 && !mcd4h.rising,
        macd_rising: mcd4h.rising,
        macd_falling: !mcd4h.rising,
        volume_above_avg: true,
        weekly_support: wLevels.support,
        daily_support: dLevels.support,
        bullish_divergence_4h: false,
        bearish_divergence_4h: false
    };
}

app.get('*', (req, res) => {
  const p = [path.join(__dirname, 'dist', 'index.html'), path.join(__dirname, 'index.html')].find(f => fs.existsSync(f));
  if (p) return res.sendFile(p);
  res.status(404).send('Oracle Pro Ready.');
});

app.listen(PORT, () => console.log(`[BOOT] Server running on port ${PORT}`));
