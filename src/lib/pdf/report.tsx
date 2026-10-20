import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { pdfStyles as s } from "./styles";
import { PdfBrandHeader, pdfMoney, pdfSafeText } from "./branding";
import { date } from "@/lib/format";
export function SummaryReportDocument({
  rows,
  company,
  from,
  to,
}: {
  rows: any[];
  company: any;
  from: Date;
  to: Date;
}) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <PdfBrandHeader
          company={company}
          title={`SERVICE REPORT - ${date(from)} to ${date(to)}`}
        />
        <View style={s.tableHead}>
          <Text style={{ width: "10%" }}>Date</Text>
          <Text style={{ width: "12%" }}>Service</Text>
          <Text style={{ width: "16%" }}>Customer</Text>
          <Text style={{ width: "14%" }}>Equipment</Text>
          <Text style={{ width: "18%" }}>Problem Found</Text>
          <Text style={{ width: "12%", paddingLeft: 4 }}>Technician</Text>
          <Text style={{ width: "10%" }}>Amount</Text>
          <Text style={{ width: "9%" }}>Collected</Text>
          <Text style={{ width: "9%" }}>Pending</Text>
        </View>
        {rows.map((r) => {
          const collected = (r.collections ?? []).reduce(
            (sum: number, collection: any) => sum + Number(collection.amount),
            0,
          );
          const pending = Math.max(0, Number(r.charges) - collected);
          return (
            <View style={s.tableRow} key={r.id}>
              <Text style={{ width: "10%", paddingRight: 4 }}>
                {date(r.serviceDate)}
              </Text>
              <Text style={{ width: "12%", paddingRight: 4 }}>
                {pdfSafeText(r.serviceNumber)}
              </Text>
              <Text style={{ width: "16%", paddingRight: 4 }}>
                {pdfSafeText(r.customerNameSnapshot)}
              </Text>
              <Text style={{ width: "14%", paddingRight: 4 }}>
                {pdfSafeText(r.equipmentNameSnapshot ?? "-")}
              </Text>
              <Text style={{ width: "18%", paddingRight: 4 }}>
                {pdfSafeText(r.problemFound)}
              </Text>
              <Text style={{ width: "12%", paddingLeft: 4, paddingRight: 4 }}>
                {pdfSafeText(r.technicianNameSnapshot ?? "-")}
              </Text>
              <Text style={{ width: "10%" }}>{pdfMoney(r.charges)}</Text>
              <Text style={{ width: "9%" }}>{pdfMoney(collected)}</Text>
              <Text style={{ width: "9%" }}>{pdfMoney(pending)}</Text>
            </View>
          );
        })}
        <Text style={s.footer}>
          Generated from VFE Service Management System
        </Text>
      </Page>
    </Document>
  );
}
