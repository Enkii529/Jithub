import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// 1. Reconstruct __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const staticPath = __dirname;

console.log(`[BOOT] Oracle Pro Backend v7.0 (FLAT) Starting...`);
console.log(`[BOOT] Root Directory: ${__dirname}`);

const app = express();
const PORT = process.env.PORT || 8890;

app.use(cors());
app.use(express.json());

// 1.2 Supreme CSP Headers (Safety Fallback)
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://cloudflareinsights.com;");
  next();
});

// 1.5 High-Priority API Routes (Must be top of stack)
app.post(['/api/analyze', '*/api/analyze', '**/api/analyze'], async (req, res) => {
  const { symbol, cycle } = req.body;
  console.log(`[API] Analyze Request - Symbol: ${symbol}, Cycle Override: ${cycle}`);
  try {
    const marketData = await getBinanceIndicators(symbol.toUpperCase(), cycle);
    res.json(marketData);
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 2. High-Priority Diagnostic API (Must be before static)
import fs from 'fs';
app.get('/api/debug-files', (req, res) => {
  const listFiles = (dir, list = []) => {
    try {
      if (!fs.existsSync(dir)) return list;
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fullPath.includes('node_modules')) return;
        if (fs.statSync(fullPath).isDirectory()) {
          listFiles(fullPath, list);
        } else {
          list.push(fullPath.replace(__dirname, ''));
        }
      });
    } catch(e) { list.push("Error: " + e.message); }
    return list;
  };
  res.json({ 
    files: listFiles(__dirname), 
    __dirname: __dirname,
    message: "v7.0 FLAT DEPLOYMENT active."
  });
});

// 3. Force MIME type for JS/CSS
app.use((req, res, next) => {
  if (req.url.endsWith('.js')) res.type('application/javascript');
  if (req.url.endsWith('.css')) res.type('text/css');
  next();
});

// 4. Flat Static Serving (Check root and /assets)
app.use(express.static(__dirname));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// ── Technical Indicators Helpers ─────────────────────────────────────────────

// ── Technical Indicators Helpers ─────────────────────────────────────────────

function calculateRsiSeries(prices, period = 14) {
    if (prices.length <= period) return [];
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        let diff = prices[i] - prices[i - 1];
        if (diff >= 0) gains += diff; else losses += Math.abs(diff);
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    const rsiValues = new Array(prices.length).fill(null);
    rsiValues[period] = 100 - (100 / (1 + avgGain / avgLoss));
    
    for (let i = period + 1; i < prices.length; i++) {
        let diff = prices[i] - prices[i - 1];
        avgGain = (avgGain * (period - 1) + (diff >= 0 ? diff : 0)) / period;
        avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
        rsiValues[i] = 100 - (100 / (1 + avgGain / avgLoss));
    }
    return rsiValues;
}

function calculateStochRsiSeries(rsiValues, period = 14, smoothK = 3) {
    const stochRsiRaw = new Array(rsiValues.length).fill(null);
    for (let i = 0; i < rsiValues.length; i++) {
        const start = i - period + 1;
        if (start < 0) continue;
        const slice = rsiValues.slice(start, i + 1);
        const validValues = slice.filter(v => v !== null);
        if (validValues.length < period) continue;
        
        const minRsi = Math.min(...validValues);
        const maxRsi = Math.max(...validValues);
        const currentRsi = rsiValues[i];
        
        if (maxRsi === minRsi) stochRsiRaw[i] = 100;
        else stochRsiRaw[i] = ((currentRsi - minRsi) / (maxRsi - minRsi)) * 100;
    }
    
    // Apply SMA Smoothing (K line)
    const stochRsiSmooth = new Array(rsiValues.length).fill(null);
    for (let i = 0; i < stochRsiRaw.length; i++) {
        const start = i - smoothK + 1;
        if (start < 0) continue;
        const slice = stochRsiRaw.slice(start, i + 1);
        const validValues = slice.filter(v => v !== null);
        if (validValues.length < smoothK) continue;
        
        stochRsiSmooth[i] = validValues.reduce((a, b) => a + b, 0) / smoothK;
    }
    
    return stochRsiSmooth;
}

function macd(data, fast = 12, slow = 26, signal = 9) {
    const ema = (d, p) => {
        let k = 2 / (p + 1);
        if (d.length === 0) return [];
        let emaArr = [d[0]];
        for (let i = 1; i < d.length; i++) emaArr.push(d[i] * k + emaArr[i - 1] * (1 - k));
        return emaArr;
    };
    const emaFast = ema(data, fast);
    const emaSlow = ema(data, slow);
    const macdLine = emaFast.map((v, i) => v - emaSlow[i]);
    const signalLine = ema(macdLine.slice(slow), signal);
    const currentMACD = macdLine[macdLine.length - 1];
    const currentSignal = signalLine[signalLine.length - 1];
    const prevMACD = macdLine[macdLine.length - 2];
    const prevSignal = signalLine[macdLine.length - slow - 1] || signalLine[signalLine.length - 2];
    return { 
        line: currentMACD, 
        signal: currentSignal, 
        histogram: currentMACD - currentSignal,
        rising: (currentMACD - currentSignal) > (prevMACD - (prevSignal || 0))
    };
}

// ── Binance API fetcher ──────────────────────────────────────────────────────

// ── AI Analysis Helper ──────────────────────────────────────────────────────

// ── Rules-Based Strategic Engine ──────────────────────────────────────────────

function generateRulesReview(symbol, data, timeframe = "1d", forcedCycle = null) {
    const { price, matrix, macd4h, dailyLevels, weeklyLevels, h8Levels, h4Levels } = data;
    
    // Choose anchor RSI and levels based on timeframe
    const anchorRsi = timeframe === "1d" ? matrix["1d"].rsi : matrix["12h"].rsi;
    const majorLevels = timeframe === "1d" ? weeklyLevels : dailyLevels;
    const minorLevels = timeframe === "1d" ? dailyLevels : h8Levels || h4Levels;
    const stoch4h = matrix["4h"].stochRsi;

    // Determine Logic Path: Honor user selection from Wizard, else fallback to RSI
    const isBear = forcedCycle ? forcedCycle === 'bear' : anchorRsi < 50; 

    // 1. CYCLE & REGIME
    let phase, directive, tactic;
    if (isBear) {
        tactic = "ACCUMULATION";
        if (anchorRsi < 35) {
            phase = `Deep Bear (Value Zone) - ${timeframe.toUpperCase()}`;
            directive = "Aggressive Accumulation - Buy the Fear";
        } else {
            phase = `Bear Weeks (Recovery Floor) - ${timeframe.toUpperCase()}`;
            directive = "Laddered Accumulation - Buying the Dips";
        }
    } else {
        tactic = "DISTRIBUTION";
        if (anchorRsi > 65) {
            phase = `Overextended Bull (Sell Zone) - ${timeframe.toUpperCase()}`;
            directive = "Aggressive Distribution - Sell the Euphoria";
        } else {
            phase = `Bull Weeks (Markup Phase) - ${timeframe.toUpperCase()}`;
            directive = "Scale Out - Selling the Rips";
        }
    }

    const invalidation = isBear ? minorLevels.support * 0.96 : minorLevels.resistance * 1.04;

    // 2. THE TACTICAL MAP
    const battleground = price > majorLevels.resistance ? `Distributing above ${timeframe === "1d" ? 'weekly' : 'daily'} ceiling.` : 
                         price < majorLevels.support ? `Accumulating near ${timeframe === "1d" ? 'weekly' : 'daily'} floor.` : 
                         "Operating within structure limits.";
    
    const rangeLow = Math.min(minorLevels.support, majorLevels.support);
    const rangeHigh = Math.max(minorLevels.resistance, majorLevels.resistance);

    // 3. INDICATOR PROOF
    const rsiSentiment = anchorRsi > 65 ? "Extreme Overbought (Sell High)" : anchorRsi < 35 ? "Extreme Oversold (Buy Low)" : "Neutral Momentum";
    const macdStatus = macd4h.histogram > 0 ? (macd4h.rising ? "Bullish growth" : "Bullish fatigue") : (macd4h.rising ? "Bearish recovery" : "Bearish growth");

    // 4. EXECUTION LADDER - Strict Price Boundaries
    // Bear = Buying AT OR BELOW current price.
    // Bull = Selling AT OR ABOVE current price.
    let tier1, tier2, tier3;
    if (isBear) {
        tier1 = Math.min(price, minorLevels.support); 
        tier2 = Math.min(price, majorLevels.support);
        tier3 = Math.min(price, invalidation);
    } else {
        tier1 = Math.max(price, minorLevels.resistance);
        tier2 = Math.max(price, majorLevels.resistance);
        tier3 = Math.max(price, invalidation);
    }

    // 5. CONFLUENCE SCORE
    let score = 0;
    if (isBear) {
        if (anchorRsi < 40) score += 3;
        if (macd4h.rising) score += 2;
        if (stoch4h < 25) score += 2;
        if (price <= minorLevels.support * 1.02) score += 3;
    } else {
        if (anchorRsi > 60) score += 3;
        if (!macd4h.rising) score += 2; // Fatigue is good for selling
        if (stoch4h > 75) score += 2;
        if (price >= minorLevels.resistance * 0.98) score += 3;
    }
    
    const decision = score >= 8 ? "PRIME OPPORTUNITY" : score >= 5 ? "SCALABLE POSITION" : "NEUTRAL / WAIT";

    return {
        text: `
# ORACLE REVIEW (${timeframe.toUpperCase()}) - ${symbol}

## 1. CYCLE & REGIME
- **Phase:** ${phase}
- **Directive:** ${directive}
- **Invalidation:** Daily Close ${isBear ? 'below' : 'above'} $${invalidation.toLocaleString(undefined, {minimumFractionDigits: 2})}

## 2. THE TACTICAL MAP
- **Battleground:** ${battleground}
- **Active Range:** $${rangeLow.toLocaleString()} - $${rangeHigh.toLocaleString()}
- **Shelves:** 
  - **Sell Shelf:** $${minorLevels.resistance.toLocaleString()} - $${majorLevels.resistance.toLocaleString()}
  - **Buy Shelf:** $${majorLevels.support.toLocaleString()} - $${minorLevels.support.toLocaleString()}

## 3. INDICATOR PROOF (TIMING)
- **RSI (${timeframe.toUpperCase()}):** ~${anchorRsi.toFixed(1)}. ${rsiSentiment}
- **MACD:** ${macdStatus} on 4H timeframe.
- **Volume:** Absorbtion trend stable.

## 4. EXECUTION LADDER
### ${tactic} TACTIC (${isBear ? 'BUYING LOW' : 'SELLING HIGH'})
1. **Tier 1 (25%):** $${tier1.toLocaleString()} - Immediate Reclaim Zone
2. **Tier 2 (45%):** $${tier2.toLocaleString()} - Macro Structural Liquidity
3. **Tier 3 (30%):** $${tier3.toLocaleString()} - Deep Guard / Invalidation

## 5. CONFLUENCE SCORE
- **Score:** ${score}/10
- **Decision:** ${decision}
`,
        score,
        verdict: decision,
        tiers: [
            { l: "T1 STARTER", p: 25, val: tier1 },
            { l: "T2 CORE", p: 45, val: tier2 },
            { l: "T3 DEFENSE", p: 30, val: tier3 }
        ]
    };
}

function baseSentiment(rsi) {
    if (rsi > 65) return "Overextended premium zones.";
    if (rsi > 55) return "Bullish strength reclaiming.";
    if (rsi < 35) return "Capitulation value zone.";
    if (rsi < 45) return "Bearish recovery phase.";
    return "Neutral balance zone.";
}

// ── Binance API fetcher ──────────────────────────────────────────────────────

async function getBinanceIndicators(inputSymbol, forcedCycle = null) {
    console.log(`Analyzing ${inputSymbol}...`);
    const cleanSymbol = inputSymbol.trim().toUpperCase().replace(/USDT$/, "");
    const binanceSymbol = cleanSymbol + "USDT";

    const fetchKlines = async (s, interval, limit = 500) => {
        console.log(`Fetching ${interval} klines for ${s} (binance.us)...`);
        const res = await fetch(`https://api.binance.us/api/v3/klines?symbol=${s}&interval=${interval}&limit=${limit}`);
        const data = await res.json();
        if (!Array.isArray(data)) {
            throw new Error(data.msg || `Binance error for ${s} on ${interval} interval`);
        }
        return data;
    };

    const getIndicatorsForInterval = (klines, label) => {
        console.log(`Calculating indicators for ${label}...`);
        const closes = klines.map(k => parseFloat(k[4]));
        const rsiSeries = calculateRsiSeries(closes);
        const stochRsiSeries = calculateStochRsiSeries(rsiSeries);
        
        return { 
            rsi: rsiSeries[rsiSeries.length - 1], 
            stochRsi: stochRsiSeries[stochRsiSeries.length - 1] 
        };
    };

    try {
        const [d1, h12, h8, h4, w1] = await Promise.all([
            fetchKlines(binanceSymbol, '1d'),
            fetchKlines(binanceSymbol, '12h'),
            fetchKlines(binanceSymbol, '8h'),
            fetchKlines(binanceSymbol, '4h'),
            fetchKlines(binanceSymbol, '1w')
        ]);

        const closes1d = d1.map(k => parseFloat(k[4]));
        const closes4h = h4.map(k => parseFloat(k[4]));
        const currentPrice = closes1d[closes1d.length - 1];

        const ind1d = getIndicatorsForInterval(d1, "1d");
        const ind12h = getIndicatorsForInterval(h12, "12h");
        const ind8h = getIndicatorsForInterval(h8, "8h");
        const ind4h = getIndicatorsForInterval(h4, "4h");

        const macd4h = macd(closes4h);

        const findLevels = (klines) => {
            const highs = klines.map(k => parseFloat(k[2]));
            const lows = klines.map(k => parseFloat(k[3]));
            return {
                support: Math.min(...lows.slice(-14)),
                resistance: Math.max(...highs.slice(-14))
            };
        };

        const dailyLevels = findLevels(d1);
        const weeklyLevels = findLevels(w1);
        const h8Levels = findLevels(h8);
        const h4Levels = findLevels(h4);

        const v1d = generateRulesReview(cleanSymbol, {
            price: currentPrice,
            matrix: { "1d": ind1d, "12h": ind12h, "8h": ind8h, "4h": ind4h },
            macd4h,
            dailyLevels,
            weeklyLevels
        }, "1d", forcedCycle);

        const v12h = generateRulesReview(cleanSymbol, {
            price: currentPrice,
            matrix: { "1d": ind1d, "12h": ind12h, "8h": ind8h, "4h": ind4h },
            macd4h,
            dailyLevels: h8Levels,
            weeklyLevels: dailyLevels, // For 12H version, daily is the "major" anchor
            h8Levels,
            h4Levels
        }, "12h", forcedCycle);

        // Summary Generator (Legacy fallback)
        let summary = `${cleanSymbol} is trading at ${currentPrice}. `;
        if (ind1d.rsi <= 40) summary += "Daily RSI is oversold. ";
        else if (ind1d.rsi >= 60) summary += "Daily RSI is overbought. ";

        return {
            symbol: cleanSymbol,
            price: currentPrice,
            matrix: { "1d": ind1d, "12h": ind12h, "8h": ind8h, "4h": ind4h },
            v1d,
            v12h,
            // Legacy fields for Step logic (linked to 1D by default)
            daily_rsi: ind1d.rsi,
            stoch_4h: ind4h.stochRsi,
            stoch_turning_up: ind4h.stochRsi < 30 && macd4h.rising,
            stoch_turning_down: ind4h.stochRsi > 70 && !macd4h.rising,
            macd_histogram_4h: macd4h.histogram,
            macd_rising: macd4h.rising,
            macd_falling: !macd4h.rising,
            bullish_divergence_4h: closes4h[closes4h.length-1] < closes4h[closes4h.length-10] && ind4h.rsi > calculateRsiSeries(closes4h.slice(0,-10)).pop(),
            bearish_divergence_4h: closes4h[closes4h.length-1] > closes4h[closes4h.length-10] && ind4h.rsi < calculateRsiSeries(closes4h.slice(0,-10)).pop(),
            volume_above_avg: parseFloat(h4[h4.length-1][5]) > (h4.slice(-20).reduce((a, b) => a + parseFloat(b[5]), 0) / 20),
            volume_below_avg: parseFloat(h4[h4.length-1][5]) < (h4.slice(-20).reduce((a, b) => a + parseFloat(b[5]), 0) / 20),
            weekly_support: weeklyLevels.support,
            weekly_resistance: weeklyLevels.resistance,
            daily_support: dailyLevels.support,
            daily_resistance: dailyLevels.resistance,
            invalidation_long: dailyLevels.support * 0.98,
            invalidation_short: dailyLevels.resistance * 1.02,
            suggested_cycle: ind1d.rsi <= 42 ? 'bear' : ind1d.rsi >= 68 ? 'bull' : null,
            analysis_summary: summary
        };
    } catch (e) {
        console.error("Binance error:", e);
        throw new Error("Binance API Error: " + e.message);
    }
}

// 3. Catch-all route for React Router (MUST be the very last route)
app.get('*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server v1.2 (Binance Standalone) running on port ${PORT}`);
});
