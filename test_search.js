async function test(symbol) {
  const searchUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${symbol}`
  const searchRes = await fetch(searchUrl);
  const searchData = await searchRes.json();
  const quote = searchData.quotes[0];
  if (!quote) {
    console.log(symbol, "No quote found");
    return;
  }
  console.log(symbol, "Sector:", quote.sector || quote.sectorDisp || "Not found", "Quote Type:", quote.quoteType, "Exchange:", quote.exchDisp);
}

async function run() {
  await test('AAPL');
  await test('2B76.F');
  await test('IE00BYX5NX33.SG');
}
run();
