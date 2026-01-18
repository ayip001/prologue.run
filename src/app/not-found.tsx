import Link from "next/link";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/Logo";

export default function NotFound() {
  return (
    <div className="min-h-screen dark:bg-slate-950 light:bg-white flex items-center justify-center px-4">
      <div className="text-center">
        <Logo className="justify-center mb-8" />

        <h1 className="text-6xl font-bold dark:text-white light:text-slate-900 mb-4">404</h1>
        <h2 className="text-2xl font-semibold dark:text-slate-300 light:text-slate-700 mb-4">
          Page Not Found
        </h2>
        <p className="dark:text-slate-400 light:text-slate-600 mb-8 max-w-md mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild>
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="javascript:history.back()">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
