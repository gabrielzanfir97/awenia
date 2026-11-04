import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

function secureCompare(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();

  return timingSafeEqual(hashA, hashB);
}

export function proxy(request: NextRequest) {
  const ownerPassword = process.env.AWENIA_OWNER_PASSWORD;

  if (!ownerPassword || ownerPassword.length < 20) {
    return new NextResponse("Owner password is not configured.", {
      status: 503,
    });
  }

  const authorization = request.headers.get("authorization") || "";

  let username = "";
  let password = "";

  if (authorization.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(
        authorization.slice(6),
        "base64"
      ).toString("utf8");

      const separator = decoded.indexOf(":");

      if (separator !== -1) {
        username = decoded.slice(0, separator);
        password = decoded.slice(separator + 1);
      }
    } catch {
      // Invalid authorization header.
    }
  }

  if (
    username === "owner" &&
    secureCompare(password, ownerPassword)
  ) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Awenia Private"',
      "Cache-Control": "no-store",
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};