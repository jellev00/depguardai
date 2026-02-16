import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Package, Mail } from "lucide-react";
import Image from 'next/image';

export default function Page() {
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
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Check your email</CardTitle>
              <CardDescription>
                {"We've sent you a confirmation link"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-sm text-muted-foreground">
                Click the link in your email to verify your account and get
                started with DepGuard AI. The link expires in 24 hours.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
