import Link from "next/link";
import { notFound } from "next/navigation";
import { ServiceStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AutoDismissNotice } from "@/components/auto-dismiss-notice";
import { date, money } from "@/lib/format";

const terminalStatuses = [
  ServiceStatus.SERVICE_COMPLETED,
  ServiceStatus.CLOSED,
  ServiceStatus.CANCELLED,
];

export default async function ServiceRecordDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ visitCompleted?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const record = await db.serviceRecord.findUnique({
    where: { id },
    include: {
      technician: true,
      parts: true,
      collections: {
        include: { collectedBy: true },
        orderBy: { collectedAt: "desc" },
      },
      complaint: {
        include: {
          assignments: {
            include: { technician: true, assignedBy: true },
            orderBy: { assignedAt: "asc" },
          },
          statusHistory: {
            include: { changedBy: true },
            orderBy: { changedAt: "asc" },
          },
        },
      },
    },
  });
  if (!record) notFound();

  if (user.role === "TECHNICIAN") {
    const hasActiveEquipmentJob = record.equipmentId
      ? await db.serviceComplaint.count({
          where: {
            assignments: {
              some: {
                technicianId: user.technicianId ?? "__none__",
                isActive: true,
              },
            },
            equipmentId: record.equipmentId,
            status: { notIn: terminalStatuses },
          },
        })
      : 0;
    const wasAssigned = record.complaint.assignments.some(
      (assignment) => assignment.technicianId === user.technicianId,
    );
    if (!wasAssigned && !hasActiveEquipmentJob)
      notFound();
  }
  const collected = record.collections.reduce(
    (sum, collection) => sum + Number(collection.amount),
    0,
  );
  const totalCharges = Number(record.charges);
  const balance = Math.max(0, totalCharges - collected);
  const assignmentSummary = summarizeAssignments(record.complaint.assignments);

  return (
    <>
      <PageHeader
        title={record.serviceNumber}
        description={`Permanent service record • ${date(record.serviceDate, true)}`}
        actions={
          <>
            <DownloadLink preview
              className="rounded-xl border border-brand-border bg-white px-4 py-2.5 text-sm font-semibold"
              href={`/api/service-reports/${record.id}`}
            >
              Service Report PDF
            </DownloadLink>
          </>
        }
      />
      {query.visitCompleted === "1" && (
        <AutoDismissNotice className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          All equipment services in this customer visit are completed. Every
          machine now has its own permanent service record.
        </AutoDismissNotice>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Customer / Equipment Snapshot"
            subtitle="These details were frozen when the service was completed."
          />
          <CardBody className="grid grid-cols-2 gap-5">
            <Data label="Customer" value={record.customerNameSnapshot} />
            <Data label="Phone" value={record.customerPhoneSnapshot} />
            <div className="col-span-2">
              <Data label="Address" value={record.customerAddressSnapshot} />
            </div>
            <Data label="Equipment" value={record.equipmentNameSnapshot} />
            <Data label="Brand" value={record.equipmentBrandSnapshot} />
            <Data label="Model" value={record.modelSnapshot} />
            <Data label="Serial" value={record.serialSnapshot} />
            <Data
              label="Warranty Expiry"
              value={date(record.warrantyExpirySnapshot)}
            />
            <div>
              <div className="label">Warranty Snapshot</div>
              <div className="value">
                <Badge value={record.warrantyStatus} />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Service Result" />
          <CardBody className="space-y-5">
            <Data
              label="Customer Complaint"
              value={record.complaintReported}
              boxed
            />
            <Data label="Problem Found" value={record.problemFound} />
            <Data label="Work Done" value={record.workDone} />
          </CardBody>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader title="Parts / Service Amount / Technician" />
        <CardBody className="grid gap-5 md:grid-cols-3">
          <Data label="Parts Replaced" value={record.partsSummary} />
          <Data
            label="Technician"
            value={
              assignmentSummary.technicians ||
              record.technicianNameSnapshot ||
              record.technician?.name
            }
          />
          <div>
            <div className="label">Service Amount</div>
            <div className="value text-xl font-bold">
              {money(record.charges)}
            </div>
          </div>
          <div className="md:col-span-3">
            <Data label="Completion Notes" value={record.completionNotes} />
          </div>
        </CardBody>
      </Card>
      <Card className="mt-6">
        <CardHeader
          title="Service Collections"
          subtitle="Payment received and pending balance for this completed service."
        />
        <CardBody>
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <MoneyBox label="Service Amount" value={totalCharges} />
            <MoneyBox label="Collected" value={collected} green />
            <MoneyBox label="Pending" value={balance} red />
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Collection</th>
                  <th>Date</th>
                  <th>Mode</th>
                  <th>Collected By</th>
                  <th>Amount</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {record.collections.map((collection) => (
                  <tr key={collection.id}>
                    <td>{collection.collectionNumber}</td>
                    <td>{date(collection.collectedAt)}</td>
                    <td>{collection.paymentMode.replaceAll("_", " ")}</td>
                    <td>{collection.collectedBy.name}</td>
                    <td>{money(collection.amount)}</td>
                    <td>
                      {[collection.receivedFrom, collection.notes]
                        .filter(Boolean)
                        .join(" • ") || "—"}
                    </td>
                  </tr>
                ))}
                {record.collections.length === 0 && (
                  <tr>
                    <td colSpan={6}>No collection received yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
      <Card className="mt-6">
        <CardHeader title="Technician Assignment History" />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Technician</th>
                <th>Assigned By</th>
                <th>Assigned</th>
                <th>Ended</th>
                <th>Assignment Note</th>
                <th>Ended Reason</th>
              </tr>
            </thead>
            <tbody>
              {record.complaint.assignments.length ? (
                <tr>
                  <td className="font-semibold">{assignmentSummary.technicians}</td>
                  <td>{assignmentSummary.assignedBy}</td>
                  <td>{assignmentSummary.assignedAt}</td>
                  <td>{assignmentSummary.endedAt}</td>
                  <td>{assignmentSummary.notes}</td>
                  <td>{assignmentSummary.endedReasons}</td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={6}>No technician assignment history.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="mt-6">
        <CardHeader title="Original Activity Trail" />
        <CardBody>
          <div className="space-y-3">
            {record.complaint.statusHistory.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center gap-2 rounded-xl bg-brand-subtle p-3"
              >
                <Badge value={item.newStatus} />
                <span className="text-sm text-brand-secondary">
                  {date(item.changedAt, true)} • {item.changedBy.name}
                </span>
                {item.notes && (
                  <span className="text-sm text-brand-muted">• {item.notes}</span>
                )}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </>
  );
}

function summarizeAssignments(
  assignments: Array<{
    technician: { name: string };
    assignedBy: { name: string };
    assignedAt: Date;
    unassignedAt: Date | null;
    reason: string | null;
    endedReason: string | null;
  }>,
) {
  const join = (values: Array<string | null | undefined>, separator = " / ") => {
    const unique = Array.from(
      new Set(values.filter((value): value is string => Boolean(value))),
    );
    return unique.join(separator);
  };
  return {
    technicians: join(assignments.map((item) => item.technician.name), " & "),
    assignedBy: join(assignments.map((item) => item.assignedBy.name), " & ") || "—",
    assignedAt:
      join(assignments.map((item) => date(item.assignedAt, true))) || "—",
    endedAt:
      join(
        assignments
          .filter((item) => item.unassignedAt)
          .map((item) => date(item.unassignedAt, true)),
      ) || "—",
    notes: join(assignments.map((item) => item.reason)) || "—",
    endedReasons: join(assignments.map((item) => item.endedReason)) || "—",
  };
}

function MoneyBox({
  label,
  value,
  green,
  red,
}: {
  label: string;
  value: number;
  green?: boolean;
  red?: boolean;
}) {
  return (
    <div className="rounded-xl bg-brand-subtle p-3 ring-1 ring-brand-border">
      <div className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
        {label}
      </div>
      <div
        className={`mt-1 text-lg font-bold ${green ? "text-emerald-700" : red ? "text-rose-700" : "text-brand-ink"}`}
      >
        {money(value)}
      </div>
    </div>
  );
}

function Data({
  label,
  value,
  boxed = false,
}: {
  label: string;
  value: string | null | undefined;
  boxed?: boolean;
}) {
  return (
    <div>
      <div className="label">{label}</div>
      <div
        className={`value whitespace-pre-line ${boxed ? "rounded-xl bg-brand-subtle p-3" : ""}`}
      >
        {value || "—"}
      </div>
    </div>
  );
}

import { DownloadLink } from "@/components/download-link";
