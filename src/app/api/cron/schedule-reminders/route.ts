import { NextResponse } from "next/server";
import { runScheduleReminders } from "@/lib/schedule/reminders";

function authorize(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    // En desarrollo permite llamada local sin secreto.
    if (process.env.NODE_ENV !== "production") return true;
    return false;
  }

  const header = request.headers.get("authorization") || "";
  if (header === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  if (url.searchParams.get("secret") === secret) return true;

  return false;
}

async function handle(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun =
    url.searchParams.get("dryRun") === "1" ||
    url.searchParams.get("dry") === "1";

  try {
    const result = await runScheduleReminders({ dryRun });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al enviar recordatorios";
    console.error("schedule reminders failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
