const symbol = 'AAPL'
const jan1 = 1704067200 // 2024-01-01
const jan5 = 1704412800 // 2024-01-05

async function test() {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${jan1}&period2=${jan5}&interval=1d`
  try {
    const res = await fetch(url)
    const data = await res.json()
    const result = data.chart?.result?.[0]
    if (result) {
      const prices = result.indicators.quote[0].close
      const validPrice = prices.find(p => p != null)
      console.log(`Price for ${symbol} around Jan 1st:`, validPrice)
    } else {
      console.log('No result found')
    }
  } catch (e) {
    console.error('Error:', e)
  }
}

test()
