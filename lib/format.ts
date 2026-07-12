const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

// Fee amounts arrive as strings (Prisma Decimal serialization).
export function formatPeso(value: number | string) {
  return peso.format(Number(value));
}
