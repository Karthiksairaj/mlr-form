import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { discoverFormActions } from './action-discovery.js';
import { extractVisibleFields } from './field-extractor.js';

const browserDescribe = process.env.RUN_BROWSER_TESTS === 'true' ? describe : describe.skip;

browserDescribe('form action discovery', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => { browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) }); });
  beforeEach(async () => { page = await browser.newPage(); });
  afterEach(async () => { await page.close(); });
  afterAll(async () => { await browser?.close(); });

  it('offers Submit and Activate Card as distinct routes including an adjacent link', async () => {
    await page.setContent(`<main><form>
      <label>Email<input name="email"></label>
      <button id="submit-card">Submit</button>
    </form><a href="#existing" id="activate-card">Activate existing card</a></main>`);
    const actions = await discoverFormActions(page, await extractVisibleFields(page));
    expect(actions.map(({ id, label, kind }) => ({ id, label, kind }))).toEqual([
      { id: 'id:submit-card', label: 'Submit', kind: 'submit' },
      { id: 'id:activate-card', label: 'Activate existing card', kind: 'submit' }
    ]);
    await actions[1]!.locator.click();
    expect(page.url()).toContain('#existing');
  });

  it('excludes unrelated, hidden, disabled, and backwards controls', async () => {
    await page.setContent(`<header><button>Activate Card</button></header>
      <nav><a href="#register">Register</a></nav><footer><button>Continue</button></footer>
      <main><form id="main-form"><label>Email<input name="email"></label>
        <button type="button">Next</button>
        <button hidden>Submit</button><button disabled>Activate Card</button>
        <button aria-disabled="true">Apply</button><fieldset disabled><button>Send</button></fieldset>
        <button>Go back</button><button>Previous</button><button>Cancel</button><button>Close</button>
        <button type="reset">Submit</button><a href="file.txt" download>Get new card</a>
        <button type="button">Learn more</button>
      </form><a href="#news">Register</a><button>Start learning</button>
      <form><button>Submit</button><a href="#other">Activate Card</a></form></main>`);
    const actions = await discoverFormActions(page, await extractVisibleFields(page));
    expect(actions.map(action => action.label)).toEqual(['Next']);
    expect(actions[0]?.kind).toBe('next');
  });

  it('discovers Get New Card and Activate Existing Card outside the active root', async () => {
    await page.setContent(`<main class="form-container">
      <form data-mlr-active-form="true"><input name="email" aria-label="Email"></form>
      <button type="button">Get New Card</button><button type="button">Activate Existing Card</button>
    </main>`);
    const actions = await discoverFormActions(page, []);
    expect(actions.map(action => action.label)).toEqual(['Get New Card', 'Activate Existing Card']);
  });

  it('treats AEM card actions as submissions even without a submit class', async () => {
    await page.setContent(`<form><input name="email" aria-label="Email">
      <button type="button" class="cmp-adaptiveform-button__widget submit">Get New Card</button>
      <button type="button" class="cmp-adaptiveform-button__widget ">Activate Existing Card</button>
      <button type="button">Activate Card</button>
      <button type="submit" class="cmp-adaptiveform-button__widget">Activate Existing Card</button>
    </form>`);
    const actions = await discoverFormActions(page, await extractVisibleFields(page));
    expect(actions.map(action => [action.label, action.kind])).toEqual([
      ['Get New Card', 'submit'], ['Activate Existing Card', 'submit'],
      ['Activate Card', 'submit'], ['Activate Existing Card', 'submit']
    ]);
  });

  it('recognizes native, custom, accessible-name, and externally associated controls', async () => {
    await page.setContent(`<form id="active"><label>Name<input name="name"></label>
      <input type="submit" value="Finish"><button type="button" aria-label="Verify eligibility">Check</button>
      <div role="button" tabindex="0" aria-labelledby="activate-label"><span id="activate-label">Activate Card</span></div>
      <button type="button" class="cmp-adaptiveform-button__widget submit">Confirm</button>
      <button><span role="button">Submit</span></button>
    </form><button form="active" type="submit">Send</button>`);
    const actions = await discoverFormActions(page, await extractVisibleFields(page));
    expect(actions.map(action => [action.label, action.kind])).toEqual([
      ['Finish', 'submit'], ['Verify eligibility', 'next'], ['Activate Card', 'submit'],
      ['Confirm', 'submit'], ['Submit', 'submit'], ['Send', 'submit']
    ]);
    for (const action of actions) expect(await action.locator.count()).toBe(1);
  });

  it('retains action identities through conditional fields and field ID reassignment', async () => {
    await page.setContent(`<form><label>Name<input name="name"></label>
      <label><input name="existing" type="checkbox">Existing card</label>
      <button type="submit">Submit</button><button type="button">Activate Card</button>
    </form>`);
    const original = await discoverFormActions(page, await extractVisibleFields(page));
    await page.locator('form').evaluate(form => {
      const select = document.createElement('select');
      select.name = 'cardType';
      select.setAttribute('aria-label', 'Card type');
      select.innerHTML = '<option>Savings</option>';
      form.prepend(select);
    });
    const refreshed = await discoverFormActions(page, await extractVisibleFields(page));
    expect(refreshed.map(action => action.id)).toEqual(original.map(action => action.id));
    expect(new Set(refreshed.map(action => action.id)).size).toBe(2);
    expect(await refreshed[1]!.locator.textContent()).toBe('Activate Card');
  });

  it('keeps distinct same-label controls and authored IDs across rerendering', async () => {
    await page.setContent(`<form><input name="name" aria-label="Name">
      <button id="first">Submit</button><button id="second">Submit</button>
    </form>`);
    const original = await discoverFormActions(page, await extractVisibleFields(page));
    expect(original).toHaveLength(2);
    expect(new Set(original.map(action => action.id)).size).toBe(2);
    await page.locator('#second').evaluate(button => { button.outerHTML = '<button id="second">Submit</button>'; });
    const refreshed = await discoverFormActions(page, await extractVisibleFields(page));
    expect(refreshed.map(action => action.id)).toEqual(original.map(action => action.id));
  });

  it('restricts actions to the frame containing the selected form', async () => {
    await page.setContent(`<button>Continue</button><iframe title="form"></iframe>`);
    // srcdoc gives this local form a frame URL distinct from the main page.
    await page.locator('iframe').evaluate(iframe => {
      (iframe as HTMLIFrameElement).srcdoc = `<form><label>Email<input name="email"></label><label>Card<input name="card"></label>
        <button>Submit</button><button type="button">Activate Card</button></form>`;
    });
    await page.frameLocator('iframe').getByLabel('Card').waitFor();
    const fields = await extractVisibleFields(page);
    expect(fields[0]?.frameUrl).toBe('about:srcdoc');
    const actions = await discoverFormActions(page, fields);
    expect(actions.map(action => action.label)).toEqual(['Submit', 'Activate Card']);
    for (const action of actions) expect(await action.locator.count()).toBe(1);
  });
});
