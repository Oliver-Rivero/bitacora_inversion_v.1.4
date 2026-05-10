const yahooFinance = require('yahoo-finance2').default;

async function test(symbol) {
  try {
    const result = await yahooFinance.quoteSummary(symbol, { modules: ['assetProfile', 'summaryProfile', 'fundProfile'] });
    console.log("yahoo-finance2 quoteSummary result:", JSON.stringify(result, null, 2));
  } catch (e) {
    console.log("error:", e);
  }
}

test('2B76.F');
