// Browser smoke test: onboarding -> Today plan -> open each tab -> start a lesson and a conversation.
import { chromium } from 'playwright-core';

const SHOTS = process.env.SHOTS ?? '/tmp/claude-0/-home-user-vaktakerfi-vault/b7c8d140-d525-5675-99f7-dc09d79ed21b/scratchpad';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

await page.goto('http://localhost:4173/');
await page.waitForSelector('text=Tenerife Spanish');
await page.fill('input[placeholder="Anna"]', 'Heiðar');
await page.screenshot({ path: `${SHOTS}/01-welcome.png` });
await page.click('text=Continue');
await page.fill('input[placeholder="Reykjavík, Iceland"]', 'Iceland');
await page.fill('input[placeholder="Software developer"]', 'Software');
await page.click('text=Quick level check');
// 8 items: recognise/listen -> pick first option; produce -> "I don't know yet"
for (let i = 0; i < 8; i++) {
  const opt = page.locator('.option').first();
  if (await opt.count()) await opt.click();
  else await page.click("text=I don't know yet");
  await page.waitForTimeout(100);
}
await page.waitForSelector('text=Start day 1');
await page.screenshot({ path: `${SHOTS}/02-level.png` });
await page.click('text=Start day 1');
await page.waitForSelector('text=How much time do you have today?');
await page.click('button:has-text("45 min")');
await page.waitForSelector("text=Today's Spanish");
await page.screenshot({ path: `${SHOTS}/03-today.png`, fullPage: true });
const planText = await page.locator('.list').innerText();
console.log('PLAN:\n' + planText);

for (const tab of ['Learn', 'Speak', 'Review', 'Progress']) {
  await page.click(`nav button:has-text("${tab}")`);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}/tab-${tab.toLowerCase()}.png`, fullPage: true });
}

// Start the phrase lesson from Today.
await page.click('nav button:has-text("Today")');
await page.click('.item:has-text("Learn:")');
await page.waitForSelector('.activity button:has-text("Start")');
await page.screenshot({ path: `${SHOTS}/04-lesson-intro.png`, fullPage: true });
await page.click('.activity button:has-text("Start")');
await page.waitForTimeout(300);
await page.screenshot({ path: `${SHOTS}/05-lesson-step.png` });
await page.click('.activity-top button[aria-label="Close"]');

// Flashcards with nothing due.
await page.click('.item:has-text("Flashcard")');
await page.waitForTimeout(300);
await page.screenshot({ path: `${SHOTS}/06-flashcards.png` });
await page.click('.activity-top button[aria-label="Close"]');

// Listening.
await page.click('.item:has-text("Listening:")');
await page.waitForTimeout(300);
await page.screenshot({ path: `${SHOTS}/07-listening.png` });
await page.click('.activity-top button[aria-label="Close"]');

// Scenario (scripted, typed input since headless has no mic).
await page.click('.item:has-text("Tenerife scenario")');
await page.waitForSelector('text=START CONVERSATION');
await page.click('.activity button:has-text("START CONVERSATION")');
await page.waitForSelector('.bubble.ai');
await page.click('.activity button:has-text("Type instead")');
await page.fill('.activity input.input', 'Hola, me llamo Heiðar');
await page.click('.activity button:has-text("Send")');
await page.waitForTimeout(400);
await page.click('.activity button:has-text("Help")');
await page.waitForTimeout(200);
await page.screenshot({ path: `${SHOTS}/08-conversation.png`, fullPage: true });
await page.fill('.activity input.input', 'Soy de Islandia');
await page.click('.activity button:has-text("Send")');
await page.waitForTimeout(300);
await page.click('.activity button:text-is("End")');
await page.waitForSelector('text=Conversation review');
await page.screenshot({ path: `${SHOTS}/09-review.png`, fullPage: true });
console.log('REVIEW:\n' + (await page.locator('.activity-body').innerText()).slice(0, 800));
await page.click('.activity button:has-text("Done")');
await page.waitForSelector("text=Today's Spanish");
await page.screenshot({ path: `${SHOTS}/10-today-after.png`, fullPage: true });

// Immersion mode: jump the departure date to 3 days from now and reload.
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('tenerife-spanish:v1'));
  const d = new Date();
  d.setDate(d.getDate() + 3);
  s.settings.departureDate = d.toISOString().slice(0, 10);
  delete s.plans[Object.keys(s.plans)[0]];
  localStorage.setItem('tenerife-spanish:v1', JSON.stringify(s));
});
await page.reload();
await page.click('button:has-text("45 min")');
await page.waitForSelector('text=immersion');
await page.screenshot({ path: `${SHOTS}/11-immersion.png`, fullPage: true });
console.log('IMMERSION PLAN:\n' + (await page.locator('.list').innerText()));

console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
process.exit(errors.length ? 1 : 0);
