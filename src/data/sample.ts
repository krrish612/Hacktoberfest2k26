import type { Evidence, Gear, TimelineEvent } from "../types";

// Realistic sample records for the stage-1 UI. Nothing here is persisted; the
// SQLite-backed store replaces this module in stage 2.

export const gears: Gear[] = [
  {
    id: "gear-r6",
    name: "Canon EOS R6 Mark II",
    category: "Camera body",
    brand: "Canon",
    model: "EOS R6 Mark II",
    serialNumber: "1428 0001 2947",
    purchaseDate: "2025-11-08",
    purchasePrice: 2499,
    currency: "USD",
    seller: "B&H Photo Video",
    warrantyStart: "2025-11-08",
    warrantyEnd: "2027-11-08",
    warrantyConfirmed: true,
    warrantyTerms: "Canon CarePAK Plus, 2 years. Covers drops, spills, and a free annual clean.",
    notes: "Primary wedding body. Sensor cleaned before the June season.",
    createdAt: "2025-11-08T15:12:00.000Z",
    updatedAt: "2026-09-02T09:40:00.000Z",
  },
  {
    id: "gear-lens",
    name: "Canon RF 24-70mm F2.8 L IS USM",
    category: "Lens",
    brand: "Canon",
    model: "RF 24-70mm F2.8 L IS USM",
    serialNumber: "RF88420917",
    purchaseDate: "2024-06-20",
    purchasePrice: 2299,
    currency: "USD",
    seller: "Adorama",
    warrantyStart: "2024-06-20",
    warrantyEnd: "2026-06-20",
    warrantyConfirmed: true,
    warrantyTerms: "Canon 1-year limited manufacturer warranty plus 1-year extended cover.",
    notes: "Workhorse zoom. Front element shows light cleaning marks.",
    createdAt: "2024-06-20T11:05:00.000Z",
    updatedAt: "2026-07-14T18:22:00.000Z",
  },
  {
    id: "gear-flash",
    name: "Canon Speedlite EL-5",
    category: "Flash",
    brand: "Canon",
    model: "Speedlite EL-5",
    serialNumber: "EL500231",
    purchaseDate: "2026-08-30",
    purchasePrice: 399,
    currency: "USD",
    seller: "B&H Photo Video",
    warrantyStart: "2026-08-30",
    warrantyEnd: "2026-10-30",
    // Warranty dates are only ever stored alongside a confirmation (the backend
    // rejects unconfirmed dates), so the sample record has to agree.
    warrantyConfirmed: true,
    warrantyTerms: "60-day store replacement cover from the seller.",
    notes: "Second light for receptions. Store cover ends 30 Oct; decide on an extension before then.",
    createdAt: "2026-08-30T13:48:00.000Z",
    updatedAt: "2026-08-30T13:48:00.000Z",
  },
];

export const sampleGearId = gears[0].id;

const evidence: Evidence[] = [
  {
    id: "ev-receipt",
    gearId: "gear-r6",
    kind: "receipt",
    originalName: "BH-order-1048237.pdf",
    storedName: "a1f4c9e2b7d84f0e9c3a5b1d6e8f2a4c.pdf",
    mimeType: "application/pdf",
    byteSize: 184_320,
    sha256: "a1f4c9e2b7d84f0e9c3a5b1d6e8f2a4c7b3d9e1f5a2c8b6d4e0f7a3c9b5d1e2f",
    createdAt: "2025-11-08T15:14:00.000Z",
  },
  {
    id: "ev-warranty",
    gearId: "gear-r6",
    kind: "warranty",
    originalName: "CarePAK-Plus-Registration.pdf",
    storedName: "b2e5d0f3c8a94e1f0d4b6c2e7f9a3b5d.pdf",
    mimeType: "application/pdf",
    byteSize: 96_512,
    sha256: "b2e5d0f3c8a94e1f0d4b6c2e7f9a3b5d8c4e0f2a6b3d9c7e5f1a8b4d0c6e2f3",
    createdAt: "2025-11-08T15:20:00.000Z",
  },
  {
    id: "ev-serial",
    gearId: "gear-r6",
    kind: "serial_photo",
    originalName: "R6MkII-serial-plate.jpg",
    storedName: "c3f6e1a4d9b05f2a1e5c7d3f8a0b4c6e.jpg",
    mimeType: "image/jpeg",
    byteSize: 2_411_724,
    sha256: "c3f6e1a4d9b05f2a1e5c7d3f8a0b4c6e9d5f1a3b7c4e0d8f6a2b9c5e1d7f3a4",
    createdAt: "2025-11-09T08:02:00.000Z",
  },
  {
    id: "ev-lens-receipt",
    gearId: "gear-lens",
    kind: "receipt",
    originalName: "Adorama-88214.pdf",
    storedName: "d4a7f2b5e0c16a3b2f6d8e4a9b1c5d7f.pdf",
    mimeType: "application/pdf",
    byteSize: 121_088,
    sha256: "d4a7f2b5e0c16a3b2f6d8e4a9b1c5d7fa6e2b4c8d5f1a9b7c3d0e6f2b8c4d5a6",
    createdAt: "2024-06-20T11:08:00.000Z",
  },
];

const timeline: TimelineEvent[] = [
  {
    id: "tl-r6-buy",
    gearId: "gear-r6",
    kind: "purchase",
    occurredOn: "2025-11-08",
    title: "Purchased from B&H Photo Video",
    detail: "$2,499.00. Order BH-1048237.",
  },
  {
    id: "tl-r6-serial",
    gearId: "gear-r6",
    kind: "inspection",
    occurredOn: "2025-11-09",
    title: "Serial number verified",
    detail: "Plate photographed and matched to the order.",
  },
  {
    id: "tl-r6-warranty",
    gearId: "gear-r6",
    kind: "warranty_start",
    occurredOn: "2025-11-14",
    title: "CarePAK Plus registered",
    detail: "Cover confirmed through 8 Nov 2027.",
  },
  {
    id: "tl-r6-clean",
    gearId: "gear-r6",
    kind: "inspection",
    occurredOn: "2026-06-05",
    title: "Sensor cleaned and shutter count checked",
    detail: "18,400 actuations. No issues found.",
  },
  {
    id: "tl-r6-note",
    gearId: "gear-r6",
    kind: "note",
    occurredOn: "2026-09-02",
    title: "Grip plate scuffed at the right edge",
    detail: "Cosmetic only. Logged for the next repair packet.",
  },
  {
    id: "tl-lens-buy",
    gearId: "gear-lens",
    kind: "purchase",
    occurredOn: "2024-06-20",
    title: "Purchased from Adorama",
    detail: "$2,299.00. Order 88214.",
  },
  {
    id: "tl-flash-buy",
    gearId: "gear-flash",
    kind: "purchase",
    occurredOn: "2026-08-30",
    title: "Purchased from B&H Photo Video",
    detail: "$399.00. Store replacement cover ends 30 Oct 2026.",
  },
];

/** Evidence attached to a gear record, newest first. */
export function evidenceFor(gearId: string): Evidence[] {
  return evidence
    .filter((item) => item.gearId === gearId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Ownership timeline for a gear record, oldest first. */
export function timelineFor(gearId: string): TimelineEvent[] {
  return timeline
    .filter((item) => item.gearId === gearId)
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));
}
