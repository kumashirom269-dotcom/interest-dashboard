import { SignupConfirmedNotice } from "@/components/auth/SignupConfirmedNotice";

export default function SignupConfirmedPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-slate-900">
          メールアドレスの確認
        </h1>
      </div>

      <SignupConfirmedNotice />
    </div>
  );
}
