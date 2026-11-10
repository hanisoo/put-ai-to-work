import { Suspense } from "react";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex justify-center py-10">
      <Suspense>
        <SignIn />
      </Suspense>
    </div>
  );
}
