import { config } from "./auth.ts";
import { mailStatus } from "./mail.ts";
export async function mailReadiness() {
  const mail = mailStatus();
  if (mail.mailbox.toLowerCase() !== "adam@adampruska.cz") {
    return {
      status: "sender_mismatch",
      configured: mail.mail_send,
      domainVerified: null,
    };
  }
  if (["icloud_smtp", "icloud_relay"].includes(mail.mail_transport)) {
    return {
      status: mail.mail_send ? "smtp_unverified" : "missing_credentials",
      configured: mail.mail_send,
      domainVerified: null,
    };
  }
  if (mail.mail_provider !== "icloud") {
    return {
      status: mail.mail_send ? "smtp_unverified" : "missing_credentials",
      configured: mail.mail_send,
      domainVerified: null,
    };
  }
  const key = config("RESEND_API_KEY", false);
  if (!key) {
    return { status: "missing_key", configured: false, domainVerified: null };
  }
  try {
    const response = await fetch("https://api.resend.com/domains?limit=100", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return {
        status: response.status === 401
          ? "key_rejected"
          : response.status === 403
          ? "key_scope_unknown"
          : "check_unavailable",
        configured: true,
        domainVerified: null,
      };
    }
    const result = await response.json();
    if (!Array.isArray(result?.data)) {
      return {
        status: "check_unavailable",
        configured: true,
        domainVerified: null,
      };
    }
    const domain = result.data.find((item: any) =>
      item.name?.toLowerCase() === "adampruska.cz"
    );
    if (!domain) {
      return {
        status: result.has_more ? "check_unavailable" : "domain_missing",
        configured: true,
        domainVerified: false,
      };
    }
    return {
      status: domain.status === "verified" ? "ready" : "domain_pending",
      configured: true,
      domainVerified: domain.status === "verified",
    };
  } catch {
    return {
      status: "check_unavailable",
      configured: true,
      domainVerified: null,
    };
  }
}

export async function bookingMailReadiness() {
  if ((config("BOOKING_EMAIL_MODE", false) || "cal") !== "app") {
    return { status: "cal_managed", configured: true, domainVerified: null };
  }
  return mailReadiness();
}
