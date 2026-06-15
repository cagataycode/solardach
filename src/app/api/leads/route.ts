import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";

const CONSENT_TEXTS = {
  CONTACT:
    "Ich stimme zu, dass solar-dach mich per E-Mail oder Telefon zu meiner Solar-Anfrage kontaktiert. Diese Einwilligung kann ich jederzeit widerrufen.",
  LEAD_SHARING:
    "Ich stimme zu, dass meine Anfrage und Kontaktdaten an einen passenden Solar-Fachbetrieb in meiner Region weitergegeben werden, damit dieser mir ein Angebot erstellen kann. Diese Einwilligung kann ich jederzeit widerrufen.",
} as const;

const leadSchema = z.object({
  checkId: z.string().min(1),
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().max(40).optional(),
  isOwner: z.boolean().optional(),
  plannedTimeframe: z.enum(["0-3m", "3-12m", "researching"]).optional(),
  // Both consents must be explicit, unticked-by-default checkboxes in the UI.
  consentContact: z.literal(true),
  consentLeadSharing: z.literal(true),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Bitte füllen Sie alle Pflichtfelder aus und bestätigen Sie beide Einwilligungen." },
      { status: 400 }
    );
  }
  const d = parsed.data;

  const check = await db.propertyCheck.findUnique({
    where: { id: d.checkId },
    include: { lead: true },
  });
  if (!check) {
    return NextResponse.json({ error: "Anfrage nicht gefunden." }, { status: 404 });
  }
  if (check.lead) {
    return NextResponse.json(
      { error: "Für diese Adresse liegt bereits eine Anfrage vor." },
      { status: 409 }
    );
  }

  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const userAgent = req.headers.get("user-agent") ?? undefined;
  const doubleOptInToken = randomBytes(24).toString("hex");

  const lead = await db.lead.create({
    data: {
      propertyCheckId: check.id,
      name: d.name,
      email: d.email,
      phone: d.phone,
      isOwner: d.isOwner,
      plannedTimeframe: d.plannedTimeframe,
      status: "DOUBLE_OPT_IN_PENDING",
      doubleOptInToken,
      consents: {
        create: [
          {
            consentType: "CONTACT",
            granted: true,
            consentText: CONSENT_TEXTS.CONTACT,
            ipAddress,
            userAgent,
          },
          {
            consentType: "LEAD_SHARING",
            granted: true,
            consentText: CONSENT_TEXTS.LEAD_SHARING,
            ipAddress,
            userAgent,
          },
        ],
      },
    },
  });

  await db.auditLog.create({
    data: {
      actor: "system",
      action: "lead.created",
      entity: "Lead",
      entityId: lead.id,
      detail: `checkId=${check.id}`,
    },
  });

  // TODO(pilot): send double opt-in email via an ESP (EU-hosted, e.g. Brevo).
  // For now the confirmation link is logged so the flow can be tested locally.
  console.log(
    `[double-opt-in] ${d.email} -> /api/leads/confirm?token=${doubleOptInToken}`
  );

  return NextResponse.json({ leadId: lead.id, status: lead.status });
}
