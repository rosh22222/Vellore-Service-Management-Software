export const MAX_PRODUCT_QUANTITY = 100;
export const MAX_BILL_MACHINES = 500;
export const MAX_KG_QUANTITY = 9999999999.99;
export const QUANTITY_REQUIRED_MESSAGE = "Please enter Quantity.";
export type ProductQuantityUnit = "UNIT" | "KG";

export function readQuantityUnit(value: unknown): ProductQuantityUnit {
  // Forms opened before this feature was added still represent Unit purchases.
  if (value == null || value === "UNIT") return "UNIT";
  if (value === "KG") return "KG";
  throw new Error("Please select Unit or Kg for Quantity.");
}

export function machineQuantity(value: unknown) {
  return productQuantity(value, "UNIT");
}

export function productQuantity(value: unknown, unit: ProductQuantityUnit) {
  if (value == null || (typeof value === "string" && !value.trim())) {
    throw new Error(QUANTITY_REQUIRED_MESSAGE);
  }
  const quantity = Number(value);
  if (unit === "KG") {
    if ((typeof value !== "string" && typeof value !== "number") || !Number.isFinite(quantity) || quantity <= 0 || quantity > MAX_KG_QUANTITY || Number(quantity.toFixed(2)) !== quantity) {
      throw new Error("Quantity in Kg must be greater than 0, with no more than two decimal places.");
    }
    return quantity;
  }
  if ((typeof value !== "string" && typeof value !== "number") || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_PRODUCT_QUANTITY) {
    throw new Error(`Quantity must be a whole number from 1 to ${MAX_PRODUCT_QUANTITY}. Each machine needs its own service record.`);
  }
  return quantity;
}

export function trackedProductCount(item: { quantity: number; quantityUnit: ProductQuantityUnit }) {
  const quantity = productQuantity(item.quantity, item.quantityUnit);
  return item.quantityUnit === "KG" ? 1 : quantity;
}

export function productQuantityLabel(value: number | string | { toString(): string }, unit: ProductQuantityUnit) {
  const quantity = Number(value.toString());
  return `${quantity} ${unit === "KG" ? "Kg" : quantity === 1 ? "Unit" : "Units"}`;
}

export function validateMachineSerials(serials: readonly (string | null | undefined)[]) {
  const found = new Set<string>();
  for (const serial of serials) {
    if (!serial) continue;
    if (serial.length > 120) throw new Error("Machine serial numbers must contain at most 120 characters.");
    const key = serial.toLowerCase();
    if (found.has(key)) throw new Error(`Serial number "${serial}" is repeated. Enter a different serial for each machine, or leave it blank.`);
    found.add(key);
  }
}
