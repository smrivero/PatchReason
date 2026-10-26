import { Link } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";

export function NotFoundPage() {
  usePageTitle("Not found");
  return (
    <div className="panel space-y-3">
      <h1 className="text-xl font-semibold">This route is not part of PatchReason</h1>
      <Link className="text-accentText" to="/">
        Back to overview
      </Link>
    </div>
  );
}
