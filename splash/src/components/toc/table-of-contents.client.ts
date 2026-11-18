/**
 * table-of-contents.client.ts — reading-position tracking and collapse behavior.
 *
 * Strictly progressive enhancement. Without it the ToC is still a list of
 * working anchor links; only the active-state tracking, the mobile label, and
 * the expand/collapse are lost.
 *
 * Spec: astro-knots/context-v/specs/Reading-Position-Table-of-Contents-for-LFM-Articles.md
 */

/**
 * Measure whatever chrome is pinned to the top of the viewport.
 *
 * Header heights differ across astro-knots sites (and change responsively
 * within one), so a hardcoded offset is wrong everywhere except the site it
 * was tuned on. This finds the pinned header at runtime instead.
 *
 * Only `sticky` / `fixed` headers count: a header that scrolls away leaves no
 * permanent obstruction, so the ToC can sit at the top of the viewport.
 */
function measureHeaderOffset(): number {
  const candidates = document.querySelectorAll<HTMLElement>(
    '[data-site-header], header, .site-header'
  );
  let lowest = 0;
  candidates.forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.position !== 'sticky' && cs.position !== 'fixed') return;
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    // Where the header's bottom edge settles once pinned: its own `top`
    // offset plus its height.
    const pinnedTop = parseFloat(cs.top) || 0;
    lowest = Math.max(lowest, pinnedTop + el.getBoundingClientRect().height);
  });
  return lowest;
}

/**
 * Publish the RAW header edge. The gap on top of it belongs to CSS, which
 * varies it per breakpoint — mobile wants the bar tucked close under the
 * header, the floating desktop burger wants more air.
 */
function publishHeaderOffset(): void {
  document.documentElement.style.setProperty(
    '--lfm-toc-header-bottom',
    `${Math.round(measureHeaderOffset())}px`
  );
}

function watchHeaderOffset(): void {
  publishHeaderOffset();
  // Responsive headers change height at breakpoints and when nav wraps.
  const header = document.querySelector<HTMLElement>(
    '[data-site-header], header, .site-header'
  );
  if (header && 'ResizeObserver' in window) {
    new ResizeObserver(publishHeaderOffset).observe(header);
  }
  window.addEventListener('resize', publishHeaderOffset, { passive: true });
}

function initTableOfContents(): void {
  if (document.querySelector('[data-toc]')) watchHeaderOffset();

  document.querySelectorAll<HTMLElement>('[data-toc]').forEach((root) => {
    if (root.dataset.tocReady) return;
    root.dataset.tocReady = 'true';

    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('[data-toc-link]'));
    if (!links.length) return;

    const label = root.querySelector<HTMLElement>('[data-toc-label]');
    const toggles = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-toc-toggle]'));
    const panel = root.querySelector<HTMLElement>('[data-toc-panel]');

    const headings = links
      .map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1))))
      .filter((el): el is HTMLElement => Boolean(el));

    // ── Reading position ────────────────────────────────────────────────────
    // Topmost heading in view wins. A reader in the middle of a long section
    // should see that section as active, not the next one that scrolled in.
    let activeId = '';
    const setActive = (id: string) => {
      if (id === activeId) return;
      activeId = id;
      links.forEach((a) => {
        const on = decodeURIComponent(a.hash.slice(1)) === id;
        a.toggleAttribute('data-active', on);
        if (on) {
          a.setAttribute('aria-current', 'true');
          if (label) label.textContent = a.textContent?.trim() ?? '';
        } else {
          a.removeAttribute('aria-current');
        }
      });
    };

    const visible = new Set<HTMLElement>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target as HTMLElement);
          else visible.delete(e.target as HTMLElement);
        }
        if (visible.size) {
          // Topmost of those currently in view.
          const top = [...visible].sort(
            (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top
          )[0];
          setActive(top.id);
        } else {
          // Between headings: the last one scrolled past is still the section
          // the reader is inside.
          const passed = headings.filter((h) => h.getBoundingClientRect().top < 100);
          if (passed.length) setActive(passed[passed.length - 1].id);
        }
      },
      // Top band only, so a heading counts as "current" once it reaches the
      // upper part of the viewport rather than when it merely appears.
      { rootMargin: '-10% 0px -70% 0px', threshold: 0 }
    );
    headings.forEach((h) => io.observe(h));

    // The observer only fires when a heading crosses the band, so a fast
    // scroll (or a reload part-way down) that jumps clean over one leaves the
    // highlight stale or blank. On scroll, when no heading is in the band,
    // fall back to the last heading scrolled past. One check per frame.
    let ticking = false;
    const syncFromScroll = () => {
      ticking = false;
      if (visible.size) return;
      const passed = headings.filter((h) => h.getBoundingClientRect().top < window.innerHeight * 0.3);
      if (passed.length) setActive(passed[passed.length - 1].id);
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(syncFromScroll); }
    }, { passive: true });
    syncFromScroll();

    // ── Collapse / expand ───────────────────────────────────────────────────
    const setOpen = (open: boolean) => {
      root.toggleAttribute('data-open', open);
      toggles.forEach((t) => t.setAttribute('aria-expanded', String(open)));
    };

    toggles.forEach((t) =>
      t.addEventListener('click', () => setOpen(!root.hasAttribute('data-open')))
    );

    // Selecting a heading closes the panel — leaving a full-height outline
    // over the destination defeats the jump.
    links.forEach((a) => a.addEventListener('click', () => setOpen(false)));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && root.hasAttribute('data-open')) {
        setOpen(false);
        toggles[0]?.focus();
      }
    });

    document.addEventListener('click', (e) => {
      if (!root.hasAttribute('data-open')) return;
      if (root.contains(e.target as Node)) return;
      setOpen(false);
    });

    if (panel) panel.addEventListener('click', (e) => e.stopPropagation());
  });
}

initTableOfContents();
document.addEventListener('astro:page-load', initTableOfContents);
