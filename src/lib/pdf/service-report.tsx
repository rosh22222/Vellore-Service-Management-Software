import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { pdfStyles as s } from "./styles";
import { PdfBrandHeader, pdfMoney, pdfSafeText } from "./branding";
import { date } from "@/lib/format";

type ServiceReportRecord = {
  serviceNumber: string;
  serviceDate: Date;
  complaintReported: string;
  problemFound: string;
  workDone: string;
  partsSummary: string;
  technicianNameSnapshot: string | null;
  customerNameSnapshot: string;
  customerPhoneSnapshot: string;
  customerAddressSnapshot: string;
  equipmentNameSnapshot: string | null;
  equipmentBrandSnapshot: string | null;
  modelSnapshot: string | null;
  serialSnapshot: string | null;
  warrantyExpirySnapshot: Date | null;
  warrantyStatus: string;
  completionNotes: string | null;
  notes: string | null;
  charges: { toString(): string };
  collections?: { amount: { toString(): string } }[];
  complaint: { complaintNumber: string };
};

type Company = {
  companyName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
} | null;

export function ServiceReportDocument({
  record,
  company,
}: {
  record: ServiceReportRecord;
  company: Company;
}) {
  const collected = (record.collections ?? []).reduce(
    (sum, collection) => sum + Number(collection.amount),
    0,
  );
  const pending = Math.max(0, Number(record.charges) - collected);
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <PdfBrandHeader company={company} title="SERVICE REPORT" />
        <View style={s.row}>
          <Box l="Service Number" v={record.serviceNumber} />
          <Box l="Complaint Number" v={record.complaint.complaintNumber} />
          <Box l="Service Date" v={date(record.serviceDate, true)} />
        </View>
        <View style={s.row}>
          <Box l="Customer" v={record.customerNameSnapshot} />
          <Box l="Phone" v={record.customerPhoneSnapshot} />
        </View>
        <View style={s.row}>
          <Box l="Address" v={record.customerAddressSnapshot} />
          <Box
            l="Warranty Status"
            v={record.warrantyStatus.replaceAll("_", " ")}
          />
        </View>
        <Text style={s.section}>Equipment</Text>
        <View style={s.row}>
          <Box l="Equipment" v={record.equipmentNameSnapshot ?? "-"} />
          <Box l="Brand" v={record.equipmentBrandSnapshot ?? "-"} />
          <Box l="Model" v={record.modelSnapshot ?? "-"} />
        </View>
        <View style={s.row}>
          <Box l="Serial Number" v={record.serialSnapshot ?? "-"} />
          <Box l="Warranty Expiry" v={date(record.warrantyExpirySnapshot)} />
        </View>
        <Text style={s.section}>Service Details</Text>
        <Box l="Complaint Reported" v={record.complaintReported} />
        <View style={{ height: 7 }} />
        <Box l="Problem Found" v={record.problemFound} />
        <View style={{ height: 7 }} />
        <Box l="Work Done" v={record.workDone} />
        <View style={{ height: 7 }} />
        <Box l="Parts Replaced" v={record.partsSummary} />
        <View style={{ height: 7 }} />
        <View style={s.row}>
          <Box l="Technician" v={record.technicianNameSnapshot ?? "-"} />
          <Box l="Service Amount" v={pdfMoney(record.charges)} />
        </View>
        <View style={s.row}>
          <Box l="Collected" v={pdfMoney(collected)} />
          <Box l="Pending Balance" v={pdfMoney(pending)} />
        </View>
        <Box
          l="Completion Notes"
          v={record.completionNotes ?? record.notes ?? "-"}
        />
        <View style={s.signature}>
          <Text style={s.sigBox}>Customer Signature</Text>
          <Text style={s.sigBox}>Technician Signature</Text>
        </View>
        <Text style={s.footer}>
          System-generated service report | Permanent record ID:{" "}
          {record.serviceNumber}
        </Text>
      </Page>
    </Document>
  );
}

function Box({ l, v }: { l: string; v: string }) {
  return (
    <View style={s.box}>
      <Text style={s.label}>{l}</Text>
      <Text style={s.value}>{pdfSafeText(v)}</Text>
    </View>
  );
}
