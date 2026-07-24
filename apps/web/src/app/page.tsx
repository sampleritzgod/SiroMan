import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { MarketingHero } from "@/components/marketing-hero";

export default async function MarketingPage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/app");
  }

  return <MarketingHero />;
}
