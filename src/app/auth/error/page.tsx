import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Package, AlertTriangle } from "lucide-react";
import Link from "next/link";
import Image from 'next/image';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="flex w-12 items-center justify-center rounded-lg">
                  <Image
                    src="/DepGuardAI_Logo.png"
                    width={1000}
                    height={1000}
                    alt="DepGuard AI Logo"
                  />
            </div>
            <span className="text-xl font-semibold text-foreground">
              DepGuard AI
            </span>
          </div>
          <Card className="w-full">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-2xl">Something went wrong</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <p className="text-center text-sm text-muted-foreground">
                {params?.error
                  ? `Error: ${params.error}`
                  : "An unspecified error occurred during authentication."}
              </p>
              <Button asChild>
                <Link href="/auth/login">Back to login</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
