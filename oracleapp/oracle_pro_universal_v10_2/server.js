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

console.log(`[BOOT] Oracle Pro Universal v10.1 Starting...`);
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

// 2. Universal Diagnostic API
app.get('/api/debug-files', (req, res) => {
  try {
    const getAllFiles = (dirPath, arrayOfFiles = []) => {
      if (!fs.existsSync(dirPath)) return arrayOfFiles;
      const files = fs.readdirSync(dirPath);
      files.forEach(file => {
        const fullPath = path.join(dirPath, file);
        if (fullPath.includes('node_modules') || fullPath.includes('.git')) return;
        if (fs.statSync(fullPath).isDirectory()) {
          arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else {
          arrayOfFiles.push(fullPath.replace(__dirname, ''));
        }
      });
      return arrayOfFiles;
    };
    res.json({ 
      status: "Universal v10.1 Active",
      root: __dirname, 
      files: getAllFiles(__dirname) 
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3. Resilient Static Serving (Checks dist first, then root)
// This enables One-Click deployment on Render while keeping Namecheap compatibility.
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

// Explicit assets route for extra safety
app.use('/assets', express.static(path.join(__dirname, 'dist', 'assets')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

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

function generateRulesReview(symbol, data, timeframe = "1d", forcedCycle = null) {
    const { price, matrix, macd4h, dailyLevels, weeklyLevels } = data;
    const anchorRsi = timeframe === "1d" ? matrix["1d"].rsi : matrix["12h"].rsi;
    const majorLevels = timeframe === "1d" ? weeklyLevels : dailyLevels;
    const isBear = forcedCycle ? forcedCycle === 'bear' : anchorRsi < 50; 
    let phase, directive, tactic;
    if (isBear) {
        tactic = "ACCUMULATION";
        if (anchorRsi < 35) { phase = "Deep Bear (Value Zone)"; directive = "Aggressive Accumulation"; }
        else { phase = "Bear Recovery"; directive = "Laddered Accumulation"; }
    } else {
        tactic = "DISTRIBUTION";
        if (anchorRsi > 65) { phase = "Euphoric Bull"; directive = "Aggressive Distribution"; }
        else { phase = "Markup Phase"; directive = "Scale Out"; }
    }
    return {
        text: `# ORACLE REVIEW - ${symbol}\n**Phase:** ${phase}\n**Directive:** ${directive}`,
        score: Math.floor(Math.random() * 10),
        verdict: isBear ? "BUY" : "SELL",
        tiers: [{ l: "T1", p: 25, val: price }]
    };
}

async function getBinanceIndicators(inputSymbol, forcedCycle = null) {
    const cleanSymbol = inputSymbol.trim().toUpperCase().replace(/USDT$/, "");
    const binanceSymbol = cleanSymbol + "USDT";
    const fetchKlines = async (s, interval) => {
        const res = await fetch(`https://api.binance.us/api/v3/klines?symbol=${s}&interval=${interval}&limit=500`);
        return await res.json();
    };
    const [d1, h12, h8, h4, w1] = await Promise.all([
        fetchKlines(binanceSymbol, '1d'),
        fetchKlines(binanceSymbol, '12h'),
        fetchKlines(binanceSymbol, '8h'),
        fetchKlines(binanceSymbol, '4h'),
        fetchKlines(binanceSymbol, '1w')
    ]);
    const closes1d = d1.map(k => parseFloat(k[4]));
    const currentPrice = closes1d[closes1d.length - 1];
    return { symbol: cleanSymbol, price: currentPrice, v1d: { text: "Analysis Ready" } };
}

// 7. Resilient Catch-all (Send index.html from dist or root)
app.get('*', (req, res) => {
  const possiblePaths = [
    path.join(__dirname, 'dist', 'index.html'),
    path.join(__dirname, 'index.html')
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return res.sendFile(p);
  }
  res.status(404).send('Oracle Pro Error: index.html not found.');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
