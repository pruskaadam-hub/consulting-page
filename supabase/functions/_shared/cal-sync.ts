import { ApiError } from "./contracts.mjs";
import { serviceClient } from "./auth.ts";
export function bookingRecord(item: any, observedAt: string) {
  const state = String(item?.status || "").toLowerCase();
  const status = ({
    accepted: "accepted",
    pending: "pending",
    unconfirmed: "pending",
    cancelled: "cancelled",
    canceled: "cancelled",
    rejected: "cancelled",
  } as Record<string, string>)[state];
  const attendee = item?.attendees?.[0];
  if (
    !status || typeof item?.uid !== "string" ||
    !/^[a-zA-Z0-9_-]{1,200}$/.test(item.uid) ||
    !Number.isFinite(Date.parse(item.start)) ||
    typeof attendee?.name !== "string" || typeof attendee?.email !== "string"
  ) throw new ApiError("Cal.com vrátilo neúplné údaje rezervace.", 502);
  return {
    p_uid: item.uid,
    p_name: attendee.name.slice(0, 200),
    p_email: attendee.email.slice(0, 254),
    p_title: String(item.title || "Konzultace").slice(0, 500),
    p_starts: new Date(item.start).toISOString(),
    p_status: status,
    p_event_time: observedAt,
  };
}
export async function saveBooking(item: any, observedAt: string) {
  const result = await serviceClient().rpc(
    "apply_booking",
    bookingRecord(item, observedAt),
  );
  if (result.error) {
    throw new ApiError("Rezervaci se nepodařilo uložit do přehledu.", 502);
  }
}
export async function syncBookings(fetchCal: (path: string) => Promise<any>) {
  // A snapshot must never overwrite a webhook received after this request started.
  const observedAt = new Date().toISOString();
  const result = await fetchCal(
    "/bookings?take=100&sortUpdatedAt=desc&status=upcoming,past,cancelled,unconfirmed",
  );
  if (
    result?.status !== "success" || !Array.isArray(result.data) ||
    result.data.length > 100
  ) throw new ApiError("Cal.com nevrátilo platný přehled rezervací.", 502);
  const records = result.data.map((item: any) =>
    bookingRecord(item, observedAt)
  );
  const db = serviceClient();
  // Validate the complete response before modifying any local records.
  for (let offset = 0; offset < records.length; offset += 10) {
    const writes = await Promise.allSettled(
      records.slice(offset, offset + 10).map((record: any) =>
        db.rpc("apply_booking", record)
      ),
    );
    if (
      writes.some((result) =>
        result.status === "rejected" || result.value.error
      )
    ) {
      throw new ApiError(
        "Synchronizace se nedokončila. Opakování nevytvoří duplicitní rezervace.",
        502,
      );
    }
  }
  return {
    synced: records.length,
    syncedAt: observedAt,
    hasMore: result.pagination?.hasMore === true,
  };
}
