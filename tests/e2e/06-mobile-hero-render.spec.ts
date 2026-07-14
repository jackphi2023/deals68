import {
  expect,
  test,
  type Page,
  type TestInfo,
} from '@playwright/test';

declare global {
  interface Window {
    __d68HeroPlaceholderSeen?: boolean;
  }
}

type HeroState = {
  slideCount: number;
  activeCount: number;
  complete: boolean;
  naturalWidth: number;
  naturalHeight: number;
  sliderWidth: number;
  sliderHeight: number;
  slideWidth: number;
  slideHeight: number;
  mediaWidth: number;
  mediaHeight: number;
  imageWidth: number;
  imageHeight: number;
  opacity: number;
  visibility: string;
  display: string;
  objectFit: string;
  variant: string;
  source: string;
  layout: string;
};

async function installPlaceholderWatch(page: Page) {
  await page.addInitScript(() => {
    window.__d68HeroPlaceholderSeen = false;

    const inspect = (node: Node) => {
      if (!(node instanceof HTMLElement)) return;

      const images = [
        ...(node instanceof HTMLImageElement ? [node] : []),
        ...node.querySelectorAll('img'),
      ];

      for (const image of images) {
        const source =
          image.currentSrc ||
          image.getAttribute('src') ||
          '';
        const alt = image.getAttribute('alt') || '';

        if (
          alt.includes('Deals68 hero placeholder') ||
          source.includes('Deals68.com') ||
          source.includes(
            'Upload%20active%20Hero%20banners',
          )
        ) {
          window.__d68HeroPlaceholderSeen = true;
        }
      }
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === 'attributes' &&
          mutation.target instanceof Node
        ) {
          inspect(mutation.target);
        }

        mutation.addedNodes.forEach(inspect);
      }
    });

    observer.observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['src', 'alt'],
    });
  });
}

async function readHeroState(page: Page): Promise<HeroState> {
  return page.evaluate(() => {
    const slider =
      document.querySelector<HTMLElement>(
        '.d68-home-hero .d68-hero-slider--ready',
      );

    const slides = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.d68-home-hero .d68-hero-slide',
      ),
    );

    const activeSlides = slides.filter((slide) =>
      slide.classList.contains('is-active'),
    );

    const active = activeSlides[0] || null;
    const media =
      active?.querySelector<HTMLElement>(
        '[data-hero-variant]',
      ) || null;
    const image =
      active?.querySelector<HTMLImageElement>(
        '.d68-hero-media__image',
      ) || null;

    const sliderRect = slider?.getBoundingClientRect();
    const slideRect = active?.getBoundingClientRect();
    const mediaRect = media?.getBoundingClientRect();
    const imageRect = image?.getBoundingClientRect();
    const style = image
      ? window.getComputedStyle(image)
      : null;

    return {
      slideCount: slides.length,
      activeCount: activeSlides.length,
      complete: Boolean(image?.complete),
      naturalWidth: image?.naturalWidth || 0,
      naturalHeight: image?.naturalHeight || 0,
      sliderWidth: sliderRect?.width || 0,
      sliderHeight: sliderRect?.height || 0,
      slideWidth: slideRect?.width || 0,
      slideHeight: slideRect?.height || 0,
      mediaWidth: mediaRect?.width || 0,
      mediaHeight: mediaRect?.height || 0,
      imageWidth: imageRect?.width || 0,
      imageHeight: imageRect?.height || 0,
      opacity: Number(style?.opacity || 0),
      visibility: style?.visibility || '',
      display: style?.display || '',
      objectFit: style?.objectFit || '',
      variant: media?.dataset.heroVariant || '',
      source: image?.currentSrc || image?.src || '',
      layout: slider?.dataset.heroLayout || '',
    };
  });
}

function layoutReady(state: HeroState) {
  return (
    state.slideCount >= 3 &&
    state.activeCount === 1 &&
    state.complete &&
    state.naturalWidth > 100 &&
    state.naturalHeight > 100 &&
    state.sliderWidth > 250 &&
    state.sliderHeight > 200 &&
    state.slideWidth > 250 &&
    state.slideHeight > 200 &&
    state.mediaWidth > 250 &&
    state.mediaHeight > 200 &&
    state.imageWidth > 250 &&
    state.imageHeight > 200 &&
    state.opacity > 0.9 &&
    state.visibility === 'visible' &&
    state.display === 'block' &&
    state.layout === 'grid-v65'
  );
}

async function expectHeroVisible(
  page: Page,
  mobile: boolean,
  testInfo: TestInfo,
  slideIndex: number,
) {
  await expect
    .poll(
      async () => {
        const state = await readHeroState(page);
        return layoutReady(state);
      },
      {
        timeout: 30_000,
        intervals: [100, 250, 500, 1000],
        message:
          `Hero slide ${slideIndex + 1} did not reach a ` +
          'non-zero stable layout',
      },
    )
    .toBe(true);

  const state = await readHeroState(page);

  await testInfo.attach(
    `hero-state-${mobile ? 'mobile' : 'desktop'}-${slideIndex + 1}`,
    {
      body: JSON.stringify(state, null, 2),
      contentType: 'application/json',
    },
  );

  const response = await page.request.get(state.source);
  expect(response.ok()).toBeTruthy();

  if (mobile) {
    expect(state.variant).toBe('mobile');
    expect(state.source).toContain('/mobile/');
    expect(state.objectFit).toBe('contain');
  } else {
    expect(state.variant).toBe('desktop');
    expect(state.objectFit).toBe('cover');
  }
}

async function openHomepage(
  page: Page,
  testInfo: TestInfo,
) {
  const heroRequestFailures: string[] = [];

  await installPlaceholderWatch(page);

  page.on('requestfailed', (request) => {
    const url = request.url();

    if (
      url.includes('/site-banners/') ||
      url.includes('/home_hero/')
    ) {
      heroRequestFailures.push(
        `${request.failure()?.errorText || 'failed'} ${url}`,
      );
    }
  });

  await page.emulateMedia({
    reducedMotion: 'reduce',
  });

  const response = await page.goto('/', {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });

  expect(response?.status()).toBeLessThan(400);

  await expect(
    page.locator('.d68-home-hero'),
  ).toBeVisible({
    timeout: 30_000,
  });

  await expect
    .poll(
      async () =>
        page.locator(
          '.d68-home-hero .d68-hero-dots button',
        ).count(),
      {
        timeout: 30_000,
        intervals: [100, 250, 500, 1000],
      },
    )
    .toBeGreaterThanOrEqual(3);

  const placeholderSeen = await page.evaluate(
    () => Boolean(window.__d68HeroPlaceholderSeen),
  );

  await testInfo.attach('hero-runtime-diagnostics', {
    body: JSON.stringify(
      {
        heroRequestFailures,
        placeholderSeen,
        url: page.url(),
        viewport: page.viewportSize(),
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });

  expect(heroRequestFailures).toEqual([]);
  expect(placeholderSeen).toBe(false);
}

test('homepage Hero renders every configured slide', async ({
  page,
}, testInfo) => {
  await openHomepage(page, testInfo);

  const mobile =
    (page.viewportSize()?.width || 1440) <= 700;
  const dots = page.locator(
    '.d68-home-hero .d68-hero-dots button',
  );
  const dotCount = await dots.count();

  expect(dotCount).toBeGreaterThanOrEqual(3);

  for (let index = 0; index < dotCount; index += 1) {
    await dots.nth(index).evaluate((element) => {
      (element as HTMLButtonElement).click();
    });

    await expect(dots.nth(index)).toHaveClass(
      /active/,
      {
        timeout: 10_000,
      },
    );

    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
          });
        }),
    );

    await expectHeroVisible(
      page,
      mobile,
      testInfo,
      index,
    );
  }

  await page.screenshot({
    path: testInfo.outputPath(
      mobile
        ? 'hero-mobile-final.png'
        : 'hero-desktop-final.png',
    ),
    fullPage: false,
  });
});
