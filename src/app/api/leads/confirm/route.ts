import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Double opt-in confirmation endpoint (linked from the confirmation email). */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token fehlt." }, { status: 400 });
  }

  const lead = await db.lead.findUnique({ where: { doubleOptInToken: token } });
  if (!lead) {
    return NextResponse.json({ error: "Ungültiger oder abgelaufener Link." }, { status: 404 });
  }

  if (!lead.doubleOptInConfirmedAt) {
    await db.lead.update({
      where: { id: lead.id },
      data: { status: "CONFIRMED", doubleOptInConfirmedAt: new Date() },
    });
    await db.auditLog.create({
      data: {
        actor: "system",
        action: "lead.double_opt_in_confirmed",
        entity: "Lead",
        entityId: lead.id,
      },
    });
  }

  return NextResponse.redirect(new URL("/bestaetigt", req.url));
}
