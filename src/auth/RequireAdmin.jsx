import AccessGate from "./AccessGate";
export default function RequireAdmin({ children }) {
  return <AccessGate roles={["admin"]}>{children}</AccessGate>;
}
