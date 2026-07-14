import { expect, test, type Page } from '@playwright/test';

async function assertHeroImage(
  page: Page,
  expectedVariant: 'mobile' | 'desktop',
) {
  const hero = page.locator('.d68-home-hero');
  const slider = hero.locator('.d68-hero-slider');
  const activeSlide = hero.locator('.d68-hero-slide.is-active');

  await expect(slider).toBeVisible({ timeout: 20_000 });
  await expect(activeSlide).toHaveCount(1);
  await expect(activeSlide).toBeVisible();

  const media = activeSlide.locator(
    `[data-hero-variant="${expectedVariant}"]`,
  );
  const image = activeSlide.locator('.d68-hero-media__image');

  await expect(media).toHaveCount(1);
  await expect(image).toBeVisible();

  await expect
    .poll(
      async () =>
        image.evaluate((node: HTMLImageElement) => ({
          complete: node.complete,
          naturalWidth: node.naturalWidth,
          naturalHeight: node.naturalHeight,
          source: node.currentSrc || node.src,
        })),
      { timeout: 20_000 },
    )
    .toMatchObject({
      complete: true,
    });

  const state = await image.evaluate((node: HTMLImageElement) => {
    const style = window.getComputedStyle(node);
    const rect = node.getBoundingClientRect();

    return {
      naturalWidth: node.naturalWidth,
      naturalHeight: node.naturalHeight,
      source: node.currentSrc || node.src,
      width: rect.width,
      height: rect.height,
      display: style.display,
      visibility: style.visibility,
      opacity: Number(style.opacity),
      objectFit: style.objectFit,
    };
  });

  expect(state.naturalWidth).toBeGreaterThan(100);
  expect(state.naturalHeight).toBeGreaterThan(100);
  expect(state.width).toBeGreaterThan(250);
  expect(state.height).toBeGreaterThan(200);
  expect(state.display).not.toBe('none');
  expect(state.visibility).toBe('visible');
  expect(state.opacity).toBeGreaterThan(0.9);

  if (expectedVariant === 'mobile') {
    expect(state.source).toContain('/mobile/');
    expect(state.objectFit).toBe('contain');
  } else {
    expect(state.objectFit).toBe('cover');
  }
}

test('mobile homepage renders every Hero banner', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await assertHeroImage(page, 'mobile');

  const dots = page.locator(
    '.d68-home-hero .d68-hero-dots button',
  );
  const dotCount = await dots.count();

  expect(dotCount).toBeGreaterThan(0);

  for (let index = 0; index < dotCount; index += 1) {
    await dots.nth(index).click({ force: true });

    await expect(
      page.locator(
        '.d68-home-hero .d68-hero-slide.is-active',
      ),
    ).toHaveCount(1);

    await assertHeroImage(page, 'mobile');
  }
});

test('desktop homepage Hero remains visible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await assertHeroImage(page, 'desktop');
});
