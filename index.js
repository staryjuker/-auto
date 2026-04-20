const { chromium } = require('playwright');
const path = require('path');

function todayFilename() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `result_${y}${m}${day}.png`;
}

async function clickRadioByLabel(page, labelText) {
  await page.evaluate((text) => {
    for (const r of document.querySelectorAll('input[type="radio"]')) {
      const parent = r.parentNode;
      const nodes = [...parent.childNodes];
      const idx = nodes.indexOf(r);
      let afterText = '';
      for (let i = idx + 1; i < nodes.length; i++) {
        const n = nodes[i];
        if (n.nodeType === Node.TEXT_NODE) afterText += n.textContent;
        else if (n.nodeName === 'INPUT' && n.type === 'radio') break;
        else afterText += n.textContent || '';
      }
      if (afterText.trim().includes(text)) {
        r.click();
        return;
      }
    }
  }, labelText);
}

(async () => {
  const browser = await chromium.launch({ headless: process.env.CI ? true : false });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-TW' });
  const page = await context.newPage();

  console.log('Opening page...');
  await page.goto(
    'https://web.pcc.gov.tw/prkms/tender/common/proctrg/indexTenderProctrg',
    { waitUntil: 'networkidle', timeout: 60000 }
  );
  await page.waitForTimeout(2000);

  // ── 1. 勞務類 radio ──────────────────────────────────────────────
  console.log('Clicking 勞務類...');
  await clickRadioByLabel(page, '勞務類');
  await page.waitForTimeout(800);

  // ── 2. 861 法律服務 ──────────────────────────────────────────────
  console.log('Selecting 861 法律服務...');
  await page.evaluate(() => {
    for (const sel of document.querySelectorAll('select')) {
      for (const opt of sel.options) {
        if (opt.text.includes('861') || opt.text.includes('法律服務')) {
          sel.value = opt.value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          return;
        }
      }
    }
  });
  await page.waitForTimeout(500);

  // ── 3. 等標期內 radio ────────────────────────────────────────────
  console.log('Clicking 等標期內...');
  await clickRadioByLabel(page, '等標期內');
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'debug_before_search.png', fullPage: true });
  console.log('Saved debug_before_search.png');

  // ── 4. 查詢按鈕 ──────────────────────────────────────────────────
  console.log('Clicking 查詢...');
  await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent.trim() === '查詢') {
        const el = node.parentElement;
        if (el && (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'A')) {
          el.click();
          return;
        }
      }
    }
    // fallback: click any button/input containing 查詢
    for (const el of document.querySelectorAll('button, input[type="submit"], input[type="button"]')) {
      if ((el.textContent || el.value || '').includes('查詢')) {
        el.click();
        return;
      }
    }
  });

  // ── 5. 等待結果 ──────────────────────────────────────────────────
  console.log('Waiting for results...');
  await page.waitForTimeout(5000);
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  await page.waitForTimeout(2000);

  // ── 6. 截圖 ──────────────────────────────────────────────────────
  const filename = todayFilename();
  await page.screenshot({ path: filename, fullPage: true });
  await page.screenshot({ path: 'result_latest.png', fullPage: true });
  console.log('Done! Saved ' + filename);

  await browser.close();
})();
