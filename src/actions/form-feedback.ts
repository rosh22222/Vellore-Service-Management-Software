"use server";

import { unstable_rethrow } from "next/navigation";

// Every supplied action remains responsible for authorization and validation.
export async function submitWithFeedback(
  action: (data: FormData) => Promise<unknown>,
  data: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    await action(data);
    return { ok: true, message: "Changes saved successfully." };
  } catch (error) {
    unstable_rethrow(error);
    const code = (error as { code?: string })?.code;
    if (code === "P2002") return { ok: false, message: "This number, username or serial number is already in use. Please check your details." };
    if (code === "P2003") return { ok: false, message: "This record is linked to other records and cannot be removed." };
    if (code === "P2025") return { ok: false, message: "This record is no longer available. Refresh the page and try again." };
    if (code === "P2028") return { ok: false, message: "Saving took too long. Check the bill register before retrying. If it is not saved, please try again." };
    if (code === "P2034") return { ok: false, message: "Another change was being saved at the same time. Please refresh and try again." };
    if (code || !(error instanceof Error) || /prisma|ConnectorError|database server/i.test(error.message)) {
      console.error("Form action failed", error);
      return { ok: false, message: "We could not save your changes. Please check the database connection and try again." };
    }
    return { ok: false, message: error.message };
  }
}
