const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target1 = `             await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
             // Wait briefly to ensure content loads
             await new Promise(r => setTimeout(r, 2000));
             html = await page.content();
          } catch(e) {
             console.error("Puppeteer proxy visual error:", e);
             return res.status(500).send("Error fetching visual proxy with Puppeteer");
          }`;

const replace1 = `             try {
                await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await new Promise(r => setTimeout(r, 3000));
             } catch(e) {
                console.log("Puppeteer goto timeout/error (ignoring):", e.message);
             }
             html = await page.content();
          } catch(e) {
             console.error("Puppeteer proxy visual error:", e);
             return res.status(500).send("Error fetching visual proxy with Puppeteer");
          }`;

const target2 = `             await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
             await new Promise(r => setTimeout(r, 2000));
             const html = await page.content();
             res.setHeader('Content-Type', 'text/html');
             return res.send(html);
          } catch(e) {
             console.error("Puppeteer proxy error:", e);
             return res.status(500).json({ error: "Error fetching with Puppeteer" });
          }`;

const replace2 = `             try {
                await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await new Promise(r => setTimeout(r, 3000));
             } catch(e) {
                console.log("Puppeteer goto timeout/error (ignoring):", e.message);
             }
             const html = await page.content();
             res.setHeader('Content-Type', 'text/html');
             return res.send(html);
          } catch(e) {
             console.error("Puppeteer proxy error:", e);
             return res.status(500).json({ error: "Error fetching with Puppeteer" });
          }`;

code = code.replace(target1, replace1).replace(target2, replace2);
fs.writeFileSync('server.ts', code);
