import React from "react";
import { Image, Text, View } from "@react-pdf/renderer";
import { pdfStyles as s } from "./styles";
import { getBrandAssetDataUrl } from "../brand-assets";

export function pdfSafeText(value: unknown) {
  return String(value ?? "-")
    .replaceAll("•", "-")
    .replaceAll("—", "-")
    .replaceAll("–", "-")
    .replaceAll("‑", "-");
}

export function pdfMoney(value: unknown) {
  return `Rs. ${Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function PdfBrandHeader({
  company,
  title,
}: {
  company: {
    companyName?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    gstNumber?: string | null;
  } | null;
  title: string;
}) {
  const contact = [
    company?.phone,
    company?.email,
    company?.website,
    company?.gstNumber ? `GST: ${company.gstNumber}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  return (
    <View style={s.header}>
      <Image src={getBrandAssetDataUrl("vellore-logo-transparent.png")} style={s.logo} />
      <View style={s.headerDetails}>
        <Text style={s.company}>
          {pdfSafeText(company?.companyName ?? "VELLORE FITNESS EQUIPMENTS")}
        </Text>
        {company?.address && (
          <Text style={s.contact}>{pdfSafeText(company.address)}</Text>
        )}
        {contact && <Text style={s.contact}>{contact}</Text>}
        <Text style={s.title}>{pdfSafeText(title)}</Text>
      </View>
    </View>
  );
}
