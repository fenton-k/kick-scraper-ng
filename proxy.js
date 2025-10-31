// test-proxy.js
import fetch from "node-fetch";
import { HttpsProxyAgent } from "https-proxy-agent";

const proxyUrl = "https://200.105.192.6:5678"; // your proxy

async function testProxy() {
  try {
    const res = await fetch("https://www.kickstarter.com/graph", {
      method: "POST", // just a simple GET to test connectivity
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.kickstarter.com/", // Critical: Makes the request look like it came from the site
        Origin: "https://www.kickstarter.com",
      },
    });

    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response snippet:", text.slice(0, 200));
  } catch (err) {
    console.error("Proxy test failed:", err.message);
  }
}

testProxy();
