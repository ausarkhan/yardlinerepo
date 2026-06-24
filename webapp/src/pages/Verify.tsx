import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { sendOtp, verifyOtp } from "@/lib/auth";
import { toast } from "sonner";

export default function Verify() {
  const navigate = useNavigate();
  const location = useLocation();
  const stateEmail = (location.state as { email?: string } | null)?.email;
  const email = stateEmail || sessionStorage.getItem("yardline-pending-email") || "";

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(30);

  useEffect(() => {
    if (!email) navigate("/login", { replace: true });
  }, [email, navigate]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function submit(value: string) {
    if (loading) return;
    setLoading(true);
    try {
      await verifyOtp(email, value);
      sessionStorage.removeItem("yardline-pending-email");
      toast.success("You’re in!");
      // Auth state change triggers redirect via PublicOnlyRoute; nudge to home.
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code.");
      setCode("");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (resendIn > 0) return;
    try {
      await sendOtp(email);
      setResendIn(30);
      toast.success("New code sent.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend code.");
    }
  }

  return (
    <AuthLayout>
      <div className="space-y-8">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="space-y-2">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <h2 className="font-heading text-3xl font-bold">Enter your code</h2>
          <p className="text-muted-foreground">
            We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>

        <div className="space-y-5">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={(v) => {
              setCode(v);
              if (v.length === 6) submit(v);
            }}
            disabled={loading}
            containerClassName="justify-center"
          >
            <InputOTPGroup className="gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot
                  key={i}
                  index={i}
                  className="h-12 w-11 rounded-xl border-2 text-lg font-semibold"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>

          <Button
            onClick={() => submit(code)}
            disabled={code.length !== 6 || loading}
            className="h-12 w-full text-base font-semibold"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify & continue"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Didn’t get it?{" "}
            <button
              type="button"
              onClick={resend}
              disabled={resendIn > 0}
              className="font-medium text-primary disabled:text-muted-foreground"
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
            </button>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
