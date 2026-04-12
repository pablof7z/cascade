import { chromium } from 'playwright';

async function testProfile() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  
  const urls = [
    { url: 'http://localhost:5173/u/09d48a1a5dbe13404a10db13b23b3e7b6db62ea3848e83904cbae6c00cbc0f5b', name: 'hex-pubkey' },
    { url: 'http://localhost:5173/u/npub1p843t8wx3fwqxhxfre42m8k7nfv8qwxpfp9ql9lxdm0jn7c2msq8ldejl', name: 'npub-format' },
    { url: 'http://localhost:5173/u/0000000000000000000000000000000000000000000000000000000000000001', name: 'unknown-pubkey' }
  ];
  
  const results = [];
  
  for (const { url, name } of urls) {
    consoleErrors.length = 0;
    
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(3000);
      
      const hasSpinner = await page.$('[class*="spinner"], [class*="loading"]');
      const headerText = await page.$eval('h1', el => el.textContent).catch(() => 'No h1 found');
      const hasMarketsTab = await page.$eval('text=Markets', () => true).catch(() => false);
      const hasPositionsTab = await page.$eval('text=Positions', () => true).catch(() => false);
      
      const bgColor = await page.$eval('body', el => 
        window.getComputedStyle(el).backgroundColor
      ).catch(() => 'unknown');
      
      const tabElement = await page.$('.border-b');
      let tabStyle = 'not found';
      if (tabElement) {
        const style = await tabElement.evaluate(el => {
          const cs = window.getComputedStyle(el);
          return cs.borderBottom && cs.borderBottom !== 'none' ? 'underline' : 'other';
        });
        tabStyle = style;
      }
      
      const hasRoundedPills = await page.$eval('button, [role="tab"]', el => {
        const cs = window.getComputedStyle(el);
        const radius = cs.borderRadius;
        return radius && radius !== '0px' && !radius.includes('0 ');
      }).catch(() => false);
      
      await page.screenshot({ path: '/tmp/screenshot-' + name + '.png', fullPage: true });
      
      results.push({
        name,
        loaded: true,
        hasSpinner: !!hasSpinner,
        headerText: headerText.substring(0, 100),
        hasMarketsTab,
        hasPositionsTab,
        bgColor,
        tabStyle,
        hasRoundedPills,
        consoleErrors: [...consoleErrors]
      });
    } catch (error) {
      results.push({
        name,
        loaded: false,
        error: error.message
      });
    }
  }
  
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}

testProfile().catch(console.error);
