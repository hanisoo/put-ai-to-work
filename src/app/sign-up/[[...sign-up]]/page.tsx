import { Suspense } from "react";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex justify-center py-10">
      <Suspense>
        <SignUp />
      </Suspense>
    </div>
  );
}
