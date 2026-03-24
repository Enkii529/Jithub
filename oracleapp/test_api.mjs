import fetch from 'node-fetch';

const symbol = 'BTC';
console.log(`Testing Dual-Timeframe /api/analyze for ${symbol}...`);

try {
  const response = await fetch('http://localhost:8890/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol })
  });

  const data = await response.json();
  if (response.ok) {
    console.log('✅ API Success!');
    console.log('Price:', data.price);
    
    console.log('\n--- V1D (1-Day Anchor) ---');
    console.log('Score:', data.v1d.score);
    console.log('Verdict:', data.v1d.verdict);
    console.log('Review Snippet:', data.v1d.text.substring(0, 100) + '...');
    
    console.log('\n--- V12H (12-Hour Scaled) ---');
    console.log('Score:', data.v12h.score);
    console.log('Verdict:', data.v12h.verdict);
    console.log('Review Snippet:', data.v12h.text.substring(0, 100) + '...');
    
    if (data.v1d.text === data.v12h.text) {
        console.warn('⚠️ Warning: V1D and V12H text are identical! Scaling might be broken.');
    } else {
        console.log('✅ Success: Strategic reviews are distinct.');
    }

  } else {
    console.error('❌ API Error:', data.error);
  }
} catch (e) {
  console.error('❌ Fetch failed:', e.message);
}
