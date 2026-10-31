"use client";

import { useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export function BookingStorageSync({
  reference,
  autoRedirectIfMissing = false,
}: {
  reference?: string | null;
  autoRedirectIfMissing?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (reference) {
      try {
        localStorage.setItem("last_booking_ref", reference);
        document.cookie = `last_booking_ref=${encodeURIComponent(
          reference,
        )}; path=/; max-age=31536000; SameSite=Lax`;
      } catch {
        // ignore storage restrictions
      }
      return;
    }

    if (autoRedirectIfMissing) {
      try {
        const stored = localStorage.getItem("last_booking_ref")?.trim();
        const currentRef = searchParams.get("ref")?.trim();
        if (stored && !currentRef) {
          const params = new URLSearchParams(searchParams.toString());
          params.set("ref", stored);
          router.replace(`${pathname}?${params.toString()}`);
        }
      } catch {
        // ignore storage restrictions
      }
    }
  }, [reference, autoRedirectIfMissing, pathname, router, searchParams]);

  return null;
}
