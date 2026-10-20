import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/brands/:path*",
    "/bill-details/:path*",
    "/customers/:path*",
    "/equipment/:path*",
    "/complaints/:path*",
    "/assignments/:path*",
    "/teams/:path*",
    "/technicians/:path*",
    "/jobs/:path*",
    "/service-history/:path*",
    "/service-collections/:path*",
    "/reports/:path*",
    "/users/:path*",
    "/settings/:path*",
  ],
};
