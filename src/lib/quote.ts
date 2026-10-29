/**
 * Quote Drawer behaviour (lazy-loaded on first [data-quote-open] click).
 * Step 1 build → Step 2 details → Step 3 sent.
 * Submission: LEAD_WEBHOOK_URL (POST JSON) → else SMS (touch) / email (desktop) fallback.
 */
import { brand, smsHref, mailHref } from '../config/brand';
import { lockScroll, reducedMotion } from './lenis';
import { track } from './analytics';
import {
  estimate,
  formatPhone,
  formatPrice,
  leadPayload,
  leadSummary,
  phoneLooksValid,
  type LeadDetails,
  type QuoteSelection,
} from './pricing';

const MIN_FILL_MS = 3000;
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select, textarea, [tabindex]:not([tabindex="-1"])';

interface Drawer {
  open(opts: { packageId?: string; opener?: HTMLElement | null }): void;
}

let drawer: Drawer | null = null;

export function openQuote(opts: { packageId?: string; opener?: HTMLElement | null } = {}): void {
  drawer ??= createDrawer();
  drawer?.open(opts);
}

function createDrawer(): Drawer | null {
  const root = document.getElementById('quote-drawer');
  if (!root) return null;
  const html = document.documentElement;
  const panel = root.querySelector<HTMLElement>('.qd-panel')!;
  const form = root.querySelector<HTMLFormElement>('.qd-form')!;
  const body = root.querySelector<HTMLElement>('.qd-body')!;
  const steps = Array.from(root.querySelectorAll<HTMLElement>('[data-step]'));
  const indicators = Array.from(root.querySelectorAll<HTMLElement>('[data-step-ind]'));
  const est = root.querySelector<HTMLElement>('.qd-est')!;
  const estVal = root.querySelector<HTMLOutputElement>('.qd-est-val')!;
  const btnBack = root.querySelector<HTMLButtonElement>('.qd-back')!;
  const btnNext = root.querySelector<HTMLButtonElement>('.qd-next')!;
  const btnSubmit = root.querySelector<HTMLButtonElement>('.qd-submit')!;
  const btnDone = root.querySelector<HTMLButtonElement>('.qd-done')!;
  const summary = root.querySelector<HTMLElement>('.qd-summary')!;
  const sentBody = root.querySelector<HTMLElement>('.qd-sent-body')!;
  const sentTitle = root.querySelector<HTMLElement>('.qd-sent-title')!;
  const phone = form.elements.namedItem('phone') as HTMLInputElement;
  const date = form.elements.namedItem('date') as HTMLInputElement;
  const pkgPrices = Array.from(root.querySelectorAll<HTMLElement>('[data-qprices]'));

  let isOpen = false;
  let step = 1;
  let opener: HTMLElement | null = null;
  let step2At = 0;
  let shown = 0;
  let raf = 0;

  // today (local) as min date
  const d = new Date();
  date.min = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const selection = (): QuoteSelection => ({
    size: Number((form.querySelector('input[name="size"]:checked') as HTMLInputElement | null)?.value ?? 0),
    packageId: (form.querySelector('input[name="package"]:checked') as HTMLInputElement | null)?.value ?? brand.PACKAGES[0].id,
    addons: Array.from(form.querySelectorAll<HTMLInputElement>('input[name="addons"]:checked')).map((i) => i.value),
  });

  const details = (): LeadDetails => {
    const v = (n: string) => ((form.elements.namedItem(n) as HTMLInputElement | null)?.value ?? '').trim();
    const win = (form.querySelector('input[name="window"]:checked') as HTMLInputElement | null)?.value ?? '';
    return { name: v('name'), phone: v('phone'), zip: v('zip'), vehicle: v('vehicle'), date: v('date'), window: win, notes: v('notes') };
  };

  // ── live estimate (tweened) ───────────────────────────────────────────
  const setEstimate = (instant = false) => {
    const sel = selection();
    const to = estimate(sel.size, sel.packageId, sel.addons);
    cancelAnimationFrame(raf);
    if (instant || reducedMotion() || shown === to) {
      shown = to;
      estVal.textContent = formatPrice(to);
      return;
    }
    const from = shown;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / 450);
      shown = from + (to - from) * (1 - Math.pow(1 - t, 3));
      estVal.textContent = formatPrice(shown);
      if (t < 1) raf = requestAnimationFrame(tick);
      else shown = to;
    };
    raf = requestAnimationFrame(tick);
  };

  const setPkgPrices = (size: number) => {
    for (const el of pkgPrices) {
      const prices = JSON.parse(el.dataset.qprices || '[]') as number[];
      el.textContent = formatPrice(prices[Math.min(size, prices.length - 1)] ?? 0);
    }
  };

  const setSize = (size: number, emit: boolean) => {
    const input = form.querySelector<HTMLInputElement>(`input[name="size"][value="${size}"]`);
    if (input) input.checked = true;
    setPkgPrices(size);
    html.dataset.vehicleSize = String(size);
    if (emit) window.dispatchEvent(new CustomEvent('vehicle-size', { detail: size }));
  };

  form.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'size') setSize(Number(t.value), true);
    if (t.name === 'size' || t.name === 'package' || t.name === 'addons') setEstimate();
  });

  window.addEventListener('vehicle-size', (e) => {
    const size = (e as CustomEvent<number>).detail;
    if (selection().size !== size) {
      setSize(size, false);
      setEstimate(!isOpen);
    }
  });

  // ── phone formatting ──────────────────────────────────────────────────
  phone.addEventListener('input', () => {
    const atEnd = phone.selectionStart === phone.value.length;
    const f = formatPhone(phone.value);
    if (atEnd && f !== phone.value) phone.value = f;
  });
  phone.addEventListener('blur', () => (phone.value = formatPhone(phone.value)));

  // ── steps ─────────────────────────────────────────────────────────────
  const showStep = (n: number, focus = true) => {
    step = n;
    steps.forEach((s) => (s.hidden = Number(s.dataset.step) !== n));
    indicators.forEach((li) => {
      const i = Number(li.dataset.stepInd);
      li.classList.toggle('is-done', i < n);
      if (i === n) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
    });
    btnBack.hidden = n !== 2;
    btnNext.hidden = n !== 1;
    btnSubmit.hidden = n !== 2;
    btnDone.hidden = n !== 3;
    est.hidden = n === 3;
    body.scrollTop = 0;
    if (n === 2) {
      step2At = performance.now();
      const sel = selection();
      const pkg = brand.PACKAGES.find((p) => p.id === sel.packageId);
      const addons = sel.addons.map((id) => brand.ADDONS.find((a) => a.id === id)?.name).filter(Boolean);
      summary.textContent = [pkg?.name, brand.VEHICLE_SIZES[sel.size], ...addons].filter(Boolean).join(' · ');
      track('quote_step2', { package: sel.packageId, size: sel.size, estimate: estimate(sel.size, sel.packageId, sel.addons) });
      if (focus) (form.elements.namedItem('name') as HTMLInputElement).focus({ preventScroll: true });
    } else if (n === 3) {
      if (focus) sentTitle.focus({ preventScroll: true });
    } else if (focus) {
      (form.querySelector('input[name="package"]:checked') as HTMLInputElement | null)?.focus({ preventScroll: true });
    }
  };

  btnNext.addEventListener('click', () => showStep(2));
  btnBack.addEventListener('click', () => showStep(1));

  // ── validation ────────────────────────────────────────────────────────
  const setError = (name: string, msg: string) => {
    const input = form.elements.namedItem(name) as HTMLInputElement;
    const err = root.querySelector<HTMLElement>(`#qd-${name}-err`)!;
    err.textContent = msg;
    if (msg) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    return !msg;
  };

  const validate = (): boolean => {
    const dt = details();
    const okName = setError('name', dt.name ? '' : 'Please add your name.');
    const okPhone = setError('phone', phoneLooksValid(dt.phone) ? '' : 'Please add a mobile number we can text.');
    if (!okName) (form.elements.namedItem('name') as HTMLInputElement).focus();
    else if (!okPhone) phone.focus();
    return okName && okPhone;
  };

  ['name', 'phone'].forEach((n) =>
    (form.elements.namedItem(n) as HTMLInputElement).addEventListener('input', (e) => {
      if ((e.target as HTMLElement).getAttribute('aria-invalid')) setError(n, '');
    }),
  );

  // ── submit ────────────────────────────────────────────────────────────
  const isTouch = () =>
    matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  const openExternal = (href: string) => {
    const a = document.createElement('a');
    a.href = href;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const sendWebhook = async (payload: unknown): Promise<boolean> => {
    if (!brand.LEAD_WEBHOOK_URL) return false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    try {
      const res = await fetch(brand.LEAD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (step === 1) return showStep(2);
    if (step !== 2) return;

    const sel = selection();
    const dt = details();
    const honeypot = (form.elements.namedItem('company') as HTMLInputElement).value;
    const tooFast = performance.now() - step2At < MIN_FILL_MS;
    if (honeypot || tooFast) {
      // likely a bot: pretend it worked, send nothing
      sentBody.textContent = sentBody.dataset.ok!;
      return showStep(3);
    }
    if (!validate()) return;

    const label = btnSubmit.textContent;
    btnSubmit.setAttribute('aria-busy', 'true');
    btnSubmit.textContent = btnSubmit.dataset.sending ?? label;

    const payload = leadPayload(sel, dt, { pageUrl: location.href, search: location.search });
    const ok = await sendWebhook(payload);
    let via: 'webhook' | 'sms' | 'email' = 'webhook';
    if (!ok) {
      const text = leadSummary(sel, dt);
      if (brand.SMS_ENABLED && isTouch()) {
        via = 'sms';
        openExternal(smsHref(text));
      } else {
        via = 'email';
        openExternal(mailHref(`Quote request — ${payload.package} (${payload.size})`, text));
      }
    }
    track('quote_submit', { via, package: sel.packageId, size: sel.size, estimate: payload.estimate });

    btnSubmit.removeAttribute('aria-busy');
    btnSubmit.textContent = label;
    sentBody.textContent = ok ? sentBody.dataset.ok! : sentBody.dataset.fallback!;
    showStep(3);
  });

  // ── open / close + focus trap ─────────────────────────────────────────
  const focusables = () =>
    Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => !el.closest('[hidden]') && el.getClientRects().length > 0,
    );

  const onKey = (e: KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const f = focusables();
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && (active === first || !panel.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  };

  const close = () => {
    if (!isOpen) return;
    isOpen = false;
    root.classList.remove('is-open');
    html.classList.remove('quote-open');
    document.removeEventListener('keydown', onKey, true);
    lockScroll(false);
    const done = () => {
      if (isOpen) return;
      root.hidden = true;
      if (step === 3) {
        // start fresh next time
        form.reset();
        setSize(Number(html.dataset.vehicleSize ?? 0), false);
        showStep(1, false);
        setEstimate(true);
      }
    };
    if (reducedMotion()) done();
    else setTimeout(done, 560);
    opener?.focus({ preventScroll: true });
  };

  root.querySelectorAll('[data-qd-close]').forEach((el) => el.addEventListener('click', close));

  const open = ({ packageId, opener: from }: { packageId?: string; opener?: HTMLElement | null }) => {
    opener = from ?? (document.activeElement as HTMLElement | null);
    if (step === 3) showStep(1, false);
    if (packageId) {
      const input = form.querySelector<HTMLInputElement>(`input[name="package"][value="${CSS.escape(packageId)}"]`);
      if (input) input.checked = true;
      if (step !== 1) showStep(1, false);
    }
    setSize(Number(html.dataset.vehicleSize ?? selection().size), false);
    setEstimate(true);
    if (isOpen) return;
    isOpen = true;
    root.hidden = false;
    html.classList.add('quote-open');
    lockScroll(true);
    document.addEventListener('keydown', onKey, true);
    // next frame so the transition runs
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        root.classList.add('is-open');
        if (step === 2) (form.elements.namedItem('name') as HTMLInputElement).focus({ preventScroll: true });
        else (form.querySelector('input[name="package"]:checked') as HTMLInputElement | null)?.focus({ preventScroll: true });
      }),
    );
    track('quote_open', { package: packageId ?? null, from: opener?.closest('[data-track-area]')?.getAttribute('data-track-area') ?? 'page' });
  };

  return { open };
}
