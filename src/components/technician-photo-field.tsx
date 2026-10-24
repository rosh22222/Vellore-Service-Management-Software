"use client";

import { useRef, useState } from "react";
import { Camera, Link2, Trash2, UserRound } from "lucide-react";
import { Field, Input } from "@/components/ui/form";
import { DismissibleErrorDialog } from "@/components/dismissible-error-dialog";

const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_SIDE = 640;

async function resizePhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Select a PNG, JPG or WebP image.");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("Image must be smaller than 8 MB.");
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("This image could not be opened."));
      image.src = source;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing is unavailable in this browser.");
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/webp", 0.82);
  } finally {
    URL.revokeObjectURL(source);
  }
}

export function TechnicianPhotoField({ defaultValue = "" }: { defaultValue?: string | null }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="md:col-span-2">
      <Field label="Technician Photo" hint="Optional. Upload an image or paste a direct image link.">
        <input type="hidden" name="photoUrl" value={value} />
        <div className="grid gap-4 rounded-2xl border border-brand-border bg-brand-faint/60 p-4 sm:grid-cols-[112px_1fr] sm:items-center">
          <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border border-brand-border bg-white shadow-sm">
            {value ? (
              // A data URL or user-supplied HTTPS URL must both preview here.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt="Technician preview" className="h-full w-full object-cover" onError={() => setError("The image link could not be loaded.")} />
            ) : (
              <UserRound size={42} className="text-brand-muted" aria-hidden="true" />
            )}
          </div>
          <div className="space-y-3">
            <div className="relative">
              <Link2 aria-hidden="true" size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-muted" />
              <Input
                type="url"
                aria-label="Technician photo link"
                placeholder="https://example.com/technician-photo.jpg"
                value={value.startsWith("data:") ? "" : value}
                onChange={(event) => {
                  setError("");
                  setValue(event.target.value);
                }}
                className="pl-10"
              />
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setError("");
                try {
                  setValue(await resizePhoto(file));
                } catch (uploadError) {
                  setError(uploadError instanceof Error ? uploadError.message : "Photo upload failed.");
                }
              }}
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-primary-hover">
                <Camera size={16} aria-hidden="true" /> Upload Photo
              </button>
              {value && (
                <button type="button" onClick={() => { setValue(""); setError(""); if (fileRef.current) fileRef.current.value = ""; }} className="inline-flex items-center gap-2 rounded-xl border border-brand-border bg-white px-4 py-2.5 text-xs font-bold text-brand-secondary hover:bg-brand-subtle">
                  <Trash2 size={15} aria-hidden="true" /> Remove
                </button>
              )}
            </div>
            {error && <DismissibleErrorDialog message={error} onClose={() => setError("")} />}
          </div>
        </div>
      </Field>
    </div>
  );
}
