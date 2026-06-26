import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDeviceRoute } from "@/lib/device";

export default async function Home() {
  const heads = await headers();
  const ua = heads.get("user-agent");
  const target = getDeviceRoute(ua);
  console.log(`[home] UA=${ua?.slice(0, 80)} → ${target}`);
  redirect(target);
}
