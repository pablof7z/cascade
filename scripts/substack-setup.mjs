import { chromium } from 'playwright';

const CDP_ENDPOINT = 'http://localhost:9222';

// Connect to Chrome via CDP
async function main() {
  console.log('Connecting to Chrome via CDP...');
  
  const browser = await chromium.connectOverCDP(`http://localhost:9222`);
  
  console.log('Connected to Chrome');
  
  // Get existing pages
  const context = browser.contexts()[0] || await browser.newContext();
  const page = context.pages()[0] || await context.newPage();
  
  // Navigate to Substack
  console.log('Navigating to Substack...');
  await page.goto('https://substack.com', { timeout: 60000 });
  
  // Wait for page to load (domcontentloaded is faster)
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000); // Give it a moment to render
  
  // Take screenshot to see current state
  await page.screenshot({ path: '/tmp/substack-start.png', fullPage: true });
  console.log('Screenshot saved to /tmp/substack-start.png');
  
  // Get page title
  const title = await page.title();
  console.log('Page title:', title);
  
  // Check if we need to sign up or log in
  const snapshot = await page.evaluate(() => {
    return document.body.innerText.substring(0, 2000);
  });
  console.log('Page content preview:');
  console.log(snapshot);
  
  // Return the browser so we can continue working with it
  return { browser, page };
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
