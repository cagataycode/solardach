/** Dev-only helper: drive the funnel in headless Chrome and screenshot the 3D viewer. */
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const ADDRESS = process.argv[2] ?? "Eichenweg 7, 50859 Köln";

async function main() {
  const browser = await puppeteer.launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--no-sandbox", "--hide-scrollbars"],
    defaultViewport: { width: 1280, height: 900, deviceScaleFactor: 2 },
  });
  const page = await browser.newPage();
  await page.goto(BASE, { waitUntil: "networkidle0" });
  await page.screenshot({ path: "screenshots/landing.png" });

  await page.type("#address", ADDRESS);
  await page.click("button[type=submit]");
  await page.waitForSelector("canvas", { timeout: 60000 });
  // Let the scene render a few frames and textures settle.
  await new Promise((r) => setTimeout(r, 2500));
  await page.screenshot({ path: "screenshots/result-3d.png" });

  const canvas = await page.$("canvas");
  if (canvas) {
    const box = await canvas.boundingBox();
    if (box) {
      await page.screenshot({
        path: "screenshots/viewer-closeup.png",
        clip: box,
      });
    }
  }
  await browser.close();
  console.log("screenshots written to ./screenshots/");
}

main();
