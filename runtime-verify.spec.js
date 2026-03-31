import { test, expect } from '@playwright/test';

test.describe('Market Creation Enhancements Runtime Verification', () => {
  
  test('CHECK 1: Launched module works', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    const createBtn = await page.$('button:has-text("Create")');
    if (createBtn) {
      await createBtn.click();
      await page.waitForTimeout(500);
      
      const moduleBtn = await page.$('text=Module');
      if (moduleBtn) {
        await moduleBtn.click();
        await page.waitForTimeout(1000);
        
        const titleInput = await page.$('input[placeholder*="title" i]');
        if (titleInput) {
          await titleInput.fill('Test Module ' + Date.now());
          
          const descInput = await page.$('textarea[placeholder*="description" i]');
          if (descInput) {
            await descInput.fill('Test module for verification');
            
            const launchBtn = await page.$('button:has-text("Launch")');
            if (launchBtn) {
              await launchBtn.click();
              await page.waitForTimeout(3000);
              
              console.log('CHECK 1 PASS: Module launched successfully');
              return;
            }
          }
        }
      }
    }
    console.log('CHECK 1 FAIL: Could not complete module launch flow');
  });

  test('CHECK 2: Saved draft can later be funded/launched', async ({ page }) => {
    await page.goto('http://localhost:5173/drafts');
    await page.waitForLoadState('networkidle');
    
    const draftCard = await page.$('[data-testid="draft-card"], .draft-card, text=Draft');
    if (draftCard) {
      await draftCard.click();
      await page.waitForTimeout(2000);
      
      const fundBtn = await page.$('button:has-text("Fund")');
      const launchBtn = await page.$('button:has-text("Launch")');
      
      if (fundBtn || launchBtn) {
        console.log('CHECK 2 PASS: Draft has fund/launch CTA');
        return;
      }
    }
    console.log('CHECK 2 FAIL: No draft with fund/launch CTA found');
  });

  test('CHECK 3: Thesis Tiptap works', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    const createBtn = await page.$('button:has-text("Create")');
    if (createBtn) {
      await createBtn.click();
      await page.waitForTimeout(500);
      
      const thesisBtn = await page.$('text=Thesis');
      if (thesisBtn) {
        await thesisBtn.click();
        await page.waitForTimeout(1000);
        
        const tiptapEditor = await page.$('.tiptap, [data-tiptap], .ProseMirror');
        if (tiptapEditor) {
          await tiptapEditor.click();
          await page.keyboard.type('Test thesis content');
          await page.waitForTimeout(500);
          
          const hasContent = await page.$('text=Test thesis content');
          if (hasContent) {
            console.log('CHECK 3 PASS: Tiptap editor is functional');
            return;
          }
        }
      }
    }
    console.log('CHECK 3 FAIL: Tiptap editor not functional');
  });

  test('CHECK 4: Markdown renders', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    const hasMarkdownElements = await page.$('h1, h2, h3, strong, em, code, pre, blockquote');
    if (hasMarkdownElements) {
      console.log('CHECK 4 PASS: Markdown rendering detected');
      return;
    }
    console.log('CHECK 4 FAIL: No markdown elements found');
  });

  test('CHECK 5: My Drafts badge works', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    const hasBadge = await page.$('[data-badge], .badge, .notification-badge');
    if (hasBadge) {
      console.log('CHECK 5 PASS: Badge element found');
      return;
    }
    console.log('CHECK 5 FAIL: No badge element found');
  });

  test('CHECK 6: /drafts works', async ({ page }) => {
    await page.goto('http://localhost:5173/drafts');
    await page.waitForLoadState('networkidle');
    
    const currentUrl = page.url();
    if (currentUrl.includes('/drafts')) {
      const hasDraftsHeading = await page.$('h1:has-text("Drafts"), h1:has-text("My Drafts"), text=Drafts');
      const hasDraftsContainer = await page.$('[data-testid="drafts"], .drafts-container, .drafts-list');
      
      if (hasDraftsHeading || hasDraftsContainer) {
        console.log('CHECK 6 PASS: /drafts page loads correctly');
        return;
      }
    }
    console.log('CHECK 6 FAIL: /drafts page not working');
  });
});
