export const withUpsertTimestamps = <
  const Value extends Record<string, unknown> & { createdAt?: number },
>(
  value: Value,
  existingCreatedAt?: number,
) => {
  const now = Date.now();
  return {
    ...value,
    createdAt: value.createdAt ?? existingCreatedAt ?? now,
    updatedAt: now,
  };
};

export const withUpdateTimestamp = <const Value extends Record<string, unknown>>(value: Value) => ({
  ...value,
  updatedAt: Date.now(),
});
