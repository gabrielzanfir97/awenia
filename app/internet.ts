import axios from "axios";
import * as cheerio from "cheerio";

export async function searchInternet(topic: string) {
  try {
    const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(topic)}`;

    const response = await axios.get(url);

    const $ = cheerio.load(response.data);

    const text = $("p")
      .slice(0, 5)
      .text()
      .replace(/\[\d+\]/g, "");

    return text.slice(0, 2000);
  } catch {
    return "Nu am reușit să găsesc informații online.";
  }
}