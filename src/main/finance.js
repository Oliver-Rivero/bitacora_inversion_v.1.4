import { ipcMain } from 'electron'

export function setupFinanceHandlers() {
  ipcMain.handle('finance-get-quotes', async (_, symbols) => {
    try {
      if (!symbols || symbols.length === 0) return []
      
      const promises = symbols.map(async (symbol) => {
        try {
          const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
          const response = await fetch(url)
          const data = await response.json()
          
          if (data.chart?.result?.[0]?.meta) {
            const meta = data.chart.result[0].meta
            return {
              symbol: meta.symbol,
              regularMarketPrice: meta.regularMarketPrice,
              currency: meta.currency,
              shortName: meta.shortName || meta.longName || symbol,
              longName: meta.longName || meta.shortName || symbol
            }
          }
          return null
        } catch (err) {
          console.error(`Error fetching ${symbol}:`, err)
          return null
        }
      })
      
      const results = await Promise.all(promises)
      return results.filter(Boolean)
    } catch (e) {
      console.error('Yahoo Finance Error:', e)
      return []
    }
  })

  ipcMain.handle('finance-get-historical-price', async (_, { symbol, date }) => {
    try {
      const targetDate = new Date(date)
      // Get a window of 7 days around/before the date to find a closing price
      const endTime = Math.floor(targetDate.getTime() / 1000)
      const startTime = endTime - (7 * 24 * 60 * 60)
      
      const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${startTime}&period2=${endTime}&interval=1d`
      const response = await fetch(url)
      const data = await response.json()
      
      const result = data.chart?.result?.[0]
      if (result && result.indicators?.quote?.[0]?.close) {
        const closes = result.indicators.quote[0].close
        // Return the last non-null close price in the window
        for (let i = closes.length - 1; i >= 0; i--) {
          if (closes[i] !== null) return closes[i]
        }
      }
      return null
    } catch (e) {
      console.error(`Historical fetch error for ${symbol}:`, e)
      return null
    }
  })
}
