async function test(symbol) {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}`
  const res = await fetch(url);
  const data = await res.json();
  console.log("chart result:", JSON.stringify(data, null, 2));
}
test('2B76.F');
