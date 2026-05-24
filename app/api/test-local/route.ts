import { NextResponse } from "next/server";
import { testLocalAI } from "@/app/test-local";

export async function GET() {
  const result = await testLocalAI();

  return NextResponse.json({
    success: true,
    result,
  });
}