async function getCrumb() {
  const cookieRes = await fetch('https://fc.yahoo.com');
  const cookie = cookieRes.headers.get('set-cookie');
  
  const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
    headers: {
      'cookie': cookie,
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  const crumb = await crumbRes.text();
  console.log("Got crumb:", crumb);
  return { crumb, cookie };
}

async function test() {
  try {
    const { crumb, cookie } = await getCrumb();
    const symbol = '2B76.F';
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=assetProfile,summaryProfile,fundProfile&crumb=${crumb}`
    const res = await fetch(url, {
      headers: {
        'cookie': cookie,
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const data = await res.json();
    console.log("quoteSummary result:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.log("error", e);
  }
}

test();
