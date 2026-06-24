import { QRCodeSVG } from "qrcode.react";

interface TicketQrProps {
  // The UUID encoded into the QR (yardtix_tickets.qr_token). The host scanner
  // decodes this exact string and posts it as { qr_token }.
  token: string;
  size?: number;
  className?: string;
}

// A real, scannable QR for a paid ticket. Rendered as SVG so it stays crisp at
// any zoom on the holder's phone at the door. Brand maroon on white keeps the
// contrast a camera needs (light fg on dark bg scans poorly).
export function TicketQr({ token, size = 64, className }: TicketQrProps) {
  return (
    <div className={className}>
      <QRCodeSVG
        value={token}
        size={size}
        level="M"
        bgColor="#ffffff"
        fgColor="#8B1538"
        marginSize={2}
        className="rounded-md"
      />
    </div>
  );
}
