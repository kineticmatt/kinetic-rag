export async function redisCmd(cmd: any[]) {
  const res = await fetch(`${process.env.REDIS_URL}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`Redis error: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function lpop(key: string): Promise<string|null> {
  const out = await redisCmd(["LPOP", key]);
  const v = out?.result ?? null;
  return v === 0 || v === null ? null : String(v);
}
export async function rpush(key: string, val: string) {
  await redisCmd(["RPUSH", key, val]);
}
