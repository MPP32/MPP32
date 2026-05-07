import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { ContactMessageSchema } from "../types"
import { prisma } from "../lib/db.js"
import { env } from "../env"

const contactRouter = new Hono()

contactRouter.post(
  "/",
  zValidator("json", ContactMessageSchema),
  async (c) => {
    const data = c.req.valid("json")

    const msg = await prisma.contactMessage.create({
      data: {
        name: data.name,
        email: data.email,
        subject: data.subject,
        message: data.message,
      },
    })

    if (env.RESEND_API_KEY) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "MPP32 Contact <onboarding@resend.dev>",
            to: env.CONTACT_NOTIFY_EMAIL || "delivered@resend.dev",
            subject: `[MPP32 Contact] ${data.subject} - from ${data.name}`,
            text: `Name: ${data.name}\nEmail: ${data.email}\nSubject: ${data.subject}\n\n${data.message}`,
          }),
        })
        if (!res.ok) {
          console.error("Resend email failed:", await res.text())
        }
      } catch (err) {
        console.error("Failed to send notification email:", err)
      }
    }

    return c.json({
      data: {
        id: msg.id,
        createdAt: msg.createdAt.toISOString(),
      },
    })
  }
)

contactRouter.get("/", async (c) => {
  const secret = c.req.header("x-admin-key")
  if (!secret || secret !== env.MPP_SECRET_KEY) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401)
  }

  const messages = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return c.json({
    data: messages.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      subject: m.subject,
      message: m.message,
      isRead: m.isRead,
      createdAt: m.createdAt.toISOString(),
    })),
  })
})

export { contactRouter }
