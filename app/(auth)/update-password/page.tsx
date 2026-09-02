import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";

export default function UpdatePasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-slate-900">
          新しいパスワードの設定
        </h1>
        <p className="text-sm text-slate-500">
          新しいパスワードを入力してください。
        </p>
      </div>

      <UpdatePasswordForm />
    </div>
  );
}
