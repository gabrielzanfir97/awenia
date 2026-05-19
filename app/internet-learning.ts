import { searchInternet } from "./internet";
import { supabase } from "./supabase";

export async function learnFromInternet(topic: string) {
  const result = await searchInternet(topic);

  const learned = result.slice(0, 2000);

  await supabase.from("internet_learning").insert({
    topic,
    learned,
    status: "learned",
  });

  return {
    topic,
    learned,
    timestamp: new Date().toISOString(),
    status: "learned",
  };
}