import fetch from 'node-fetch';

async function test(symbol) {
  console.log(`\nTesting Strategic Regimes for ${symbol}...`);
  try {
    const response = await fetch('http://localhost:8890/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    const check = (v, label) => {
        console.log(`\n--- ${label} ---`);
        console.log(`Phase: ${v.text.match(/Phase:\*\* (.*)/)?.[1] || 'N/A'}`);
        console.log(`Directive: ${v.text.match(/Directive:\*\* (.*)/)?.[1] || 'N/A'}`);
        const tacticMatch = v.text.match(/### (.*) TACTIC/);
        console.log(`Tactic: ${tacticMatch?.[1] || 'N/A'}`);
        
        const isBear = v.text.includes('ACCUMULATION');
        console.log(`Logic: ${isBear ? 'BUY LOW (Accumulate)' : 'SELL HIGH (Distribute)'}`);
        
        v.tiers.forEach((t, i) => {
            console.log(`Tier ${i+1}: $${t.val.toLocaleString()} (${t.l})`);
        });
    };

    check(data.v1d, "V1D (1-Day Anchor)");
    check(data.v12h, "V12H (12-Hour Scaled)");

  } catch (e) {
    console.error('❌ Test failed:', e.message);
  }
}

await test('BTC');
