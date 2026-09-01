import { NextResponse } from "next/server";
import {
  archiveBillingSubmission,
  createBillingSubmission,
  deleteBillingSubmission,
  readBillingBoard,
  updateBillingSubmissionActivities,
} from "@/lib/billing/store";
import type { CreateBillingSubmissionInput, BillingSubmission } from "@/lib/billing/types";
import { requireAdmin, requireModule } from "@/lib/auth/server";
import { readTasksBoardFull } from "@/lib/tasks/store";

function billingSaveErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : error &&
          typeof error === "object" &&
          "message" in error &&
          typeof (error as { message: unknown }).message === "string"
        ? (error as { message: string }).message
        : "";

  if (raw.includes("billing_submissions") || raw.includes("42P01")) {
    return (
      "Supabase aún no tiene la tabla de cuentas de cobro. " +
      "Ejecuta en el SQL Editor el archivo supabase/add-billing-submissions.sql."
    );
  }

  if (raw) return raw;
  return "No se pudo guardar la cuenta de cobro";
}

function sanitizeSubmissionForRole(
  submission: BillingSubmission,
  isAdmin: boolean,
): BillingSubmission {
  if (isAdmin) return submission;
  return {
    ...submission,
    fileUrl: "",
    fileName: "",
  };
}

export async function GET() {
  const session = await requireModule("cuentas-cobro");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [board, tasksBoard] = await Promise.all([
      readBillingBoard(),
      readTasksBoardFull(),
    ]);

    const isAdmin = session.role === "admin";
    const visibleSubmissions = isAdmin
      ? board.submissions
      : board.submissions.filter((item) => !item.archivedAt);

    return NextResponse.json({
      submissions: visibleSubmissions.map((item) =>
        sanitizeSubmissionForRole(item, isAdmin),
      ),
      members: tasksBoard.members,
      taskActivities: tasksBoard.activities,
      isAdmin,
    });
  } catch (error) {
    console.error("readBillingBoard failed:", error);
    return NextResponse.json(
      { error: billingSaveErrorMessage(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await requireModule("cuentas-cobro");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as CreateBillingSubmissionInput | null;
  if (
    !body ||
    !body.memberId ||
    !body.periodStart ||
    !body.periodEnd ||
    !body.fileUrl
  ) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  if (!Array.isArray(body.activities) || body.activities.length === 0) {
    return NextResponse.json(
      { error: "Agrega al menos una actividad realizada en el periodo" },
      { status: 400 },
    );
  }

  try {
    const tasksBoard = await readTasksBoardFull();
    const member = tasksBoard.members.find((item) => item.id === body.memberId);
    if (!member) {
      return NextResponse.json({ error: "Integrante no encontrado" }, { status: 400 });
    }

    const submission = await createBillingSubmission({
      memberId: body.memberId,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      fileUrl: body.fileUrl,
      fileName: body.fileName || "cuenta-de-cobro",
      activities: body.activities.map((line) => String(line).trim()).filter(Boolean),
      notes: body.notes || "",
    });

    const isAdmin = session.role === "admin";

    return NextResponse.json({
      ok: true,
      submission: sanitizeSubmissionForRole(submission, isAdmin),
    });
  } catch (error) {
    console.error("createBillingSubmission failed:", error);
    return NextResponse.json(
      { error: billingSaveErrorMessage(error) },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    action?: string;
    activities?: string[];
  } | null;

  if (body?.action === "archive") {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const submission = await archiveBillingSubmission(id);
      return NextResponse.json({
        ok: true,
        submission: sanitizeSubmissionForRole(submission, true),
      });
    } catch (error) {
      console.error("archiveBillingSubmission failed:", error);
      return NextResponse.json(
        { error: billingSaveErrorMessage(error) },
        { status: 500 },
      );
    }
  }

  if (body?.action === "updateActivities") {
    const session = await requireModule("cuentas-cobro");
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!Array.isArray(body.activities)) {
      return NextResponse.json({ error: "Actividades inválidas" }, { status: 400 });
    }

    try {
      const submission = await updateBillingSubmissionActivities(id, body.activities);
      const isAdmin = session.role === "admin";
      return NextResponse.json({
        ok: true,
        submission: sanitizeSubmissionForRole(submission, isAdmin),
      });
    } catch (error) {
      console.error("updateBillingSubmissionActivities failed:", error);
      return NextResponse.json(
        { error: billingSaveErrorMessage(error) },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}

export async function DELETE(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    await deleteBillingSubmission(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("deleteBillingSubmission failed:", error);
    return NextResponse.json(
      { error: billingSaveErrorMessage(error) },
      { status: 500 },
    );
  }
}
