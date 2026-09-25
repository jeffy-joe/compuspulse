import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, QrCode, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function ShareDialog({ pollId, question }: { pollId: string; question: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setUrl(`${window.location.origin}/poll/${pollId}`);
  }, [pollId]);

  useEffect(() => {
    if (!open || !url || qr) return;
    QRCode.toDataURL(url, {
      width: 480,
      margin: 1,
      color: { dark: "#1c2431", light: "#ffffff" },
    })
      .then(setQr)
      .catch(() => setQr(null));
  }, [open, url, qr]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the link. Select and copy it manually.");
    }
  }

  async function nativeShare() {
    if (!navigator.share) return;
    try {
      await navigator.share({ title: "CampusPulse", text: question, url });
    } catch {
      /* user dismissed the share sheet */
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Share2 className="h-4 w-4" aria-hidden />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share this poll</DialogTitle>
          <DialogDescription>Anyone with the link can open it and vote.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input readOnly value={url} aria-label="Poll link" className="font-mono text-xs" />
          <Button onClick={copyLink} variant="outline" className="shrink-0">
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-secondary/50 p-5 text-center">
          <p className="flex items-center justify-center gap-1.5 text-sm font-semibold">
            <QrCode className="h-4 w-4" aria-hidden />
            Scan to vote
          </p>
          <div className="mt-3 flex justify-center">
            {qr ? (
              <img
                src={qr}
                alt={`QR code linking to the poll: ${question}`}
                className="h-44 w-44 rounded-md border border-border bg-card p-2"
              />
            ) : (
              <div className="h-44 w-44 animate-pulse rounded-md bg-muted" aria-hidden />
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Point a phone camera at the code to open the poll instantly.
          </p>
        </div>

        {typeof navigator !== "undefined" && "share" in navigator ? (
          <Button variant="secondary" onClick={nativeShare}>
            <Share2 className="h-4 w-4" aria-hidden />
            More sharing options
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
