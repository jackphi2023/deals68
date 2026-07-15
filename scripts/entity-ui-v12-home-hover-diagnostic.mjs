#!/usr/bin/env node
import { chromium } from '@playwright/test';

const base = String(process.env.D68_BETA_URL || 'https://deploy-preview-22--beta-reference-deals68.netlify.app').replace(/\/$/, '');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.locator('.d68-home-investor-card h3').first().waitFor({ state: 'visible', timeout: 30_000 });
  const card = page.locator('.d68-home-investor-card').first();
  await card.hover();
  await page.waitForTimeout(250);

  const state = await card.evaluate((cardNode) => {
    const title = cardNode.querySelector('h3');
    const collectRules = (rules, output = []) => {
      for (const rule of Array.from(rules || [])) {
        if (rule.cssRules) collectRules(rule.cssRules, output);
        if (!rule.selectorText || !String(rule.selectorText).includes('d68-home-investor')) continue;
        let cardMatches = false;
        let titleMatches = false;
        try { cardMatches = cardNode.matches(rule.selectorText); } catch {}
        try { titleMatches = title?.matches(rule.selectorText) || false; } catch {}
        output.push({
          selector: rule.selectorText,
          cssText: rule.style?.cssText || '',
          cardMatches,
          titleMatches,
        });
      }
      return output;
    };
    const rules = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try { collectRules(sheet.cssRules, rules); } catch (error) {
        rules.push({ selector: '[unreadable stylesheet]', cssText: String(error), cardMatches: false, titleMatches: false });
      }
    }
    const cardStyle = getComputedStyle(cardNode);
    const titleStyle = title ? getComputedStyle(title) : null;
    const rect = cardNode.getBoundingClientRect();
    const point = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      cardTag: cardNode.tagName,
      cardClass: cardNode.className,
      cardOuter: cardNode.outerHTML.slice(0, 2400),
      cardHover: cardNode.matches(':hover'),
      titleOuter: title?.outerHTML || '',
      titleHover: title?.matches(':hover') || false,
      cardBackground: cardStyle.backgroundColor,
      titleColor: titleStyle?.color || '',
      titleInline: title?.getAttribute('style') || '',
      pointTag: point?.tagName || '',
      pointClass: point?.className || '',
      rules,
    };
  });
  console.log(JSON.stringify(state, null, 2));
} finally {
  await browser.close();
}
