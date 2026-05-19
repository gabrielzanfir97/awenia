import { searchInternet } from "./internet";

export async function learnFromInternet(topic: string) {
  const result = await searchInternet(topic);

  return {
    topic,
    learned: result.slice(0, 2000),
    timestamp: new Date().toISOString(),
    status: "learned",
  };
}