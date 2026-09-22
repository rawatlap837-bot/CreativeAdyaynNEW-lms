import AccessGate from "./AccessGate";

export default function RequireStudent({ children }) {
  return <AccessGate roles={["student"]}>{children}</AccessGate>;
}
