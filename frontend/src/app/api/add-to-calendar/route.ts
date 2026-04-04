import { NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"

interface CalendarEvent {
  title: string
  description?: string
  date: string
  time?: string
}

function normalizeDate(date: string): string | null {
  const match = date.trim().match(/^\d{4}-\d{2}-\d{2}/)
  return match ? match[0] : null
}

function addOneHour(date: string, time: string): string {
  const [hours, minutes] = time.split(":").map(Number)
  const newHours = (hours + 1) % 24
  return `${String(newHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

function addOneDay(date: string): string {
  const next = new Date(`${date}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString().slice(0, 10)
}

export async function POST(request: NextRequest) {
  try {
    const { events, accessToken }: { events: CalendarEvent[]; accessToken: string } =
      await request.json()

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "Missing access token" },
        { status: 401 }
      )
    }

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { success: false, error: "No events provided" },
        { status: 400 }
      )
    }

    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })

    const calendar = google.calendar({ version: "v3", auth })

    let addedCount = 0
    const errors: string[] = []

    for (const event of events) {
      try {
        const normalizedDate = normalizeDate(event.date)
        if (!normalizedDate) {
          throw new Error(`Invalid date format: ${event.date}`)
        }

        const startDateTime = event.time
          ? `${normalizedDate}T${event.time}:00`
          : normalizedDate
        const endDateTime = event.time
          ? `${normalizedDate}T${addOneHour(normalizedDate, event.time)}:00`
          : addOneDay(normalizedDate)

        await calendar.events.insert({
          calendarId: "primary",
          requestBody: {
            summary: event.title,
            description: event.description || "",
            start: event.time
              ? { dateTime: startDateTime, timeZone: "UTC" }
              : { date: normalizedDate },
            end: event.time
              ? { dateTime: endDateTime, timeZone: "UTC" }
              : { date: endDateTime },
          },
        })

        addedCount++
      } catch (error: unknown) {
        const err = error as { message?: string }
        errors.push(`Failed to add "${event.title}": ${err.message || "Unknown error"}`)
      }
    }

    if (addedCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: errors[0] || "No calendar events could be added",
          added: addedCount,
          total: events.length,
          errors: errors.length > 0 ? errors : undefined,
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      added: addedCount,
      total: events.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    return NextResponse.json(
      { success: false, error: err.message || "Failed to add events to calendar" },
      { status: 500 }
    )
  }
}
