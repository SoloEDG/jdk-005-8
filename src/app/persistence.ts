const key = "meadow-post-v2";
const legacyKey = "meadow-post-v1";
export function saveFarm(data: unknown) {
  localStorage.setItem(key, JSON.stringify({ version: 2, data }));
}
export function loadFarm<T>(): T | null {
  const raw = localStorage.getItem(key);
  if (raw) {
    const parsed = JSON.parse(raw) as { version: number; data: T };
    if (parsed.version !== 2 || !parsed.data) throw new Error("存档版本不支持");
    return parsed.data;
  }
  // 兼容旧版 v1 存档，田块数字下标会在 fields.restore 中迁移为稳定坐标 ID
  const legacy = localStorage.getItem(legacyKey);
  if (legacy) {
    const parsed = JSON.parse(legacy) as { version: number; data: T };
    if (parsed.version === 1 && parsed.data) return parsed.data;
  }
  return null;
}
