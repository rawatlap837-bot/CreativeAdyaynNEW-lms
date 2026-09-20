import AccessGate from "./AccessGate";
export default function RequireAuth({ children }) {
  return <AccessGate>{children}</AccessGate>;
}
