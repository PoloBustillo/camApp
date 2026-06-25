import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDeviceRoute } from "@/lib/device";

export default async function Home() {
  const heads = await headers();
  const ua = heads.get("user-agent");
  const target = getDeviceRoute(ua);
  redirect(target);
}
