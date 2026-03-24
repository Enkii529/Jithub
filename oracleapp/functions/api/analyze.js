// ── Technical Indicators Helpers ─────────────────────────────────────────────

function rsi(data, period = 14) {
    if (data.length <= period) return null;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        let diff = data[i] - data[i - 1];
        if (diff >= 0) gains += diff; else losses += Math.abs(diff);
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    for (let i = period + 1; i < data.length; i++) {
        let diff = data[i] - data[i - 1];
        avgGain = (avgGain * (period - 1) + (diff >= 0 ? diff : 0)) / period;
        avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
    }
    return 100 - (100 / (1 + avgGain / avgLoss));
}

function stochRsi(rsiValues, period = 14) {
    if (rsiValues.length < period) return null;
    const currentRSI = rsiValues[rsiValues.length - 1];
    const sliced = rsiValues.slice(-period);
    const minRSI = Math.min(...sliced);
    const maxRSI = Math.max(...sliced);
    if (maxRSI === minRSI) return 100;
    return (currentRSI - minRSI) / (maxRSI - minRSI) * 100;
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
    const prevSignal = signalLine[macdLine.length - slow - 1]; 
    return { 
        line: currentMACD, 
        signal: currentSignal, 
        histogram: currentMACD - currentSignal,
        rising: (currentMACD - currentSignal) > (prevMACD - prevSignal)
    };
}

async function getBinanceIndicators(inputSymbol) {
    const cleanSymbol = inputSymbol.trim().toUpperCase().replace(/USDT$/, "");
    const binanceSymbol = cleanSymbol + "USDT";

    const fetchKlines = async (s, interval, limit = 100) => {
        const res = await fetch(`https://api.binance.us/api/v3/klines?symbol=${s}&interval=${interval}&limit=${limit}`);
        const data = await res.json();
        if (!Array.isArray(data)) {
            throw new Error(data.msg || `Binance error for ${s}`);
        }
        return data;
    };

    const [d1, h8, h4, w1] = await Promise.all([
        fetchKlines(binanceSymbol, '1d'),
        fetchKlines(binanceSymbol, '8h'),
        fetchKlines(binanceSymbol, '4h'),
        fetchKlines(binanceSymbol, '1w')
    ]);

    const closes1d = d1.map(k => parseFloat(k[4]));
    const closes8h = h8.map(k => parseFloat(k[4]));
    const closes4h = h4.map(k => parseFloat(k[4]));
    const currentPrice = closes1d[closes1d.length - 1];

    const dailyRsi = rsi(closes1d);
    const rsi8h = rsi(closes8h);
    const rsi4hHistory = [];
    for (let i = 40; i <= closes4h.length; i++) {
        rsi4hHistory.push(rsi(closes4h.slice(0, i)));
    }
    const stoch4h = stochRsi(rsi4hHistory);
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

    let summary = `${cleanSymbol} is trading at ${currentPrice}. `;
    if (dailyRsi <= 42) summary += "Daily RSI is oversold, indicating a potential bottoming structure. ";
    else if (dailyRsi >= 68) summary += "Daily RSI is overbought, suggesting distribution is underway. ";
    else summary += "Market is in a neutral range. ";

    return {
        symbol: cleanSymbol,
        price: currentPrice,
        daily_rsi: dailyRsi,
        rsi_8h: rsi8h,
        stoch_4h: stoch4h,
        stoch_turning_up: stoch4h < 30 && macd4h.rising,
        stoch_turning_down: stoch4h > 70 && !macd4h.rising,
        macd_histogram_4h: macd4h.histogram,
        macd_rising: macd4h.rising,
        macd_falling: !macd4h.rising,
        bullish_divergence_4h: closes4h[closes4h.length-1] < closes4h[closes4h.length-10] && rsi(closes4h) > rsi(closes4h.slice(0,-10)),
        bearish_divergence_4h: closes4h[closes4h.length-1] > closes4h[closes4h.length-10] && rsi(closes4h) < rsi(closes4h.slice(0,-10)),
        volume_above_avg: parseFloat(h4[h4.length-1][5]) > (h4.slice(-20).reduce((a, b) => a + parseFloat(b[5]), 0) / 20),
        volume_below_avg: parseFloat(h4[h4.length-1][5]) < (h4.slice(-20).reduce((a, b) => a + parseFloat(b[5]), 0) / 20),
        weekly_support: weeklyLevels.support,
        weekly_resistance: weeklyLevels.resistance,
        daily_support: dailyLevels.support,
        daily_resistance: dailyLevels.resistance,
        invalidation_long: dailyLevels.support * 0.98,
        invalidation_short: dailyLevels.resistance * 1.02,
        bull_candle_reclaim: false,
        bear_candle_failbreak: false,
        suggested_cycle: dailyRsi <= 42 ? 'bear' : dailyRsi >= 68 ? 'bull' : null,
        analysis_summary: summary
    };
}

export async function onRequestPost({ request }) {
    try {
        const { symbol } = await request.json();
        const marketData = await getBinanceIndicators(symbol);
        
        return new Response(JSON.stringify(marketData), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
