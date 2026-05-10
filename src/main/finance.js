import { ipcMain } from 'electron'

export function setupFinanceHandlers() {
  ipcMain.handle('finance-get-quotes', async (_, symbols) => {
    async function fetchWithTimeout(url, timeout = 5000) {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return response;
      } catch (e) {
        clearTimeout(id);
        return null;
      }
    }

    try {
      if (!symbols || symbols.length === 0) return []
      
      const limit = 5
      let index = 0
      const results = []

      async function worker() {
        while (index < symbols.length) {
          const symbol = symbols[index++]
          try {
            const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
            const response = await fetchWithTimeout(url)
            if (!response) continue
            
            const data = await response.json()
            if (data.chart?.result?.[0]?.meta) {
              const meta = data.chart.result[0].meta
              results.push({
                symbol: meta.symbol,
                regularMarketPrice: meta.regularMarketPrice,
                currency: meta.currency,
                shortName: meta.shortName || meta.longName || symbol,
                longName: meta.longName || meta.shortName || symbol
              })
            }
          } catch (err) {
            console.error(`Error fetching ${symbol}:`, err)
          }
        }
      }

      const workers = Array(Math.min(limit, symbols.length)).fill(null).map(() => worker())
      await Promise.all(workers)
      return results
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

  ipcMain.handle('finance-get-metadata', async (_, symbol) => {
    async function fetchWithTimeout(url, timeout = 5000) {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return response;
      } catch (e) {
        clearTimeout(id);
        return null;
      }
    }

    async function fetchFromYahoo(sym) {
      try {
        const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${sym}?modules=assetProfile,summaryProfile,fundProfile`
        const response = await fetchWithTimeout(url);
        if (!response || !response.ok) return null
        
        const data = await response.json()
        const result = data.quoteSummary?.result?.[0]
        if (!result) return null

        const profile = result.assetProfile || result.summaryProfile || result.fundProfile || {}
        
        return {
          symbol: sym,
          sector: profile.sector || (result.fundProfile ? 'Investment Fund' : 'Otros'),
          industry: profile.industry || 'Otros',
          country: profile.country || (profile.region ? profile.region : 'Global'),
          description: profile.longBusinessSummary || profile.description || ''
        }
      } catch (e) { return null; }
    }

    try {
      // 1. Try direct fetch
      let metadata = await fetchFromYahoo(symbol);
      
      // 2. If fails, try searching
      if (!metadata || metadata.sector === 'Otros' || metadata.sector === 'Pendiente de identificar') {
        const searchUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${symbol}`
        const searchRes = await fetchWithTimeout(searchUrl)
        if (searchRes && searchRes.ok) {
          const searchData = await searchRes.json()
          const firstResult = searchData.quotes?.find(q => q.isYahooFinance);
          if (firstResult && firstResult.symbol && firstResult.symbol !== symbol) {
            const retryMetadata = await fetchFromYahoo(firstResult.symbol)
            if (retryMetadata && retryMetadata.sector !== 'Otros' && retryMetadata.sector !== 'Pendiente de identificar') {
              return { ...retryMetadata, symbol: symbol };
            }
          }
        }
      }
      
      return metadata;
    } catch (error) {
      console.error(`Error fetching metadata for ${symbol}:`, error)
      return null
    }
  })
}
